import type { PathwayAffinity, ProgressionLevel } from '@sparktrack/contracts';

export interface GraphEdgeRow {
  source_id: string; source_code: string; source_name: string; source_type: string;
  target_id: string; target_code: string; target_name: string; target_type: string;
  weight: number; is_required: boolean; relationship_type: string;
}

/** Keywords used to match a learner's declared interests to a pathway (case-insensitive substring). */
export const PATHWAY_INTEREST_KEYWORDS: Record<string, string[]> = {
  PATH_CYBERSECURITY: ['cyber', 'security', 'hacking', 'network'],
  PATH_SOFTWARE_AI: ['cod', 'program', 'software', 'python', 'web', 'ai', 'data', 'app'],
  PATH_ROBOTICS_ENG: ['robot', 'electronic', 'iot', 'embedded', 'engineering'],
  PATH_PRODUCT_DESIGN: ['design', 'ui', 'ux', 'figma', 'graphic', 'product'],
  PATH_TECH_FOUNDER: ['business', 'entrepreneur', 'startup', 'founder', 'sell', 'market'],
};

export const DIVERGENCE_AFFINITY_THRESHOLD = 0.4;

/**
 * Capability score = weighted mean of BUILDS_CAPABILITY inputs (missing inputs count as 0, so breadth matters),
 * modestly lifted by behavioural amplifiers. Result is clamped to [0,1].
 */
export function computeCapabilityScores(edges: GraphEdgeRow[], skillScores: Map<string, number>): Map<string, number> {
  const caps = new Map<string, number>();
  const byCap = new Map<string, GraphEdgeRow[]>();
  for (const e of edges) {
    if (e.target_type !== 'CAPABILITY') continue;
    byCap.set(e.target_code, [...(byCap.get(e.target_code) ?? []), e]);
  }
  for (const [code, es] of byCap) {
    const builds = es.filter((e) => e.relationship_type === 'BUILDS_CAPABILITY');
    const amps = es.filter((e) => e.relationship_type === 'AMPLIFIES_CAPABILITY');
    const totalW = builds.reduce((s, e) => s + e.weight, 0);
    if (totalW === 0) continue;
    const base = builds.reduce((s, e) => s + e.weight * (skillScores.get(e.source_code) ?? 0), 0) / totalW;
    const lift = amps.reduce((s, e) => s + e.weight * (skillScores.get(e.source_code) ?? 0), 0);
    caps.set(code, Math.min(1, base * (1 + lift / 2)));
  }
  return caps;
}

export function computeAffinities(p: {
  edges: GraphEdgeRow[];
  skillScores: Map<string, number>;
  declaredInterests: string[];
}): PathwayAffinity[] {
  const caps = computeCapabilityScores(p.edges, p.skillScores);
  const nodeScore = (code: string) => caps.get(code) ?? p.skillScores.get(code) ?? 0;
  const declared = p.declaredInterests.map((i) => i.toLowerCase());
  const byPath = new Map<string, GraphEdgeRow[]>();
  for (const e of p.edges) {
    if (e.relationship_type !== 'UNLOCKS_PATHWAY') continue;
    byPath.set(e.target_code, [...(byPath.get(e.target_code) ?? []), e]);
  }
  const out: PathwayAffinity[] = [];
  for (const [code, es] of byPath) {
    const first = es[0]!;
    const totalW = es.reduce((s, e) => s + e.weight, 0);
    const affinity = es.reduce((s, e) => s + e.weight * nodeScore(e.source_code), 0) / totalW;
    const keywords = PATHWAY_INTEREST_KEYWORDS[code] ?? [];
    const declaredMatch = declared.some((d) => keywords.some((k) => d.includes(k)));
    out.push({
      pathwayNodeId: first.target_id,
      pathwayCode: code,
      pathwayName: first.target_name,
      pathwayType: first.target_type === 'ENTREPRENEURSHIP_PATHWAY' ? 'ENTREPRENEURSHIP_PATHWAY' : 'CAREER_PATHWAY',
      affinityScore: Number(Math.min(1, affinity).toFixed(4)),
      contributingSkills: es
        .filter((e) => nodeScore(e.source_code) > 0)
        .map((e) => ({ nodeCode: e.source_code, nodeName: e.source_name, score: nodeScore(e.source_code), contributionWeight: e.weight })),
      missingSkills: es
        .filter((e) => e.is_required && nodeScore(e.source_code) < 0.3)
        .map((e) => ({ nodeCode: e.source_code, nodeName: e.source_name, isRequired: true })),
      isDivergentFromDeclared: affinity >= DIVERGENCE_AFFINITY_THRESHOLD && !declaredMatch,
    });
  }
  return out.sort((a, b) => b.affinityScore - a.affinityScore);
}

export type { ProgressionLevel };

