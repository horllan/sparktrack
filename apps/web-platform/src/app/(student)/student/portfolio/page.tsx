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
  const [learnerId, setLearnerId] = useState(searchParams.get('learnerId') ?? DEMO_EXPLORER_ID);
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
    void loadPortfolio(learnerId);
  }, [learnerId, loadPortfolio]);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Verifiable Capability Portfolio &amp; SHA-256 Ledger Proof</h1>
            <p className="text-sm text-slate-600">
              NDPA-gated public credential view. Only accessible when a guardian has verified SMS consent AND enabled{' '}
              <code>allow_public_portfolio = TRUE</code>.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              className="w-72"
              value={learnerId}
              onChange={(e) => setLearnerId(e.target.value)}
              placeholder="Learner UUID"
            />
            <Button disabled={busy} onClick={() => void loadPortfolio(learnerId)}>
              {busy ? 'Verifying…' : 'Verify Portfolio'}
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="p-4 text-sm text-amber-900">
              <strong>NDPA Privacy Gate Active:</strong> {error}
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
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Verified Bitemporal Capability Snapshot
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {portfolio.skills.map((s) => (
                    <div key={s.node_code} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900">{s.node_name}</span>
                        <Badge variant="competent">{s.progression}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Score: {Math.round(s.score * 100)}% • {s.evidence_count} sealed artifacts
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cryptographic Append-Only Evidence Ledger Receipts</CardTitle>
                <CardDescription>
                  Every artifact below is sealed in PostgreSQL <code>evidence.cryptographic_ledger</code> with an immutable SHA-256 chain signature.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {portfolio.artifacts.map((art) => (
                  <div key={art.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-slate-900">{art.title}</span>
                        <span className="ml-2 text-xs text-slate-500">({art.artifactType})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {art.mentorVerified ? (
                          <Badge variant="advanced">
                            Mentor Verified ({art.qualityScore !== null ? `${Math.round(art.qualityScore * 100)}%` : '—'})
                          </Badge>
                        ) : (
                          <Badge variant="developing">Pending Mentor Verification</Badge>
                        )}
                        <Badge variant="outline">Ledger Block #{art.ledgerSeq ?? '—'}</Badge>
                      </div>
                    </div>
                    {art.description && <p className="mt-1 text-xs text-slate-600">{art.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-600">
                      <span>Skills: {art.skillCodes.join(', ') || '—'}</span>
                      <span>SHA-256: {art.rowSignatureHash ?? '—'}</span>
                    </div>
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

