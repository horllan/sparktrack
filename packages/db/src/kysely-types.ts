import type { Generated } from 'kysely';

/**
 * Minimal Kysely table typing. Advanced queries use `sql` templates with explicit row types,
 * so only tables touched through the query builder are declared here.
 */
export interface EvidenceArtifacts {
  id: Generated<string>;
  client_sync_id: string;
  learner_id: string;
  artifact_type: string;
  title: string;
  quality_score: number | null;
  complexity_weight: number;
  mentor_verifier_id: string | null;
  captured_offline_at: Date;
}
export interface EvidenceCryptographicLedger {
  ledger_seq: Generated<number>;
  artifact_id: string;
  learner_id: string;
  verifier_id: string | null;
  payload_canonical_hash: string;
  previous_ledger_hash: Generated<string>;
  row_signature_hash: Generated<string>;
  sealed_at: Generated<Date>;
}
export interface SparkTrackDatabase {
  'evidence.artifacts': EvidenceArtifacts;
  'evidence.cryptographic_ledger': EvidenceCryptographicLedger;
}

