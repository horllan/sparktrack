import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Kysely } from 'kysely';
import { evidenceReadQueries, reportQueries } from '@sparktrack/db';
import type { SparkTrackDatabase } from '@sparktrack/db';
import type { PathwayAffinity, ReportSection } from '@sparktrack/contracts';
import { KYSELY } from '../../common/database/database.module';
import { SkillEngineService, type ComputedSkill } from '../skill-engine/skill-engine.service';
import { PathwayEngineService } from '../pathway-engine/pathway-engine.service';
import { checkGuardrail } from './guardrail';

export const REPORT_SECTIONS = [
  { key: 'executiveSummary', title: 'Executive Summary' },
  { key: 'participationHistory', title: 'Programme Participation History' },
  { key: 'declaredVsObserved', title: 'Declared Interests vs Observed Strengths' },
  { key: 'technicalSkills', title: 'Technical & Digital Skills' },
  { key: 'creativeSkills', title: 'Creative & Design Skills' },
  { key: 'businessSkills', title: 'Business & Entrepreneurship Skills' },
  { key: 'behaviouralSignals', title: 'Behavioural Signals & Developmental Indicators' },
  { key: 'capabilityMaturity', title: 'Capability Maturity' },
  { key: 'careerPathways', title: 'Career Pathway Exploration Map' },
  { key: 'entrepreneurshipPathways', title: 'Entrepreneurship Pathway Exploration Map' },
  { key: 'longitudinalProgress', title: 'Longitudinal Progress' },
  { key: 'recommendedNextSteps', title: 'Recommended Next Steps & Exploration Areas' },
  { key: 'mentorInsights', title: 'Mentor Observations' },
] as const;

export type ReportSectionKey = (typeof REPORT_SECTIONS)[number]['key'];

const SYSTEM_PROMPT = `You write development reports about young people (ages 10-17) for parents and mentors.
HARD RULES:
- Frame everything as career EXPLORATION and uncertainty reduction. Never assign or predict a career or identity.
- Never write "you will become", "you should be", "your career is", "destined", "meant to", "natural", "not cut out for".
- Treat behavioural indicators as evolving developmental signals, never permanent traits.
- Use phrases like "current evidence shows", "growing signals", "worth exploring further", "one pathway to explore".
- Be encouraging and specific, and mention uncertainty where evidence is limited.
- Use only the supplied data. Do not invent facts. Do not mention names.
Return ONLY JSON: {"sections": {"<key>": "<narrative>", ...}} containing exactly the requested keys.`;

/** Recommendation Engine — Gemini synthesis of the 13-part report behind the child-safety guardrail. */
@Injectable()
export class RecommendationEngineService {
  private readonly logger = new Logger(RecommendationEngineService.name);

  constructor(
    @Inject(KYSELY) private readonly db: Kysely<SparkTrackDatabase>,
    private readonly config: ConfigService,
    private readonly skills: SkillEngineService,
    private readonly pathways: PathwayEngineService,
  ) {}

  async generate(learnerId: string) {
    const ctx = await evidenceReadQueries.learnerContext(this.db, learnerId);
    if (!ctx || ctx.consent_status !== 'VERIFIED_ACTIVE') throw new Error('Consent not verified');
    const snapshotAt = new Date();
    const [skills, affinities, signals] = await Promise.all([
      this.skills.computeAll(learnerId, snapshotAt), this.pathways.affinities(learnerId),
      evidenceReadQueries.signalsForLearner(this.db, learnerId),
    ]);
    const facts = this.buildFacts(ctx, skills, affinities, signals);

    const model = this.config.get<string>('GEMINI_SYNTHESIS_ADVISOR_MODEL') ?? 'gemini-flash-latest';
    let narratives: Record<string, string> | null = null;
    let used = model;
    for (let attempt = 0; attempt < 2 && !narratives; attempt++) {
      const candidate = await this.callGemini(model, facts, attempt > 0).catch((e) => {
        this.logger.warn(`Gemini attempt ${attempt + 1} failed: ${e instanceof Error ? e.message : e}`);
        return null;
      });
      if (candidate && checkGuardrail(candidate).passed) narratives = candidate;
    }
    if (!narratives) { narratives = this.templateNarratives(facts); used = 'deterministic-template'; }

    const guardrail = checkGuardrail(narratives);
    const section = (key: string, title: string): ReportSection => ({ key, title, narrative: narratives![key] ?? '' });
    const sections = Object.fromEntries(
      REPORT_SECTIONS.map((s) => [s.key, section(s.key, s.title)]),
    ) as Record<ReportSectionKey, ReportSection>;
    const report = {
      learnerId, generatedAt: snapshotAt.toISOString(), profileSnapshotAt: snapshotAt.toISOString(),
      ...sections, skillScores: skills, pathwayAffinities: affinities, guardrailResult: guardrail, synthesisModel: used,
    };
    const saved = await reportQueries.save(this.db, { learnerId, snapshotAt, report, guardrailPassed: guardrail.passed, model: used });
    return { id: saved.id, version: saved.version, ...report };
  }

  latest(learnerId: string) { return reportQueries.latest(this.db, learnerId); }

  /** Data minimisation: no names, DOB or school are sent to the model, only age band and aggregates. */
  private buildFacts(ctx: { declared_interests: string[]; date_of_birth: string; education_stage: string },
    skills: ComputedSkill[], affinities: PathwayAffinity[], signals: Array<{ signal: string; averageIntensity: number; observationCount: number }>) {
    const age = Math.floor((Date.now() - new Date(ctx.date_of_birth).getTime()) / 3.156e10);
    return {
      ageBand: `${Math.floor(age / 2) * 2}-${Math.floor(age / 2) * 2 + 1}`, educationStage: ctx.education_stage,
      declaredInterests: ctx.declared_interests,
      skills: skills.map((s) => ({ skill: s.code, level: s.progression, score: Number(s.score.toFixed(2)), evidenceCount: s.evidenceCount })),
      pathways: affinities.slice(0, 6).map((a) => ({ pathway: a.pathwayName, type: a.pathwayType, affinity: a.affinityScore,
        differsFromDeclaredInterests: a.isDivergentFromDeclared, missingRequiredSkills: a.missingSkills.map((m) => m.nodeName) })),
      behaviouralSignals: signals,
    };
  }

  private async callGemini(modelName: string, facts: object, strict: boolean): Promise<Record<string, string>> {
    const apiKey =
      this.config.get<string>('GOOGLE_GENERATIVE_AI_API_KEY') ??
      this.config.get<string>('GOOGLE_API_KEY');
    if (!apiKey || apiKey.includes('your-')) {
      throw new Error('Neither GOOGLE_GENERATIVE_AI_API_KEY nor GOOGLE_API_KEY is configured.');
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName, systemInstruction: SYSTEM_PROMPT,
      generationConfig: { responseMimeType: 'application/json', temperature: strict ? 0.2 : 0.6 },
    });
    const prompt = `Keys required: ${REPORT_SECTIONS.map((s) => s.key).join(', ')}\n` +
      (strict ? 'A previous draft violated the exploration-only rules. Be strictly exploratory.\n' : '') +
      `Data:\n${JSON.stringify(facts)}`;
    const res = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }, { timeout: 12000 });
    const parsed = JSON.parse(res.response.text()) as { sections?: Record<string, unknown> };
    const out: Record<string, string> = {};
    for (const s of REPORT_SECTIONS) {
      const v = parsed.sections?.[s.key];
      if (typeof v !== 'string' || !v.trim()) throw new Error(`Missing section ${s.key}`);
      out[s.key] = v;
    }
    return out;
  }

  /** Safe fallback (also used when Gemini is unavailable or quota-limited). */
  private templateNarratives(f: ReturnType<RecommendationEngineService['buildFacts']>): Record<string, string> {
    const top = f.skills.slice(0, 3).map((s) => s.skill.replace(/^SKILL_|^SIG_/, '').replace(/_/g, ' ').toLowerCase());
    const paths = f.pathways.slice(0, 3).map((p) => p.pathway);
    const divergent = f.pathways.filter((p) => p.differsFromDeclaredInterests).map((p) => p.pathway);
    const topTxt = top.length ? top.join(', ') : 'a range of early skills';
    const pathTxt = paths.length ? paths.join('; ') : 'several pathways';
    const base = (extra: string) => `Current evidence shows growing signals in ${topTxt}. ${extra}`;
    const out: Record<string, string> = {};
    for (const s of REPORT_SECTIONS) out[s.key] = base('These are developmental signals that can change as more evidence is gathered.');
    out.declaredVsObserved = base(
      divergent.length
        ? `The learner's stated interests (${f.declaredInterests.join(', ') || 'not yet declared'}) differ from where evidence is strongest. ${divergent.join('; ')} may be worth exploring alongside existing interests.`
        : 'Stated interests and observed strengths are currently aligned, which is worth exploring further.');
    out.careerPathways = base(`Pathways worth exploring further include: ${pathTxt}. These are options to explore, not predictions.`);
    out.recommendedNextSteps = base(`One next step is a short exploratory project in an area from: ${pathTxt}.`);
    return out;
  }
}

