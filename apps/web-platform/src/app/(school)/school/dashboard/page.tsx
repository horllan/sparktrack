'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Building2,
  Compass,
  FolderKanban,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@sparktrack/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

interface InstitutionAnalytics {
  totals: {
    totalLearners: number;
    verifiedConsentLearners: number;
    sealedArtifacts: number;
    activeCohorts: number;
  };
  skillDistribution: Array<{
    code: string;
    name: string;
    category: string | null;
    learnerCount: number;
    averageScore: number;
  }>;
  optInTalentPool: Array<{
    learnerId: string;
    educationStage: string;
    schoolName: string | null;
    declaredInterests: string[];
    verifiedArtifacts: number;
    topSkills: Array<{ skill: string; level: string; score: number }>;
  }>;
  organisations: Array<{
    id: string;
    name: string;
    orgType: string;
    countryCode: string;
    subscriptionTier: string;
  }>;
  ledgerAudit: {
    totalEntries: number;
    allValid: boolean;
    latestLedgerSeq: number | null;
  };
}

export default function SchoolDashboardPage() {
  const [data, setData] = useState<InstitutionAnalytics | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadAnalytics = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/v1/learning/institutions/analytics`);
      if (!res.ok) throw new Error('Unable to load institutional analytics');
      const body = (await res.json()) as InstitutionAnalytics;
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load analytics.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-7">
        {/* Modern School Insights Hero Header */}
        <div className="spark-enter flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.28)] backdrop-blur sm:p-8">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-spark-200 bg-spark-50 px-3 py-1 text-xs font-semibold text-spark-700">
              <Compass className="h-3.5 w-3.5" />
              <span>School &amp; Partner Insights</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              See how your learners are growing.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Understand cohort progress, emerging capability distribution, and the verified experiences helping
              learners build confidence across your institution.
            </p>
          </div>
          <Button variant="outline" disabled={busy} onClick={() => void loadAnalytics()}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            {busy ? 'Refreshing…' : 'Refresh Live Telemetry'}
          </Button>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {data && (
          <>
            {/* KPI Metric Strip */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardDescription>Onboarded Learners</CardDescription>
                    <span className="rounded-lg bg-spark-50 p-2 text-spark-600">
                      <UsersRound className="h-4 w-4" />
                    </span>
                  </div>
                  <CardTitle className="text-3xl font-extrabold text-slate-900">{data.totals.totalLearners}</CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardDescription>Guardian Consent Active</CardDescription>
                    <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                      <ShieldCheck className="h-4 w-4" />
                    </span>
                  </div>
                  <CardTitle className="text-3xl font-extrabold text-emerald-700">
                    {data.totals.verifiedConsentLearners}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardDescription>Verified Projects</CardDescription>
                    <span className="rounded-lg bg-cyan-50 p-2 text-cyan-600">
                      <FolderKanban className="h-4 w-4" />
                    </span>
                  </div>
                  <CardTitle className="text-3xl font-extrabold text-slate-900">
                    {data.totals.sealedArtifacts}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardDescription>Active Cohorts</CardDescription>
                    <span className="rounded-lg bg-amber-50 p-2 text-amber-600">
                      <Sparkles className="h-4 w-4" />
                    </span>
                  </div>
                  <CardTitle className="text-3xl font-extrabold text-slate-900">{data.totals.activeCohorts}</CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardDescription>Evidence Chain Audit</CardDescription>
                    <span className="rounded-lg bg-slate-100 p-2 text-slate-700">
                      <Activity className="h-4 w-4" />
                    </span>
                  </div>
                  <CardTitle className="pt-1 text-base">
                    <Badge variant={data.ledgerAudit.allValid ? 'success' : 'warning'}>
                      {data.ledgerAudit.allValid
                        ? `Verified (${data.ledgerAudit.totalEntries} records)`
                        : 'Integrity Alert'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Cohort Skill Distribution & Opt-In Talent Discovery */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cohort Capability &amp; Skill Progression</CardTitle>
                  <CardDescription>
                    Active skill momentum across verified learners and mentor-reviewed evidence.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3.5">
                  {data.skillDistribution.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-sm text-slate-500">
                      No active skill states recorded yet.
                    </div>
                  ) : (
                    data.skillDistribution.map((skill) => {
                      const pct = Math.min(100, Math.round(skill.averageScore * 100));
                      return (
                        <div
                          key={skill.code}
                          className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 transition hover:bg-white"
                        >
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <div>
                              <span className="font-semibold text-slate-900">{skill.name}</span>
                              {skill.category && (
                                <span className="ml-2 text-xs font-medium text-slate-400">• {skill.category}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">
                                {skill.learnerCount} {skill.learnerCount === 1 ? 'learner' : 'learners'}
                              </span>
                              <Badge variant="outline">{pct}% avg</Badge>
                            </div>
                          </div>
                          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-spark-600 to-cyan-400 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Guardian Opt-In Talent Discovery Pool</CardTitle>
                  <CardDescription>
                    Strictly limited to learners whose guardian verified SMS consent AND explicitly enabled partner
                    talent discovery (NDPA 2023 child-safety compliant).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.optInTalentPool.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-sm text-slate-500">
                      No learners have opted into external partner talent discovery yet (all minors default to private).
                    </div>
                  ) : (
                    data.optInTalentPool.map((learner) => (
                      <div
                        key={learner.learnerId}
                        className="rounded-2xl border border-slate-200/90 bg-white p-4 text-sm shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">
                            {learner.educationStage} • {learner.schoolName ?? 'Independent Explorer'}
                          </span>
                          <Badge variant="success">{learner.verifiedArtifacts} verified projects</Badge>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-500">
                          Learner Ref: <code className="font-mono">{learner.learnerId.slice(0, 8)}…</code> • Interests:{' '}
                          <span className="font-medium text-slate-700">
                            {learner.declaredInterests.join(', ') || 'Exploring'}
                          </span>
                        </p>
                        {learner.topSkills.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {learner.topSkills.slice(0, 4).map((s, idx) => (
                              <Badge key={`${s.skill}-${idx}`} variant="default">
                                {s.skill}: {s.level} ({Math.round(Number(s.score) * 100)}%)
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Registered Partner Organisations */}
            {data.organisations.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-spark-600" />
                    <CardTitle className="text-base">
                      Registered Partner Schools &amp; Sponsors ({data.organisations.length})
                    </CardTitle>
                  </div>
                  <CardDescription>
                    Institutions and youth development partners collaborating on SparkTrack cohorts.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {data.organisations.map((org) => (
                      <div
                        key={org.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-sm"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{org.name}</p>
                          <p className="text-xs text-slate-500">
                            {org.orgType.replace(/_/g, ' ')} • {org.countryCode}
                          </p>
                        </div>
                        <Badge variant="outline">{org.subscriptionTier}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </main>
  );
}
