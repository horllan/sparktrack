import type { NonDeterministicGuardrailResult } from '@sparktrack/contracts';

/**
 * Child-Safety Non-Deterministic Guardrail.
 * Rejects deterministic career assignment / discouragement; requires exploration framing.
 */
const FORBIDDEN: Array<{ re: RegExp; label: string }> = [
  { re: /\byou(?:'re|\s+are)?\s+(?:going to|gonna|will)\s+(?:become|be)\b/i, label: 'you will become/be' },
  { re: /\byou\s+should\s+(?:be|become)\s+(?:a|an)\b/i, label: 'you should be a' },
  { re: /\byour\s+(?:future\s+)?career\s+(?:is|will be)\b/i, label: 'your career is' },
  { re: /\b(?:destined|meant|born)\s+to\b/i, label: 'destined/meant/born to' },
  { re: /\byou(?:'re|\s+are)\s+(?:a|an)\s+(?:natural|born)\b/i, label: 'you are a natural/born' },
  { re: /\bnot\s+cut\s+out\s+for\b/i, label: 'not cut out for' },
  { re: /\bshould\s+not\s+(?:pursue|consider)\b/i, label: 'should not pursue' },
  { re: /\bthe\s+(?:best|only|right)\s+(?:career|path|pathway)\s+for\s+you\b/i, label: 'best/only career for you' },
];

const EXPLORATION: RegExp[] = [
  /\bexplor(?:e|ing|ation)\b/gi,
  /\bgrowing\s+signals?\b/gi,
  /\bcurrent\s+evidence\s+(?:shows|suggests)\b/gi,
  /\bemerging\s+(?:strength|interest)s?\b/gi,
  /\bworth\s+exploring\b/gi,
];

export const MIN_EXPLORATION_PHRASES = 3;

export function checkGuardrail(sections: Record<string, string>): NonDeterministicGuardrailResult {
  const violations: NonDeterministicGuardrailResult['deterministicViolations'] = [];
  let exploration = 0;
  for (const [key, text] of Object.entries(sections)) {
    for (const f of FORBIDDEN) {
      const m = text.match(f.re);
      if (m) violations.push({ phrase: m[0], sectionKey: key, severity: 'CRITICAL' });
    }
    for (const re of EXPLORATION) exploration += text.match(re)?.length ?? 0;
  }
  return {
    passed: violations.length === 0 && exploration >= MIN_EXPLORATION_PHRASES,
    deterministicViolations: violations,
    explorationLanguageCount: exploration,
    minimumRequired: MIN_EXPLORATION_PHRASES,
  };
}

