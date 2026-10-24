import { describe, expect, it } from 'vitest';
import { mapToProgression, normaliseScore, rawSkillScore, type EvidenceItem } from './skill-math';

const now = new Date('2026-12-01T00:00:00Z');
const item = (over: Partial<EvidenceItem> = {}): EvidenceItem => ({
  id: 'a', artifactType: 'PROJECT_SUBMISSION', quality: 0.9, complexity: 1, mentorVerified: true,
  capturedAt: now, ...over,
});

describe('skill math', () => {
  it('weights mentor-verified evidence higher', () => {
    expect(rawSkillScore([item()], now)).toBeGreaterThan(rawSkillScore([item({ mentorVerified: false })], now));
  });
  it('decays older evidence', () => {
    const old = item({ capturedAt: new Date('2026-01-01T00:00:00Z') });
    expect(rawSkillScore([old], now)).toBeLessThan(rawSkillScore([item()], now));
  });
  it('never decays future-dated evidence above its fresh value', () => {
    const future = item({ capturedAt: new Date('2027-01-01T00:00:00Z') });
    expect(rawSkillScore([future], now)).toBeCloseTo(rawSkillScore([item()], now));
  });
  it('normalises into [0,1]', () => {
    expect(normaliseScore(0)).toBe(0);
    expect(normaliseScore(10)).toBeGreaterThan(0.99);
    expect(normaliseScore(10)).toBeLessThan(1);
    expect(normaliseScore(1000)).toBeLessThanOrEqual(1);
  });
  it('rewards breadth of evidence', () => {
    const one = normaliseScore(rawSkillScore([item()], now));
    const three = normaliseScore(rawSkillScore([item(), item(), item()], now));
    expect(three).toBeGreaterThan(one);
  });
  it('maps score to progression bands', () => {
    expect(mapToProgression(0.1)).toBe('BEGINNER');
    expect(mapToProgression(0.3)).toBe('DEVELOPING');
    expect(mapToProgression(0.55)).toBe('COMPETENT');
    expect(mapToProgression(0.8)).toBe('ADVANCED');
  });
});

