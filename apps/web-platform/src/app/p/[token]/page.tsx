'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Check,
  ShieldCheck,
} from '@sparktrack/ui';
import { DEMO_CASE_STUDIES, computeDemoState } from '../../../lib/demo-case-studies';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

interface SharedPortfolioResponse {
  status: 'public';
  profile: {
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

function buildDemoFallback(token: string): SharedPortfolioResponse | null {
  const normalized = token.trim().toLowerCase();
  const cs = DEMO_CASE_STUDIES.find(
    (c) =>
      c.shareToken.toLowerCase() === normalized ||
      c.accessCode.toLowerCase() === normalized ||
      c.id.toLowerCase() === normalized,
  );
  if (!cs) return null;
  const computed = computeDemoState(
    cs,
    cs.defaultOnboardingYear,
    cs.trainings.map((t) => t.id),
  );
  const firstName = cs.fullName.trim().split(/\s+/)[0] ?? 'Explorer';
  return {
    status: 'public',
    profile: {
      displayName: `${firstName} (${cs.educationStage})`,
      educationStage: cs.educationStage,
      schoolName: cs.organisationName,
      declaredInterests: cs.declaredInterests,
    },
    skills: computed.skillScores.map((s) => ({
      node_code: s.code,
      node_name: s.name,
      category: s.category,
      score: s.score,
      progression: s.progression,
      evidence_count: s.evidenceCount,
    })),
    artifacts: computed.activeProjects.map((p) => ({
      id: p.id,
      artifactType: p.artifactType,
      title: p.title,
      description: p.description,
      skillCodes: p.skillCodes,
      qualityScore: p.qualityScore,
      mentorVerified: p.mentorVerified,
      capturedOfflineAt: p.capturedOfflineAt,
      ledgerSeq: p.ledgerSeq,
      rowSignatureHash: p.rowSignatureHash,
    })),
  };
}

export default function SharedPortfolioPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [portfolio, setPortfolio] = useState<SharedPortfolioResponse | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const loadSharedPortfolio = useCallback(async (rawToken: string) => {
    const clean = rawToken.trim();
    if (!clean) {
      setError('No portfolio link token was provided.');
      setBusy(false);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/v1/learning/portfolio/shared/${encodeURIComponent(clean)}`);
      if (res.ok) {
        const body = (await res.json()) as SharedPortfolioResponse;
        setPortfolio(body);
        return;
      }
      const fallback = buildDemoFallback(clean);
      if (fallback) {
        setPortfolio(fallback);
        return;
      }
      const errBody = (await res.json().catch(() => ({}))) as { message?: string };
      setError(
        errBody.message ??
          'This shared portfolio link is invalid, private, or has been turned off by the learner or guardian.',
      );
    } catch {
      const fallback = buildDemoFallback(clean);
      if (fallback) {
        setPortfolio(fallback);
      } else {
        setError('Unable to reach the verification service right now. Please try again shortly.');
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadSharedPortfolio(token);
  }, [token, loadSharedPortfolio]);

  async function handleCopyLink() {
    if (typeof window === 'undefined') return;
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handlePrint() {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-8 lg:flex-row lg:items-center">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
              <ShieldCheck size={14} />
              <span>Verified SparkTrack Capability Portfolio</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              {portfolio ? portfolio.profile.displayName : 'Shared Capability Portfolio'}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
              {portfolio
                ? `${portfolio.profile.schoolName ?? 'Independent Learner'} • Interests: ${
                    portfolio.profile.declaredInterests.join(', ') || 'General Exploration'
                  }`
                : 'Public view of mentor-reviewed projects and demonstrated skills.'}
            </p>
          </div>

          <div className="no-print flex flex-wrap items-center gap-2.5">
            <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyLink()}>
              {copied ? (
                <>
                  <Check size={14} className="mr-1.5" /> Link Copied
                </>
              ) : (
                'Copy Share Link'
              )}
            </Button>
            {portfolio && (
              <Button type="button" size="sm" onClick={handlePrint}>
                Print / Save PDF
              </Button>
            )}
          </div>
        </div>

        {busy && (
          <Card>
            <CardContent className="p-6 text-sm text-slate-600">Loading verified portfolio…</CardContent>
          </Card>
        )}

        {!busy && error && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="space-y-3 p-6 text-sm leading-relaxed text-amber-950">
              <p>
                <strong>Portfolio Unavailable:</strong> {error}
              </p>
              <div className="no-print flex flex-wrap gap-2 pt-1">
                <Link href="/student/portfolio">
                  <Button size="sm" variant="outline">
                    Look Up Another Portfolio
                  </Button>
                </Link>
                <Link href="/demo?role=verifier">
                  <Button size="sm">View Sample Portfolios</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {!busy && portfolio && (
          <>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Skills Demonstrated Through Projects</CardTitle>
                    <CardDescription>
                      Each skill below is backed by completed project work and mentor reviews.
                    </CardDescription>
                  </div>
                  <Badge variant="advanced">Consent Verified • Public Sharing Active</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {portfolio.skills.length === 0 ? (
                  <p className="text-sm text-slate-500">No verified skill records have been published yet.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {portfolio.skills.map((s) => (
                      <div key={s.node_code} className="rounded-xl border border-slate-200 bg-white p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">{s.node_name}</span>
                          <Badge variant="competent">{s.progression}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Demonstrated across {s.evidence_count} {s.evidence_count === 1 ? 'project' : 'projects'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Verified Projects ({portfolio.artifacts.length})</CardTitle>
                <CardDescription>
                  Completed work and mentor verification records shared by the learner.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {portfolio.artifacts.map((art) => (
                  <div key={art.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-slate-900">{art.title}</span>
                        <span className="ml-2 text-xs text-slate-500">
                          ({art.artifactType.replace(/_/g, ' ').toLowerCase()})
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {art.mentorVerified ? (
                          <Badge variant="advanced">
                            Mentor Verified (
                            {art.qualityScore !== null ? `${Math.round(art.qualityScore * 100)}%` : '✓'})
                          </Badge>
                        ) : (
                          <Badge variant="developing">Awaiting Mentor Review</Badge>
                        )}
                      </div>
                    </div>
                    {art.description && <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{art.description}</p>}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {art.skillCodes.map((code) => (
                        <Badge key={code} variant="secondary">
                          {code.replace(/^SKILL_|^SIG_/, '').replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                    {art.rowSignatureHash && (
                      <p className="mt-2.5 border-t border-slate-100 pt-2 font-mono text-[11px] text-slate-400">
                        Record #{art.ledgerSeq ?? '—'} • Verification ID:{' '}
                        {art.rowSignatureHash.slice(0, 24).toUpperCase()}
                      </p>
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

