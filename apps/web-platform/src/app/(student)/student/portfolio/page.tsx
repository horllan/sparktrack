'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@sparktrack/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const DEMO_EXPLORER_ID = '11111111-1111-4111-8111-111111111113';

interface PublicPortfolioResponse {
  status: 'public';
  profile: {
    learnerId: string;
    displayName: string;
    educationStage: string;
    schoolName: string | null;
    declaredInterests: string[];
  };
  skills: Array<{
    node_code: string;
    node_name: string;
    category: string | null;
    score: number;
    progression: string;
    evidence_count: number;
  }>;
  artifacts: Array<{
    id: string;
    artifactType: string;
    title: string;
    description: string | null;
    skillCodes: string[];
    qualityScore: number | null;
    mentorVerified: boolean;
    capturedOfflineAt: string;
    ledgerSeq: number | null;
    rowSignatureHash: string | null;
  }>;
}

function PortfolioContent() {
  const searchParams = useSearchParams();
  const [learnerId, setLearnerId] = useState(searchParams.get('learnerId') ?? '');
  const [portfolio, setPortfolio] = useState<PublicPortfolioResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadPortfolio = useCallback(async (id: string) => {
    if (!id.trim()) return;
    setBusy(true);
    setError('');
    setPortfolio(null);
    try {
      const res = await fetch(`${API_URL}/v1/learning/portfolio/${id.trim()}`);
      const body = (await res.json()) as PublicPortfolioResponse & { message?: string };
      if (!res.ok) throw new Error(body.message ?? 'Portfolio is private or not found.');
      setPortfolio(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load portfolio.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (learnerId) {
      void loadPortfolio(learnerId);
    }
  }, [learnerId, loadPortfolio]);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6 sm:space-y-7">
        <div className="spark-enter flex flex-col justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-8 lg:flex-row lg:items-center">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-spark-700">Your work, made visible</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              A portfolio that shows how you grow.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              This public view is available only when a guardian has verified consent and enabled portfolio sharing.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
            <Input
              className="w-full sm:w-72"
              value={learnerId}
              onChange={(e) => setLearnerId(e.target.value)}
              aria-label="Learner profile ID"
              placeholder="Learner profile ID"
            />
            <div className="flex gap-2">
              <Button
                className="flex-1 sm:flex-none"
                disabled={busy || !learnerId.trim()}
                onClick={() => void loadPortfolio(learnerId)}
              >
                {busy ? 'Verifying…' : 'Verify Portfolio'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setLearnerId(DEMO_EXPLORER_ID);
                  void loadPortfolio(DEMO_EXPLORER_ID);
                }}
              >
                Demo ID
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="p-4 text-sm text-amber-900">
              <strong>NDPA Privacy Gate Active:</strong> {error}
            </CardContent>
          </Card>
        )}

        {!portfolio && !busy && !error && !learnerId && (
          <Card>
            <CardContent className="p-5 text-sm leading-6 text-slate-600 sm:p-6">
              Enter a learner profile ID above (or tap <strong>Demo ID</strong>) to inspect a cryptographically verified
              portfolio. Portfolios are only visible when the family has opted into public sharing.
            </CardContent>
          </Card>
        )}

        {portfolio && (
          <>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-xl">{portfolio.profile.displayName}</CardTitle>
                    <CardDescription>
                      {portfolio.profile.schoolName ?? 'Independent Explorer'} • Declared Interests:{' '}
                      {portfolio.profile.declaredInterests.join(', ') || 'None'}
                    </CardDescription>
                  </div>
                  <Badge variant="advanced">Guardian Consent Verified • Public Opt-In Active</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                  Skills shown through shared work
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {portfolio.skills.map((s) => (
                    <div key={s.node_code} className="rounded-xl border border-slate-200 bg-white p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900">{s.node_name}</span>
                        <Badge variant="competent">{s.progression}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Showing in {s.evidence_count} {s.evidence_count === 1 ? 'project' : 'projects'}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Projects and feedback</CardTitle>
                <CardDescription>A record of what was shared and the feedback it received.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {portfolio.artifacts.map((art) => (
                  <div key={art.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-slate-900">{art.title}</span>
                        <span className="ml-2 text-xs text-slate-500">({art.artifactType})</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {art.mentorVerified ? (
                          <Badge variant="advanced">
                            Mentor Verified (
                            {art.qualityScore !== null ? `${Math.round(art.qualityScore * 100)}%` : '—'})
                          </Badge>
                        ) : (
                          <Badge variant="developing">Pending Mentor Verification</Badge>
                        )}
                        <Badge variant="outline">Shared work</Badge>
                      </div>
                    </div>
                    {art.description && <p className="mt-1.5 text-xs text-slate-600">{art.description}</p>}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {art.skillCodes.map((code) => (
                        <Badge key={code} variant="secondary">
                          {code.replace(/^SKILL_|^SIG_/, '').replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                    {art.rowSignatureHash && (
                      <details className="mt-3 border-t border-slate-100 pt-3">
                        <summary className="cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-900">
                          View authenticity details
                        </summary>
                        <p className="mt-2 break-all font-mono text-[11px] leading-5 text-slate-500">
                          Record proof: {art.rowSignatureHash}
                        </p>
                      </details>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}

export default function StudentPortfolioPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading verifiable portfolio…</div>}>
      <PortfolioContent />
    </Suspense>
  );
}
