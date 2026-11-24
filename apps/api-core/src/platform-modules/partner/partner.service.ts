import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Kysely } from 'kysely';
import {
  canonicalJson,
  decryptWebhookSecret,
  governanceQueries,
  partnerQueries,
  sha256Hex,
  signPartnerWebhookPayload,
  type SparkTrackDatabase,
} from '@sparktrack/db';
import type { ArtifactType, BehaviouralSignal } from '@sparktrack/contracts';
import type { AuthUser } from '../../common/auth/auth.guard';
import { KYSELY } from '../../common/database/database.module';
import { deriveUuid } from '../../common/util/derive-uuid';
import { EvidenceEngineService } from '../../intelligence-core/evidence-engine/evidence-engine.service';
import { SkillEngineService } from '../../intelligence-core/skill-engine/skill-engine.service';
import { PathwayEngineService } from '../../intelligence-core/pathway-engine/pathway-engine.service';
import { RecommendationEngineService } from '../../intelligence-core/recommendation-engine/recommendation-engine.service';

const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^\[?::1\]?$/,
  /^fc00:/i,
  /^fe80:/i,
];

@Injectable()
export class PartnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PartnerService.name);
  private timer: NodeJS.Timeout | null = null;
  private dispatching = false;

  constructor(
    @Inject(KYSELY) private readonly db: Kysely<SparkTrackDatabase>,
    @Inject(ConfigService) private readonly config: ConfigService,
    private readonly evidence: EvidenceEngineService,
    private readonly skills: SkillEngineService,
    private readonly pathways: PathwayEngineService,
    private readonly reports: RecommendationEngineService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.dispatchPendingWebhooks();
    }, 10_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private getEncryptionKey(): string {
    return (
      this.config.get<string>('PARTNER_WEBHOOK_ENCRYPTION_KEY')?.trim() ||
      this.config.get<string>('CONSENT_OTP_SECRET')?.trim() ||
      'sparktrack-dev-webhook-encryption-key-2026'
    );
  }

  private getWebOrigin(): string {
    return (
      this.config.get<string>('CORS_ORIGIN')?.split(',')[0]?.trim() ||
      'http://localhost:3000'
    );
  }

  private assertOrganisationId(user: AuthUser): string {
    if (!user.organisationId) {
      throw new ForbiddenException(
        'Partner API requests require an API key bound to an organisation.',
      );
    }
    return user.organisationId;
  }

  private validateWebhookUrl(rawUrl: string) {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      throw new BadRequestException('Invalid webhook URL.');
    }
    const stage = (
      this.config.get<string>('SPARKTRACK_STAGE') ??
      this.config.get<string>('NODE_ENV') ??
      'development'
    ).toLowerCase();

    if (stage === 'production' && parsed.protocol !== 'https:') {
      throw new BadRequestException('Webhook URLs must use HTTPS in production.');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new BadRequestException('Webhook URL must use HTTP or HTTPS.');
    }
    if (stage === 'production' && PRIVATE_IP_PATTERNS.some((rx) => rx.test(parsed.hostname))) {
      throw new BadRequestException('Webhook URL cannot target private or loopback network addresses.');
    }
  }

  private async withIdempotency<T>(
    user: AuthUser,
    idempotencyKey: string | undefined,
    payload: unknown,
    fn: () => Promise<T>,
  ): Promise<T> {
    const cleanKey = idempotencyKey?.trim();
    if (!cleanKey || !user.apiKeyId) {
      return fn();
    }
    const fingerprint = sha256Hex(canonicalJson(payload));
    const claim = await partnerQueries.claimIdempotency(this.db, {
      apiKeyId: user.apiKeyId,
      idempotencyKey: cleanKey,
      requestFingerprint: fingerprint,
    });
    if (claim.status === 'conflict') {
      throw new ConflictException('Idempotency-Key was already used with a different request payload.');
    }
    if (claim.status === 'in_progress') {
      throw new ConflictException('A request with this Idempotency-Key is currently being processed.');
    }
    if (claim.status === 'replay') {
      return claim.responseBody as T;
    }

    try {
      const result = await fn();
      await partnerQueries.completeIdempotency(this.db, {
        apiKeyId: user.apiKeyId,
        idempotencyKey: cleanKey,
        responseStatus: 200,
        responseBody: result,
      });
      return result;
    } catch (err) {
      await partnerQueries
        .releaseIdempotencyOnError(this.db, user.apiKeyId, cleanKey)
        .catch(() => null);
      throw err;
    }
  }

  private async enqueueAndDispatch(
    organisationId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    const res = await partnerQueries
      .enqueueWebhookEvent(this.db, { organisationId, eventType, payload })
      .catch(() => null);
    if (res && res.queuedCount > 0) {
      void this.dispatchPendingWebhooks();
    }
  }

  async dispatchPendingWebhooks(): Promise<number> {
    if (this.dispatching) return 0;
    this.dispatching = true;
    let deliveredCount = 0;
    try {
      const due = await partnerQueries.claimPendingWebhookDeliveries(this.db, 20);
      if (due.length === 0) return 0;

      const encryptionKey = this.getEncryptionKey();
      await Promise.all(
        due.map(async (item) => {
          try {
            const secret = decryptWebhookSecret(item.secretCiphertext, encryptionKey);
            const payloadJson = JSON.stringify(item.payload);
            const epoch = Math.floor(Date.now() / 1000);
            const signature = signPartnerWebhookPayload(payloadJson, secret, epoch);

            const res = await fetch(item.url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'SparkTrack-Webhook-Dispatcher/1.0',
                'x-sparktrack-signature': signature,
                'x-sparktrack-event': item.eventType,
                'x-sparktrack-delivery': item.deliveryId,
              },
              body: payloadJson,
              signal: AbortSignal.timeout(8_000),
            });

            if (res.ok) {
              deliveredCount += 1;
              await partnerQueries.markWebhookDeliveryResult(this.db, {
                deliveryId: item.deliveryId,
                endpointId: item.endpointId,
                attemptCount: item.attemptCount,
                success: true,
                responseStatus: res.status,
              });
            } else {
              await partnerQueries.markWebhookDeliveryResult(this.db, {
                deliveryId: item.deliveryId,
                endpointId: item.endpointId,
                attemptCount: item.attemptCount,
                success: false,
                responseStatus: res.status,
                error: `HTTP ${res.status}`,
              });
            }
          } catch (err) {
            await partnerQueries
              .markWebhookDeliveryResult(this.db, {
                deliveryId: item.deliveryId,
                endpointId: item.endpointId,
                attemptCount: item.attemptCount,
                success: false,
                error: err instanceof Error ? err.message : 'Network error',
              })
              .catch(() => null);
          }
        }),
      );
      return deliveredCount;
    } catch (err) {
      this.logger.debug(
        `Webhook dispatcher cycle skipped: ${err instanceof Error ? err.message : err}`,
      );
      return deliveredCount;
    } finally {
      this.dispatching = false;
    }
  }

  async upsertLearner(
    user: AuthUser,
    idempotencyKey: string | undefined,
    payload: {
      externalLearnerId: string;
      fullName: string;
      ageGroup: 'UNDER_18' | 'ADULT';
      dateOfBirth?: string;
      learnerStage: string;
      educationStage?: string;
      educationLevel?: string;
      learningGoal?: string;
      declaredInterests: string[];
      consentStatus: 'PENDING_PARENTAL_CONSENT' | 'VERIFIED_ACTIVE' | 'RESTRICTED_INTERNAL_ONLY' | 'REVOKED';
      attestationMethod:
        | 'ADULT_SELF_CONSENT'
        | 'GUARDIAN_WRITTEN_CONSENT'
        | 'GUARDIAN_DIGITAL_CONSENT'
        | 'INSTITUTIONAL_ENROLMENT_AGREEMENT'
        | 'CONSENT_WITHDRAWN';
      guardianName?: string;
      guardianContact?: string;
      evidenceReference?: string;
      allowPublicPortfolio?: boolean;
      allowPartnerTalentDiscovery?: boolean;
      autoEnrolPilot?: boolean;
      cohortId?: string;
      pilotCohortTitle?: string;
    },
  ) {
    const organisationId = this.assertOrganisationId(user);
    return this.withIdempotency(user, idempotencyKey, payload, async () => {
      const res = await partnerQueries.upsertExternalLearner(this.db, {
        organisationId,
        apiKeyId: user.apiKeyId ?? null,
        ...payload,
      });

      let cohortEnrolment: {
        enrolmentId: string;
        cohortId: string;
        cohortTitle: string;
        newlyEnrolled: boolean;
      } | null = null;

      if (payload.autoEnrolPilot || payload.cohortId) {
        cohortEnrolment = await partnerQueries.enrolInPilotCohort(this.db, {
          organisationId,
          learnerId: res.learnerId,
          enrolledBy: user.id,
          cohortId: payload.cohortId,
          cohortTitle: payload.pilotCohortTitle,
        });
      }

      const webOrigin = this.getWebOrigin();
      const response = {
        externalLearnerId: res.externalLearnerId,
        learnerRef: res.learnerRef,
        created: res.created,
        consentStatus: res.consentStatus,
        allowPublicPortfolio: res.allowPublicPortfolio,
        portfolioUrl: res.publicShareToken ? `${webOrigin}/p/${res.publicShareToken}` : null,
        embedUrl: res.publicShareToken ? `${webOrigin}/embed/portfolio/${res.publicShareToken}` : null,
        cohortEnrolment,
      };

      await governanceQueries
        .logActivity(this.db, {
          actorId: user.id,
          actorRole: user.role,
          organisationId,
          actionType: 'PARTNER_LEARNER_UPSERT',
          resourceDomain: 'CORE_IDENTITY',
          classificationAccessed: 'TIER_3_CONFIDENTIAL_PII',
          recordsReturned: 1,
          maskingApplied: true,
          outcome: res.created ? 'CREATED' : 'UPDATED',
          metadata: { externalLearnerId: res.externalLearnerId, consentStatus: res.consentStatus },
        })
        .catch(() => null);

      await this.enqueueAndDispatch(organisationId, 'learner.upserted', response);
      return response;
    });
  }

  async submitEvidence(
    user: AuthUser,
    idempotencyKey: string | undefined,
    payload: {
      externalLearnerId: string;
      externalSubmissionId: string;
      artifactType: ArtifactType;
      title: string;
      description?: string;
      skillCodes: string[];
      externalUrls: string[];
      qualityScore?: number;
      complexityWeight: number;
      capturedAt?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const organisationId = this.assertOrganisationId(user);
    return this.withIdempotency(user, idempotencyKey, payload, async () => {
      const learner = await partnerQueries.resolveExternalLearner(
        this.db,
        organisationId,
        payload.externalLearnerId,
      );
      if (!learner) {
        throw new NotFoundException(
          `External learner "${payload.externalLearnerId}" is not linked to your organisation. Call POST /v1/partner/learners/upsert first.`,
        );
      }

      const clientSyncId = deriveUuid(
        `partner:${organisationId}:${payload.externalLearnerId}:${payload.externalSubmissionId}`,
      );
      const actorForIngestion: AuthUser = {
        ...user,
        role: 'SUPER_ADMIN',
        organisationId,
      };

      const sealed = await this.evidence.syncEvidence(actorForIngestion, {
        clientSyncId,
        learnerId: learner.learnerId,
        artifactType: payload.artifactType,
        title: payload.title,
        description: payload.description,
        storageR2Keys: [],
        externalUrls: payload.externalUrls,
        payload: {
          schema_version: '1.0',
          skill_codes: payload.skillCodes,
          external_submission_id: payload.externalSubmissionId,
          partner_metadata: payload.metadata ?? {},
        },
        qualityScore: payload.qualityScore,
        complexityWeight: payload.complexityWeight,
        capturedOfflineAt: payload.capturedAt ?? new Date().toISOString(),
      });

      const computedSkills = await this.skills.computeAll(learner.learnerId);
      const response = {
        externalLearnerId: learner.externalLearnerId,
        externalSubmissionId: payload.externalSubmissionId,
        learnerRef: learner.learnerRef,
        alreadySynced: sealed.alreadySynced,
        artifactId: sealed.artifactId,
        ledgerSeq: 'ledgerSeq' in sealed ? sealed.ledgerSeq : null,
        rowSignatureHash: 'rowSignatureHash' in sealed ? sealed.rowSignatureHash : null,
        skillsUpdated: computedSkills.slice(0, 6).map((s) => ({
          code: s.code,
          score: Number(s.score.toFixed(4)),
          progression: s.progression,
          evidenceCount: s.evidenceCount,
        })),
      };

      if (!sealed.alreadySynced) {
        await this.enqueueAndDispatch(organisationId, 'evidence.sealed', response);
      }
      return response;
    });
  }

  async submitRubric(
    user: AuthUser,
    idempotencyKey: string | undefined,
    payload: {
      externalLearnerId: string;
      externalEvaluationId: string;
      artifactId?: string;
      qualityScore: number;
      overallComment?: string;
      observedSignals: Array<{
        signal: BehaviouralSignal;
        intensity: number;
        note?: string;
      }>;
      capturedAt?: string;
    },
  ) {
    const organisationId = this.assertOrganisationId(user);
    return this.withIdempotency(user, idempotencyKey, payload, async () => {
      const learner = await partnerQueries.resolveExternalLearner(
        this.db,
        organisationId,
        payload.externalLearnerId,
      );
      if (!learner) {
        throw new NotFoundException(
          `External learner "${payload.externalLearnerId}" is not linked to your organisation.`,
        );
      }

      const clientSyncId = deriveUuid(
        `partner-rubric:${organisationId}:${payload.externalLearnerId}:${payload.externalEvaluationId}`,
      );
      const actorForIngestion: AuthUser = {
        ...user,
        role: 'MENTOR',
        organisationId,
      };

      const sealed = await this.evidence.syncRubric(actorForIngestion, {
        clientSyncId,
        mentorId: user.id,
        cohortId: deriveUuid(`partner-cohort:${organisationId}`),
        learnerId: learner.learnerId,
        artifactId: payload.artifactId,
        qualityScore: payload.qualityScore,
        overallComment: payload.overallComment,
        observedSignals: payload.observedSignals,
        capturedOfflineAt: payload.capturedAt ?? new Date().toISOString(),
      });

      const response = {
        externalLearnerId: learner.externalLearnerId,
        externalEvaluationId: payload.externalEvaluationId,
        learnerRef: learner.learnerRef,
        alreadySynced: sealed.alreadySynced,
        artifactId: sealed.artifactId,
        ledgerSeq: 'ledgerSeq' in sealed ? sealed.ledgerSeq : null,
      };

      if (!sealed.alreadySynced) {
        await this.enqueueAndDispatch(organisationId, 'rubric.recorded', response);
      }
      return response;
    });
  }

  async getLearnerIntelligence(user: AuthUser, externalLearnerId: string) {
    const organisationId = this.assertOrganisationId(user);
    const learner = await partnerQueries.resolveExternalLearner(
      this.db,
      organisationId,
      externalLearnerId,
    );
    if (!learner) {
      throw new NotFoundException(
        `External learner "${externalLearnerId}" is not linked to your organisation.`,
      );
    }

    const [skillScores, pathwayAffinities] = await Promise.all([
      this.skills.computeAll(learner.learnerId),
      this.pathways.affinities(learner.learnerId),
    ]);

    const webOrigin = this.getWebOrigin();

    await governanceQueries
      .logActivity(this.db, {
        actorId: user.id,
        actorRole: user.role,
        organisationId,
        actionType: 'PARTNER_INTELLIGENCE_READ',
        resourceDomain: 'INTELLIGENCE_CORE',
        classificationAccessed: 'TIER_2_INTERNAL',
        recordsReturned: 1,
        maskingApplied: true,
        outcome: 'ALLOWED',
        metadata: { externalLearnerId },
      })
      .catch(() => null);

    return {
      externalLearnerId: learner.externalLearnerId,
      learnerRef: learner.learnerRef,
      learnerStage: learner.learnerStage,
      learningGoal: learner.learningGoal,
      consentStatus: learner.consentStatus,
      declaredInterests: learner.declaredInterests,
      portfolioUrl: learner.publicShareToken ? `${webOrigin}/p/${learner.publicShareToken}` : null,
      embedUrl: learner.publicShareToken ? `${webOrigin}/embed/portfolio/${learner.publicShareToken}` : null,
      skills: skillScores.map((s) => ({
        code: s.code,
        score: Number(s.score.toFixed(4)),
        progression: s.progression,
        evidenceCount: s.evidenceCount,
      })),
      pathways: pathwayAffinities.slice(0, 8),
    };
  }

  async generateLearnerReport(user: AuthUser, externalLearnerId: string) {
    const organisationId = this.assertOrganisationId(user);
    const learner = await partnerQueries.resolveExternalLearner(
      this.db,
      organisationId,
      externalLearnerId,
    );
    if (!learner) {
      throw new NotFoundException(
        `External learner "${externalLearnerId}" is not linked to your organisation.`,
      );
    }
    const report = await this.reports.generate(learner.learnerId);
    const response = {
      externalLearnerId: learner.externalLearnerId,
      learnerRef: learner.learnerRef,
      reportId: report.id,
      version: report.version,
      generatedAt: report.generatedAt,
      synthesisModel: report.synthesisModel,
      report,
    };

    await this.enqueueAndDispatch(organisationId, 'report.generated', {
      externalLearnerId: learner.externalLearnerId,
      learnerRef: learner.learnerRef,
      reportId: report.id,
      version: report.version,
      generatedAt: report.generatedAt,
    });

    return response;
  }

  async registerWebhook(
    user: AuthUser,
    payload: { url: string; description?: string; events: string[] },
  ) {
    const organisationId = this.assertOrganisationId(user);
    this.validateWebhookUrl(payload.url);

    const endpoint = await partnerQueries.registerWebhookEndpoint(this.db, {
      organisationId,
      createdByKeyId: user.apiKeyId ?? null,
      url: payload.url,
      description: payload.description,
      events: payload.events,
      encryptionKey: this.getEncryptionKey(),
    });

    await governanceQueries
      .logActivity(this.db, {
        actorId: user.id,
        actorRole: user.role,
        organisationId,
        actionType: 'PARTNER_WEBHOOK_REGISTERED',
        resourceDomain: 'CORE_IDENTITY',
        classificationAccessed: 'TIER_4_RESTRICTED_MINOR_SECRETS',
        recordsReturned: 1,
        maskingApplied: true,
        outcome: 'CREATED',
        metadata: { endpointId: endpoint.id, events: endpoint.events },
      })
      .catch(() => null);

    return endpoint;
  }

  async listWebhooks(user: AuthUser) {
    const organisationId = this.assertOrganisationId(user);
    return partnerQueries.listWebhookEndpoints(this.db, organisationId);
  }

  async listCohorts(user: AuthUser) {
    const organisationId = this.assertOrganisationId(user);
    return partnerQueries.listCohorts(this.db, organisationId);
  }

  async deleteWebhook(user: AuthUser, endpointId: string) {
    const organisationId = this.assertOrganisationId(user);
    const res = await partnerQueries.deleteWebhookEndpoint(this.db, organisationId, endpointId);
    if (res.status === 'not_found') {
      throw new NotFoundException('Webhook endpoint not found for this organisation.');
    }
    return res;
  }
}

