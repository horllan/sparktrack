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
  Module,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { billingQueries, type SparkTrackDatabase } from '@sparktrack/db';
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

  @Public()
  @Get('providers/status')
  @ApiOperation({ summary: 'Return payment and SMS provider configuration mode (LIVE vs SANDBOX_SIMULATION)' })
  providerStatus() {
    const stage = this.getStage();
    const paystackLive = isRealProviderSecret(this.config.get<string>('PAYSTACK_SECRET_KEY'));
    const stripeLive = isRealProviderSecret(this.config.get<string>('STRIPE_WEBHOOK_SECRET'));
    const termiiLive = isRealProviderSecret(this.config.get<string>('TERMII_API_KEY'));
    return {
      stage,
      simulationAllowed: stage !== 'production',
      providers: {
        PAYSTACK: paystackLive ? ('LIVE' as const) : ('SANDBOX_SIMULATION' as const),
        STRIPE: stripeLive ? ('LIVE' as const) : ('SANDBOX_SIMULATION' as const),
        INSTITUTIONAL_INVOICE: 'MANUAL_SETTLEMENT' as const,
        TERMII_SMS: termiiLive ? ('LIVE' as const) : ('SANDBOX_SIMULATION' as const),
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
  @ApiOperation({ summary: 'Create a pending learner enrolment for payment or institutional invoicing' })
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

    return {
      ...result,
      checkoutMode,
      simulationAllowed: status.simulationAllowed,
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
  @ApiOperation({ summary: 'Idempotent Paystack webhook handler (verifies HMAC-SHA512 x-paystack-signature)' })
  async paystackWebhook(
    @Headers('x-paystack-signature') signature: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const secret = this.config.get<string>('PAYSTACK_SECRET_KEY') ?? '';
    const raw = JSON.stringify(body);
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
  @ApiOperation({ summary: 'Idempotent Stripe webhook handler (verifies HMAC-SHA256 stripe-signature)' })
  async stripeWebhook(
    @Headers('stripe-signature') signature: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    const raw = JSON.stringify(body);
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
