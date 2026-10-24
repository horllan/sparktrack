import { describe, expect, it } from 'vitest';
import { canonicalJson, sha256Hex } from './queries.js';

describe('@sparktrack/db cryptographic ledger helpers', () => {
  it('canonicalJson produces identical hashes regardless of key order', () => {
    const a = canonicalJson({ b: 2, a: 1, nested: { y: true, x: false } });
    const b = canonicalJson({ a: 1, nested: { x: false, y: true }, b: 2 });
    expect(a).toBe(b);
    expect(sha256Hex(a)).toBe(sha256Hex(b));
    expect(sha256Hex(a)).toHaveLength(64);
  });
});

