import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { Kysely } from 'kysely';
import { discoverAndRedactPii, evidenceReadQueries, governanceQueries, ledgerQueries, rubricQueries } from '@sparktrack/db';
import type { SparkTrackDatabase } from '@sparktrack/db';
import type { EvidenceSyncPayload, MentorMicroRubric } from '@sparktrack/contracts';
import { KYSELY } from '../../common/database/database.module';
import { SPARKTRACK_EVENTS, SPARKTRACK_QUEUES, type EvidenceSealedEvent } from '../../common/events/event-names';
import { LearnerAccessService, type AuthUser } from '../../common/auth/auth.guard';
import { deriveUuid } from '../../common/util/derive-uuid';
import { SkillEngineService } from '../skill-engine/skill-engine.service';
import { ProgressEngineService } from '../progress-engine/progress-engine.service';

/**
 * Evidence Engine — idempotent ingestion + SHA-256 ledger sealing.
 * Trust rules: learners can never self-assign quality scores or mentor verification.
 */
@Injectable()
export class EvidenceEngineService {
  private readonly logger = new Logger(EvidenceEngineService.name);

  constructor(
    @Inject(KYSELY) private readonly db: Kysely<SparkTrackDatabase>,
    @InjectQueue(SPARKTRACK_QUEUES.INTELLIGENCE_PIPELINE) private readonly pipeline: Queue,
    private readonly access: LearnerAccessService,
    private readonly skills: SkillEngineService,
    private readonly progress: ProgressEngineService,
  ) {}

  private async assertActiveConsent(learnerId: string) {
    const ctx = await evidenceReadQueries.learnerContext(this.db, learnerId);
    if (!ctx || ctx.consent_status !== 'VERIFIED_ACTIVE') {
      throw new ForbiddenException('Verified parental consent is required before evidence can be recorded.');
    }
  }

  private async emitSealed(e: EvidenceSealedEvent) {
    // Immediate bitemporal recompute guarantees deterministic consistency even when Redis is offline.
    const computed = await this.skills.computeAll(e.learnerId);
    await this.progress.applySkills(e.learnerId, computed);

    await this.pipeline
      .add(SPARKTRACK_EVENTS.EVIDENCE_SEALED, e, {
        removeOnComplete: true,
        removeOnFail: 100,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      })
      .catch((err) => {
        this.logger.debug(`BullMQ enqueue skipped (inline recompute already applied): ${err instanceof Error ? err.message : err}`);
      });
  }

  async syncEvidence(user: AuthUser, p: EvidenceSyncPayload) {
    await this.access.assertCanAccess(user, p.learnerId);
    await this.assertActiveConsent(p.learnerId);

    const isMentor = user.role === 'MENTOR';
    const privileged = isMentor || user.role === 'SUPER_ADMIN';
    const dlpScan = discoverAndRedactPii(p.description);
    if (dlpScan.findings.length > 0) {
      await governanceQueries
        .logActivity(this.db, {
          actorId: user.id,
          actorRole: user.role,
          organisationId: user.organisationId,
          actionType: 'EVIDENCE_UNSTRUCTURED_PII_REDACTION',
          resourceDomain: 'EVIDENCE_VAULT',
          classificationAccessed: 'TIER_3_CONFIDENTIAL_PII',
          recordsReturned: 1,
          maskingApplied: true,
          outcome: 'PII_DISCOVERY_REDACTED',
          metadata: { findings: dlpScan.findings, clientSyncId: p.clientSyncId },
        })
        .catch(() => null);
    }

    const result = await ledgerQueries.syncAndSeal(this.db, {
      clientSyncId: p.clientSyncId,
      learnerId: p.learnerId,
      programmeCohortId: p.programmeCohortId,
      activityNodeId: p.activityNodeId,
      artifactType: p.artifactType,
      title: p.title,
      description: dlpScan.findings.length > 0 ? dlpScan.sanitizedText : p.description,
      storageR2Keys: p.storageR2Keys,
      externalUrls: p.externalUrls,
      payload: p.payload,
      mentorVerifierId: isMentor ? user.id : undefined, // never trust a client-supplied verifier
      qualityScore: privileged ? p.qualityScore : undefined, // learners cannot self-score
      complexityWeight: privileged ? p.complexityWeight : 1.0,
      capturedOfflineAt: new Date(p.capturedOfflineAt),
    });
    if (!result.alreadySynced) {
      await this.emitSealed({ artifactId: result.artifactId, learnerId: p.learnerId, ledgerSeq: result.ledgerSeq });
      this.logger.log(`sealed artifact=${result.artifactId} seq=${result.ledgerSeq}`);
    }
    return result;
  }

  /**
   * Mentor micro-rubric. Recorded as a NEW sealed MENTOR_OBSERVATION artifact (the ledger stays append-only
   * and earlier hashes are never invalidated) plus per-signal rows for behavioural aggregation.
   */
  async syncRubric(user: AuthUser, r: MentorMicroRubric) {
    await this.access.assertCanAccess(user, r.learnerId);
    await this.assertActiveConsent(r.learnerId);
    const skillCodes = r.artifactId ? await rubricQueries.artifactSkillCodes(this.db, r.artifactId, r.learnerId) : [];
    const capturedAt = new Date(r.capturedOfflineAt);
    const rubricDlp = discoverAndRedactPii(r.overallComment);
    if (rubricDlp.findings.length > 0) {
      await governanceQueries
        .logActivity(this.db, {
          actorId: user.id,
          actorRole: user.role,
          organisationId: user.organisationId,
          actionType: 'RUBRIC_UNSTRUCTURED_PII_REDACTION',
          resourceDomain: 'EVIDENCE_VAULT',
          classificationAccessed: 'TIER_3_CONFIDENTIAL_PII',
          recordsReturned: 1,
          maskingApplied: true,
          outcome: 'PII_DISCOVERY_REDACTED',
          metadata: { findings: rubricDlp.findings, clientSyncId: r.clientSyncId },
        })
        .catch(() => null);
    }

    const result = await ledgerQueries.syncAndSeal(this.db, {
      clientSyncId: r.clientSyncId,
      learnerId: r.learnerId,
      programmeCohortId: r.cohortId,
      activityNodeId: r.activityNodeId,
      artifactType: 'MENTOR_OBSERVATION',
      title: 'Mentor micro-rubric',
      description: rubricDlp.findings.length > 0 ? rubricDlp.sanitizedText : r.overallComment,
      storageR2Keys: [],
      externalUrls: [],
      payload: { schema_version: '1.0', rubric_for_artifact: r.artifactId ?? null, skill_codes: skillCodes },
      mentorVerifierId: user.id,
      qualityScore: r.qualityScore,
      complexityWeight: 1.0,
      capturedOfflineAt: capturedAt,
    });

    await rubricQueries.insertSignals(
      this.db,
      r.observedSignals.map((s) => ({
        id: deriveUuid(`${r.clientSyncId}:${s.signal}`),
        mentorId: user.id,
        learnerId: r.learnerId,
        artifactId: r.artifactId ?? null,
        cohortId: r.cohortId,
        signal: s.signal,
        intensity: s.intensity,
        note: s.note ?? null,
        capturedOfflineAt: capturedAt,
      })),
    );

    if (!result.alreadySynced) {
      await this.emitSealed({ artifactId: result.artifactId, learnerId: r.learnerId, ledgerSeq: result.ledgerSeq });
    } else {
      // Retry after a partial failure may have written signals only; still trigger a recompute.
      await this.emitSealed({ artifactId: '', learnerId: r.learnerId, ledgerSeq: 0 });
    }
    return result;
  }
}
