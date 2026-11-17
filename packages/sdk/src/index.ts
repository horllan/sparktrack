/**
 * @sparktrack/sdk — Zero-dependency client for the SparkTrack Partner Intelligence Gateway.
 * Compatible with Cloudflare Workers, Node.js 20+, Deno, and modern browsers.
 */

export interface SparkTrackClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface UpsertLearnerInput {
  externalLearnerId: string;
  fullName: string;
  ageGroup?: 'UNDER_18' | 'ADULT';
  dateOfBirth?: string;
  learnerStage?: string;
  educationStage?: string;
  educationLevel?: string;
  learningGoal?: string;
  declaredInterests?: string[];
  consentStatus?: 'PENDING_PARENTAL_CONSENT' | 'VERIFIED_ACTIVE' | 'RESTRICTED_INTERNAL_ONLY' | 'REVOKED';
  attestationMethod?:
    | 'ADULT_SELF_CONSENT'
    | 'GUARDIAN_WRITTEN_CONSENT'
    | 'GUARDIAN_DIGITAL_CONSENT'
    | 'INSTITUTIONAL_ENROLMENT_AGREEMENT'
    | 'CONSENT_WITHDRAWN';
  guardianName?: string;
  guardianContact?: string;
  evidenceReference?: string;
  allowPublicPortfolio?: boolean;
  allowPartnerTalentDiscovery?: boolean;
}

export interface SubmitEvidenceInput {
  externalLearnerId: string;
  externalSubmissionId: string;
  artifactType?:
    | 'PROJECT_SUBMISSION'
    | 'GIT_REPOSITORY'
    | 'DESIGN_PORTFOLIO'
    | 'ASSESSMENT_RESULT'
    | 'MENTOR_OBSERVATION'
    | 'COMPETITION_RESULT'
    | 'LEARNER_REFLECTION'
    | 'BUSINESS_PROTOTYPE';
  title: string;
  description?: string;
  skillCodes: string[];
  externalUrls?: string[];
  qualityScore?: number;
  complexityWeight?: number;
  capturedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface SubmitRubricInput {
  externalLearnerId: string;
  externalEvaluationId: string;
  artifactId?: string;
  qualityScore: number;
  overallComment?: string;
  observedSignals: Array<{
    signal: string;
    intensity: number;
    note?: string;
  }>;
  capturedAt?: string;
}

export interface RegisterWebhookInput {
  url: string;
  description?: string;
  events?: Array<'*' | 'learner.upserted' | 'evidence.sealed' | 'rubric.recorded' | 'report.generated'>;
}

export class SparkTrackApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'SparkTrackApiError';
  }
}

export class SparkTrackClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SparkTrackClientOptions) {
    if (!options.apiKey?.startsWith('spk_live_')) {
      throw new Error('SparkTrackClient requires a valid Enterprise API key (spk_live_...).');
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? 'https://api.sparktrack.africa/api').replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    const headers: Record<string, string> = {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
    };
    if (idempotencyKey) {
      headers['idempotency-key'] = idempotencyKey;
    }

    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const parsed = (await res.json().catch(() => null)) as { message?: string } | null;
    if (!res.ok) {
      throw new SparkTrackApiError(
        res.status,
        parsed?.message ?? `SparkTrack API error (${res.status})`,
        parsed,
      );
    }
    return parsed as T;
  }

  readonly learners = {
    upsert: (input: UpsertLearnerInput, idempotencyKey?: string) =>
      this.request<{
        externalLearnerId: string;
        learnerRef: string;
        created: boolean;
        consentStatus: string;
        allowPublicPortfolio: boolean;
        portfolioUrl: string | null;
        embedUrl: string | null;
      }>('POST', '/v1/partner/learners/upsert', input, idempotencyKey),
  };

  readonly evidence = {
    submit: (input: SubmitEvidenceInput, idempotencyKey?: string) =>
      this.request<{
        externalLearnerId: string;
        externalSubmissionId: string;
        learnerRef: string;
        alreadySynced: boolean;
        artifactId: string | null;
        ledgerSeq: number | null;
        rowSignatureHash: string | null;
        skillsUpdated: Array<{
          code: string;
          score: number;
          progression: string;
          evidenceCount: number;
        }>;
      }>('POST', '/v1/partner/evidence', input, idempotencyKey),
  };

  readonly rubrics = {
    submit: (input: SubmitRubricInput, idempotencyKey?: string) =>
      this.request<{
        externalLearnerId: string;
        externalEvaluationId: string;
        learnerRef: string;
        alreadySynced: boolean;
        artifactId: string | null;
        ledgerSeq: number | null;
      }>('POST', '/v1/partner/rubrics', input, idempotencyKey),
  };

  readonly intelligence = {
    get: (externalLearnerId: string) =>
      this.request<{
        externalLearnerId: string;
        learnerRef: string;
        learnerStage: string;
        learningGoal: string;
        consentStatus: string;
        declaredInterests: string[];
        portfolioUrl: string | null;
        embedUrl: string | null;
        skills: Array<{
          code: string;
          score: number;
          progression: string;
          evidenceCount: number;
          confidence: number;
        }>;
        pathways: Array<{
          pathwayCode: string;
          pathwayName: string;
          pathwayType: string;
          affinityScore: number;
          isDivergentFromDeclared: boolean;
        }>;
      }>('GET', `/v1/partner/learners/${encodeURIComponent(externalLearnerId)}/intelligence`),
  };

  readonly reports = {
    generate: (externalLearnerId: string) =>
      this.request<{
        externalLearnerId: string;
        learnerRef: string;
        reportId: string;
        version: number;
        generatedAt: string;
        synthesisModel: string;
        report: Record<string, unknown>;
      }>('POST', `/v1/partner/learners/${encodeURIComponent(externalLearnerId)}/report`),
  };

  readonly webhooks = {
    register: (input: RegisterWebhookInput) =>
      this.request<{
        id: string;
        url: string;
        events: string[];
        secret: string;
        secretPrefix: string;
        isActive: boolean;
        createdAt: string;
      }>('POST', '/v1/partner/webhooks', input),

    list: () =>
      this.request<
        Array<{
          id: string;
          url: string;
          description: string | null;
          events: string[];
          secretPrefix: string;
          isActive: boolean;
          consecutiveFailures: number;
          disabledReason: string | null;
          createdAt: string;
        }>
      >('GET', '/v1/partner/webhooks'),

    remove: (endpointId: string) =>
      this.request<{ status: string; id: string }>(
        'DELETE',
        `/v1/partner/webhooks/${encodeURIComponent(endpointId)}`,
      ),
  };
}

/**
 * Web Crypto HMAC-SHA256 verifier for outbound SparkTrack partner webhooks.
 * Works natively in Cloudflare Workers, Node.js 20+, and browsers.
 */
export async function verifySparkTrackWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((item) => {
      const [k, v] = item.trim().split('=');
      return [k, v];
    }),
  );
  const ts = parts.t;
  const v1 = parts.v1;
  if (!ts || !v1 || !/^\d+$/.test(ts)) return false;

  const nowEpoch = Math.floor(Date.now() / 1000);
  if (Math.abs(nowEpoch - Number(ts)) > toleranceSeconds) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${rawBody}`));
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diff === 0;
}

