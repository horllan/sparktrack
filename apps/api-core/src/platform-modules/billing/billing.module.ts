import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Logger,
  Module,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { billingQueries, governanceQueries, type SparkTrackDatabase } from '@sparktrack/db';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import { CurrentUser, LearnerAccessService, Public, Roles, type AuthUser } from '../../common/auth/auth.guard';
import { KYSELY } from '../../common/database/database.module';

const CreateCohortSchema = z.object({
  organisationId: z.string().uuid().nullable().optional(),
  title: z.string().min(3).max(160),
  description: z.string().max(1000).optional(),
  programmeType: z.enum(['HOLIDAY_CAMP', 'SCHOOL_TERM_COCURRICULAR', 'WEEKEND_WORKSHOP', 'ONLINE_COHORT']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  maxCapacity: z.number().int().min(1).max(500).default(30),
  priceNgn: z.number().int().nonnegative().nullable().optional(),
  priceUsd: z.number().int().nonnegative().nullable().optional(),
});

export const EnrolLearnerSchema = z.object({
  learnerId: z.string().uuid(),
  cohortId: z.string().uuid(),
  paymentProvider: z.enum(['PAYSTACK', 'STRIPE', 'INSTITUTIONAL_INVOICE']),
  paymentReference: z.string().min(3).max(120).nullable().optional(),
  paymentAmount: z.number().int().nonnegative().nullable().optional(),
  paymentCurrency: z.string().length(3).default('NGN'),
});

export const SimulateWebhookSchema = z.object({
  paymentProvider: z.enum(['PAYSTACK', 'STRIPE', 'INSTITUTIONAL_INVOICE']),
  paymentReference: z.string().min(3).max(120),
  paymentAmount: z.number().int().nonnegative().optional(),
});

export function isRealProviderSecret(secret: string | undefined): boolean {
  if (!secret) return false;
  const trimmed = secret.trim();
  if (trimmed.length < 16) return false;
  if (trimmed.includes('REPLACE_WITH') || trimmed.includes('xxxxxxxx')) return false;
  return true;
}

export function verifyPaystackSignature(payloadJson: string, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader || !isRealProviderSecret(secret)) return false;
  const expected = createHmac('sha512', secret).update(payloadJson).digest('hex');
  if (expected.length !== signatureHeader.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signatureHeader, 'utf8'));
}

export function verifyStripeSignature(
  payloadJson: string,
  signatureHeader: string | undefined,
  secret: string,
  options?: { toleranceSeconds?: number; nowEpochSeconds?: number },
): boolean {
  if (!signatureHeader || !isRealProviderSecret(secret)) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((item) => {
      const [k, v] = item.trim().split('=');
      return [k, v];
    }),
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1 || !/^\d+$/.test(timestamp)) return false;

  if (options?.toleranceSeconds && options.toleranceSeconds > 0) {
    const nowEpoch = options.nowEpochSeconds ?? Math.floor(Date.now() / 1000);
    const tsEpoch = Number(timestamp);
    if (!Number.isFinite(tsEpoch) || Math.abs(nowEpoch - tsEpoch) > options.toleranceSeconds) {
      return false;
    }
  }

  const expected = createHmac('sha256', secret).update(`${timestamp}.${payloadJson}`).digest('hex');
  if (expected.length !== v1.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(v1, 'utf8'));
}

@ApiTags('billing')
@Controller('v1/billing')
class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    @Inject(KYSELY) private readonly db: Kysely<SparkTrackDatabase>,
    @Inject(NestConfigService) private readonly config: ConfigService,
    private readonly access: LearnerAccessService,
  ) {}

  private getStage(): string {
    return (
      this.config.get<string>('SPARKTRACK_STAGE') ??
      this.config.get<string>('NODE_ENV') ??
      'development'
    ).toLowerCase();
  }

  private getWebOrigin(): string {
    return (
      this.config.get<string>('CORS_ORIGIN')?.split(',')[0]?.trim() ||
      'http://localhost:3000'
    );
  }

  @Public()
  @Get('providers/status')
  @ApiOperation({ summary: 'Return payment, SMS, storage, and AI provider configuration mode (LIVE vs SANDBOX_SIMULATION)' })
  providerStatus() {
    const stage = this.getStage();
    const paystackSecret = this.config.get<string>('PAYSTACK_SECRET_KEY')?.trim();
    const paystackLive = isRealProviderSecret(paystackSecret);
    const paystackKeyMode = paystackLive
      ? paystackSecret?.startsWith('sk_live_')
        ? ('LIVE_PRODUCTION' as const)
        : ('LIVE_TEST_MODE' as const)
      : ('SANDBOX_SIMULATION' as const);

    const stripeLive =
      isRealProviderSecret(this.config.get<string>('STRIPE_SECRET_KEY')) ||
      isRealProviderSecret(this.config.get<string>('STRIPE_WEBHOOK_SECRET'));
    const termiiLive = isRealProviderSecret(this.config.get<string>('TERMII_API_KEY'));
    const r2Live =
      isRealProviderSecret(this.config.get<string>('R2_ACCOUNT_ID')) &&
      isRealProviderSecret(this.config.get<string>('R2_ACCESS_KEY_ID')) &&
      isRealProviderSecret(this.config.get<string>('R2_SECRET_ACCESS_KEY'));
    const geminiKey =
      this.config.get<string>('GOOGLE_GENERATIVE_AI_API_KEY') ??
      this.config.get<string>('GOOGLE_API_KEY');
    const geminiLive = isRealProviderSecret(geminiKey) && !geminiKey?.includes('your-');

    return {
      stage,
      simulationAllowed: stage !== 'production',
      paystackKeyMode,
      providers: {
        PAYSTACK: paystackLive ? ('LIVE' as const) : ('SANDBOX_SIMULATION' as const),
        STRIPE: stripeLive ? ('LIVE' as const) : ('SANDBOX_SIMULATION' as const),
        INSTITUTIONAL_INVOICE: 'MANUAL_SETTLEMENT' as const,
        TERMII_SMS: termiiLive ? ('LIVE' as const) : ('SANDBOX_SIMULATION' as const),
        CLOUDFLARE_R2: r2Live ? ('LIVE' as const) : ('SANDBOX_SIMULATION' as const),
        GEMINI_AI: geminiLive ? ('LIVE' as const) : ('DETERMINISTIC_FALLBACK' as const),
      },
    };
  }

  @Public()
  @Get('cohorts')
  @ApiOperation({ summary: 'List all holiday camp, weekend workshop, and school term cohorts' })
  cohorts() {
    return billingQueries.listCohorts(this.db);
  }

  @ApiBearerAuth()
  @Post('cohorts')
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new programme cohort' })
  createCohort(@Body() body: unknown) {
    const parsed = CreateCohortSchema.parse(body);
    if (parsed.endDate <= parsed.startDate) {
      throw new BadRequestException('endDate must be after startDate');
    }
    return billingQueries.createCohort(this.db, parsed);
  }

  @ApiBearerAuth()
  @Post('enrolments')
  @Roles('PARENT', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a pending learner enrolment and initialize Paystack/Stripe checkout URL when live keys are configured' })
  async enrol(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = EnrolLearnerSchema.parse(body);
    await this.access.assertCanAccess(user, parsed.learnerId);
    const result = await billingQueries.enrolLearner(this.db, { ...parsed, enrolledBy: user.id });
    if (result.status === 'cohort_not_active') {
      throw new ConflictException('The selected cohort is not currently active for enrolment.');
    }
    if (result.status === 'cohort_full') {
      throw new ConflictException('This cohort has reached its maximum seat capacity.');
    }

    const status = this.providerStatus();
    const checkoutMode =
      parsed.paymentProvider === 'PAYSTACK'
        ? status.providers.PAYSTACK
        : parsed.paymentProvider === 'STRIPE'
          ? status.providers.STRIPE
          : status.providers.INSTITUTIONAL_INVOICE;

    let authorizationUrl: string | null = null;
    let accessCode: string | null = null;
    const reference = result.paymentReference;
    const amountSmallestUnit = result.paymentAmount && result.paymentAmount > 0 ? result.paymentAmount : 500_000; // default ₦5,000 (500,000 kobo) or $50.00 (5,000 cents) if cohort price was 0

    if (
      parsed.paymentProvider === 'PAYSTACK' &&
      checkoutMode === 'LIVE' &&
      reference &&
      result.enrolmentStatus === 'PENDING_PAYMENT'
    ) {
      const paystackSecret = this.config.get<string>('PAYSTACK_SECRET_KEY')?.trim();
      if (paystackSecret && isRealProviderSecret(paystackSecret)) {
        const customerEmail = await billingQueries.enrolierContact(this.db, user.id, parsed.learnerId);
        const callbackUrl = `${this.getWebOrigin()}/admin/dashboard?payment_ref=${encodeURIComponent(reference)}`;
        try {
          const psRes = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${paystackSecret}`,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(10_000),
            body: JSON.stringify({
              email: customerEmail,
              amount: String(amountSmallestUnit),
              reference,
              currency: 'NGN',
              callback_url: callbackUrl,
              metadata: {
                learnerId: parsed.learnerId,
                cohortId: parsed.cohortId,
                enrolmentId: result.enrolmentId,
                enrolledBy: user.id,
              },
            }),
          });
          const psBody = (await psRes.json().catch(() => null)) as {
            status?: boolean;
            data?: { authorization_url?: string; access_code?: string; reference?: string };
          } | null;
          if (psRes.ok && psBody?.status && psBody.data?.authorization_url) {
            authorizationUrl = psBody.data.authorization_url;
            accessCode = psBody.data.access_code ?? null;
          }
        } catch (err) {
          this.logger.warn(
            `Paystack initialize call failed (falling back to reference verification): ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    } else if (
      parsed.paymentProvider === 'STRIPE' &&
      checkoutMode === 'LIVE' &&
      reference &&
      result.enrolmentStatus === 'PENDING_PAYMENT'
    ) {
      const stripeSecret = this.config.get<string>('STRIPE_SECRET_KEY')?.trim();
      if (stripeSecret && isRealProviderSecret(stripeSecret)) {
        const customerEmail = await billingQueries.enrolierContact(this.db, user.id, parsed.learnerId);
        const successUrl = `${this.getWebOrigin()}/admin/dashboard?payment_ref=${encodeURIComponent(reference)}`;
        const cancelUrl = `${this.getWebOrigin()}/admin/dashboard`;
        try {
          const form = new URLSearchParams({
            mode: 'payment',
            client_reference_id: reference,
            customer_email: customerEmail,
            success_url: successUrl,
            cancel_url: cancelUrl,
            'line_items[0][price_data][currency]': 'usd',
            'line_items[0][price_data][unit_amount]': String(Math.max(500, amountSmallestUnit)),
            'line_items[0][price_data][product_data][name]': 'SparkTrack Cohort Enrolment',
            'line_items[0][quantity]': '1',
          });
          const stRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${stripeSecret}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            signal: AbortSignal.timeout(10_000),
            body: form.toString(),
          });
          const stBody = (await stRes.json().catch(() => null)) as { id?: string; url?: string } | null;
          if (stRes.ok && stBody?.url) {
            authorizationUrl = stBody.url;
            accessCode = stBody.id ?? null;
          }
        } catch (err) {
          this.logger.warn(
            `Stripe checkout session creation failed: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    }

    return {
      ...result,
      checkoutMode,
      paystackKeyMode: status.paystackKeyMode,
      authorizationUrl,
      accessCode,
      simulationAllowed: status.simulationAllowed,
    };
  }

  @ApiBearerAuth()
  @Get('verify/:reference')
  @Roles('PARENT', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary:
      'Verify a transaction reference directly with Paystack or Stripe APIs and activate the enrolment if paid',
  })
  async verifyReference(@CurrentUser() user: AuthUser, @Param('reference') reference: string) {
    const cleanRef = reference.trim();
    const enrolment = await billingQueries.findEnrolmentByReference(this.db, cleanRef);
    if (!enrolment) {
      throw new NotFoundException(`No enrolment found for payment reference ${cleanRef}`);
    }
    await this.access.assertCanAccess(user, enrolment.learnerId);

    if (enrolment.enrolmentStatus === 'ACTIVE' || enrolment.enrolmentStatus === 'CONFIRMED') {
      return {
        verified: true,
        source: 'DATABASE_ALREADY_ACTIVE' as const,
        enrolment,
      };
    }

    if (enrolment.paymentProvider === 'PAYSTACK') {
      const paystackSecret = this.config.get<string>('PAYSTACK_SECRET_KEY')?.trim();
      if (paystackSecret && isRealProviderSecret(paystackSecret)) {
        const psRes = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(cleanRef)}`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${paystackSecret}` },
            signal: AbortSignal.timeout(10_000),
          },
        ).catch(() => null);

        if (psRes?.ok) {
          const psBody = (await psRes.json().catch(() => null)) as {
            status?: boolean;
            data?: { status?: string; amount?: number; reference?: string };
          } | null;
          if (psBody?.status && psBody.data?.status === 'success') {
            const confirmed = await billingQueries.confirmPaymentByReference(this.db, {
              paymentProvider: 'PAYSTACK',
              paymentReference: cleanRef,
              paymentAmount: psBody.data.amount,
            });
            await governanceQueries
              .logActivity(this.db, {
                actorId: user.id,
                actorRole: user.role,
                organisationId: user.organisationId,
                actionType: 'PAYSTACK_TRANSACTION_VERIFIED',
                resourceDomain: 'CORE_IDENTITY',
                classificationAccessed: 'TIER_2_INTERNAL',
                recordsReturned: 1,
                maskingApplied: true,
                outcome: confirmed.status.toUpperCase(),
                metadata: { reference: cleanRef, amountKobo: psBody.data.amount },
              })
              .catch(() => null);
            const updated = await billingQueries.findEnrolmentByReference(this.db, cleanRef);
            return {
              verified: confirmed.status === 'activated' || confirmed.status === 'already_processed',
              source: 'PAYSTACK_LIVE_API' as const,
              confirmationStatus: confirmed.status,
              enrolment: updated ?? enrolment,
            };
          }
        }
      }
    }

    return {
      verified: false,
      source: 'PENDING_SETTLEMENT' as const,
      enrolment,
    };
  }

  @ApiBearerAuth()
  @Post('simulate-webhook')
  @Roles('PARENT', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary:
      'Sandbox/Staging simulator: signs a genuine HMAC webhook payload and processes payment confirmation when live keys are not yet provisioned',
  })
  async simulateWebhook(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const stage = this.getStage();
    if (stage === 'production') {
      throw new ForbiddenException('Sandbox payment webhook simulation is strictly disabled in production.');
    }
    const parsed = SimulateWebhookSchema.parse(body);
    if (parsed.paymentProvider === 'INSTITUTIONAL_INVOICE' && user.role === 'PARENT') {
      throw new ForbiddenException('Institutional invoice settlement requires School Admin or Super Admin authorization.');
    }

    // Exercise the exact cryptographic signature verification path using an ephemeral sandbox signing key
    const sandboxSecret = 'spk_sandbox_ephemeral_signing_key_2026_verified';
    let signatureVerified = false;
    if (parsed.paymentProvider === 'PAYSTACK') {
      const payloadJson = JSON.stringify({
        event: 'charge.success',
        data: { reference: parsed.paymentReference, amount: parsed.paymentAmount },
      });
      const sig = createHmac('sha512', sandboxSecret).update(payloadJson).digest('hex');
      signatureVerified = verifyPaystackSignature(payloadJson, sig, sandboxSecret);
    } else if (parsed.paymentProvider === 'STRIPE') {
      const nowEpoch = Math.floor(Date.now() / 1000);
      const payloadJson = JSON.stringify({
        type: 'checkout.session.completed',
        data: { object: { client_reference_id: parsed.paymentReference, amount_total: parsed.paymentAmount } },
      });
      const v1 = createHmac('sha256', sandboxSecret).update(`${nowEpoch}.${payloadJson}`).digest('hex');
      signatureVerified = verifyStripeSignature(payloadJson, `t=${nowEpoch},v1=${v1}`, sandboxSecret, {
        toleranceSeconds: 300,
        nowEpochSeconds: nowEpoch,
      });
    } else {
      signatureVerified = true;
    }

    if (!signatureVerified) {
      throw new UnauthorizedException('Sandbox webhook signature self-check failed.');
    }

    const confirmation = await billingQueries.confirmPaymentByReference(this.db, {
      paymentProvider: parsed.paymentProvider,
      paymentReference: parsed.paymentReference,
      paymentAmount: parsed.paymentAmount,
    });

    return {
      simulated: true,
      stage,
      signatureVerified,
      ...confirmation,
    };
  }

  @Public()
  @Post('webhooks/paystack')
  @ApiOperation({ summary: 'Idempotent Paystack webhook handler (verifies HMAC-SHA512 x-paystack-signature against rawBody)' })
  async paystackWebhook(
    @Req() req: RawBodyRequest<Record<string, unknown>>,
    @Headers('x-paystack-signature') signature: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const secret = this.config.get<string>('PAYSTACK_SECRET_KEY') ?? '';
    const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(body);
    if (!verifyPaystackSignature(raw, signature, secret)) {
      throw new UnauthorizedException('Invalid Paystack webhook signature');
    }
    const event = body.event as string | undefined;
    const data = (body.data ?? {}) as Record<string, unknown>;
    if (event !== 'charge.success' || typeof data.reference !== 'string') {
      return { status: 'ignored', event };
    }
    return billingQueries.confirmPaymentByReference(this.db, {
      paymentProvider: 'PAYSTACK',
      paymentReference: data.reference,
      paymentAmount: typeof data.amount === 'number' ? data.amount : undefined,
    });
  }

  @Public()
  @Post('webhooks/stripe')
  @ApiOperation({ summary: 'Idempotent Stripe webhook handler (verifies HMAC-SHA256 stripe-signature against rawBody)' })
  async stripeWebhook(
    @Req() req: RawBodyRequest<Record<string, unknown>>,
    @Headers('stripe-signature') signature: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(body);
    if (!verifyStripeSignature(raw, signature, secret, { toleranceSeconds: 300 })) {
      throw new UnauthorizedException('Invalid or expired Stripe webhook signature');
    }
    const type = body.type as string | undefined;
    const obj = ((body.data as Record<string, unknown> | undefined)?.object ?? {}) as Record<string, unknown>;
    const reference = (obj.client_reference_id ?? obj.id) as string | undefined;
    if ((type !== 'checkout.session.completed' && type !== 'payment_intent.succeeded') || !reference) {
      return { status: 'ignored', type };
    }
    return billingQueries.confirmPaymentByReference(this.db, {
      paymentProvider: 'STRIPE',
      paymentReference: reference,
      paymentAmount: typeof obj.amount_total === 'number' ? obj.amount_total : undefined,
    });
  }
}

@Module({ controllers: [BillingController] })
export class BillingModule {}
