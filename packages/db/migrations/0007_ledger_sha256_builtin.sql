-- ============================================================================
-- SPARKTRACK: Built-in pg_catalog.sha256() for Ledger Sealing
-- Migration: 0007_ledger_sha256_builtin.sql
-- Ensures fn_seal_ledger_entry works regardless of which schema pgcrypto lives in.
-- ============================================================================

CREATE OR REPLACE FUNCTION evidence.fn_seal_ledger_entry()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = evidence, public, extensions, pg_temp AS $$
DECLARE v_prev_hash TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('sparktrack_ledger_seal'));
  SELECT row_signature_hash INTO v_prev_hash
  FROM evidence.cryptographic_ledger ORDER BY ledger_seq DESC LIMIT 1;
  IF v_prev_hash IS NULL THEN v_prev_hash := 'SPARKTRACK_GENESIS_BLOCK_2026'; END IF;
  NEW.previous_ledger_hash := v_prev_hash;
  NEW.row_signature_hash := encode(
    sha256(convert_to(v_prev_hash || '|' || NEW.artifact_id::text || '|' || NEW.learner_id::text || '|' || NEW.payload_canonical_hash, 'UTF8')),
    'hex');
  RETURN NEW;
END; $$;

