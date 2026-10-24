import { createHash } from 'node:crypto';

/** Deterministic UUID (v5-style layout) derived from a seed, used for idempotent child-row ids. */
export function deriveUuid(seed: string): string {
  const h = createHash('sha256').update(seed).digest('hex').slice(0, 32).split('');
  h[12] = '5';
  h[16] = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  const s = h.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

