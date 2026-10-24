/**
 * Domain events for BullMQ cross-boundary communication.
 * platform-modules and intelligence-core talk ONLY through these queues (headless IP isolation).
 */
export const SPARKTRACK_EVENTS = {
  EVIDENCE_SEALED: 'evidence.sealed',
  REPORT_REQUESTED: 'report.requested',
  LEARNER_ONBOARDED: 'learner.onboarded',
} as const;

export const SPARKTRACK_QUEUES = {
  INTELLIGENCE_PIPELINE: 'intelligence-pipeline',
  REPORT_GENERATION: 'report-generation',
} as const;

export interface EvidenceSealedEvent {
  artifactId: string;
  learnerId: string;
  ledgerSeq: number;
}

