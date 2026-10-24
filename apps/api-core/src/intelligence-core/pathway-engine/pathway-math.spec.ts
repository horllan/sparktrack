import { describe, expect, it } from 'vitest';
import { computeAffinities, type GraphEdgeRow } from './pathway-math';

const e = (s: string, st: string, t: string, tt: string, w: number, rel: string, req = false): GraphEdgeRow => ({
  source_id: s, source_code: s, source_name: s, source_type: st,
  target_id: t, target_code: t, target_name: t, target_type: tt,
  weight: w, is_required: req, relationship_type: rel,
});

// Subset of migrations 0002 + 0004
const edges: GraphEdgeRow[] = [
  e('SKILL_PYTHON_PROG', 'SKILL', 'CAP_SOFTWARE_ENG', 'CAPABILITY', 0.85, 'BUILDS_CAPABILITY', true),
  e('SKILL_DEBUGGING_LOGIC', 'SKILL', 'CAP_SOFTWARE_ENG', 'CAPABILITY', 0.8, 'BUILDS_CAPABILITY', true),
  e('SKILL_DEBUGGING_LOGIC', 'SKILL', 'CAP_SECURITY_INV', 'CAPABILITY', 0.9, 'BUILDS_CAPABILITY', true),
  e('SKILL_CYBER_FUND', 'SKILL', 'CAP_SECURITY_INV', 'CAPABILITY', 0.95, 'BUILDS_CAPABILITY', true),
  e('SKILL_UI_UX_DESIGN', 'SKILL', 'CAP_TECH_PRODUCT', 'CAPABILITY', 0.9, 'BUILDS_CAPABILITY', true),
  e('SKILL_GRAPHIC_DESIGN', 'SKILL', 'CAP_TECH_PRODUCT', 'CAPABILITY', 0.75, 'BUILDS_CAPABILITY'),
  e('CAP_SOFTWARE_ENG', 'CAPABILITY', 'PATH_SOFTWARE_AI', 'CAREER_PATHWAY', 0.88, 'UNLOCKS_PATHWAY', true),
  e('CAP_SECURITY_INV', 'CAPABILITY', 'PATH_CYBERSECURITY', 'CAREER_PATHWAY', 0.9, 'UNLOCKS_PATHWAY', true),
  e('SKILL_ROBOTICS_IOT', 'SKILL', 'PATH_ROBOTICS_ENG', 'CAREER_PATHWAY', 0.9, 'UNLOCKS_PATHWAY', true),
  e('CAP_TECH_PRODUCT', 'CAPABILITY', 'PATH_PRODUCT_DESIGN', 'CAREER_PATHWAY', 0.95, 'UNLOCKS_PATHWAY', true),
];

describe('pathway affinity: 13-year-old explorer', () => {
  const skills = new Map([
    ['SKILL_PYTHON_PROG', 0.9], ['SKILL_DEBUGGING_LOGIC', 0.85], ['SKILL_CYBER_FUND', 0.92],
    ['SKILL_ROBOTICS_IOT', 0.9], ['SKILL_GRAPHIC_DESIGN', 0.58],
  ]);
  const res = computeAffinities({ edges, skillScores: skills, declaredInterests: ['Graphic Design'] });
  const by = Object.fromEntries(res.map((r) => [r.pathwayCode, r]));

  it('surfaces technical pathways with divergence from declared design interest', () => {
    for (const c of ['PATH_SOFTWARE_AI', 'PATH_CYBERSECURITY', 'PATH_ROBOTICS_ENG']) {
      expect(by[c]!.affinityScore).toBeGreaterThan(0.6);
      expect(by[c]!.isDivergentFromDeclared).toBe(true);
    }
  });
  it('keeps product design visible and non-divergent, with missing required skill flagged', () => {
    expect(by.PATH_PRODUCT_DESIGN!.isDivergentFromDeclared).toBe(false);
    expect(by.PATH_PRODUCT_DESIGN!.affinityScore).toBeGreaterThan(0.2);
    expect(by.PATH_PRODUCT_DESIGN!.affinityScore).toBeLessThan(by.PATH_SOFTWARE_AI!.affinityScore);
  });
});

