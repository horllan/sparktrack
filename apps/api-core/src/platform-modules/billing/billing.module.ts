import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadRequestException, Body, Controller, Get, Headers, Inject, Module, Post, UnauthorizedException } from '@nestjs/common';
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

export function verifyPaystackSignature(payloadJson: string, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader || !secret) return false;
  const expected = createHmac('sha512', secret).update(payloadJson).digest('hex');
  if (expected.length !== signatureHeader.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signatureHeader, 'utf8'));
}

export function verifyStripeSignature(payloadJson: string, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader || !secret) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((item) => {
      const [k, v] = item.trim().split('=');
      return [k, v];
    }),
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1 || !/^\d+$/.test(timestamp)) return false;
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
    return billingQueries.enrolLearner(this.db, { ...parsed, enrolledBy: user.id });
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
    if (!verifyStripeSignature(raw, signature, secret)) {
      throw new UnauthorizedException('Invalid Stripe webhook signature');
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
