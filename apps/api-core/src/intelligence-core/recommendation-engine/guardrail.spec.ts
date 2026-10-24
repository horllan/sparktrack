import { describe, expect, it } from 'vitest';
import { checkGuardrail } from './guardrail';

describe('non-deterministic guardrail', () => {
  it('rejects deterministic career assignment', () => {
    const r = checkGuardrail({ s1: 'You are going to become a cybersecurity engineer. Exploration is nice.' });
    expect(r.passed).toBe(false);
    expect(r.deterministicViolations[0]?.sectionKey).toBe('s1');
  });
  it.each([
    'You should be a software engineer.',
    'Your career is in robotics.',
    'You are destined to build things.',
    'You are a natural programmer.',
    'You are not cut out for design.',
  ])('rejects: %s', (t) => {
    expect(checkGuardrail({ s: `${t} exploring exploring exploring` }).passed).toBe(false);
  });
  it('requires exploration framing', () => {
    expect(checkGuardrail({ s: 'Python scores were high.' }).passed).toBe(false);
  });
  it('passes exploration framing without violations', () => {
    const r = checkGuardrail({
      s: 'Current evidence shows growing signals in analytical problem-solving. Cybersecurity is one pathway worth exploring further.',
    });
    expect(r.passed).toBe(true);
    expect(r.deterministicViolations).toHaveLength(0);
  });
});

