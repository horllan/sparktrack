'use client';

import { useCallback, useEffect, useState } from 'react';
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
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Partner School &amp; Institutional Analytics Portal</h1>
            <p className="text-sm text-slate-600">
              Aggregate capability progression, cryptographic ledger integrity, and NDPA-compliant opt-in talent discovery.
            </p>
          </div>
          <Button variant="outline" disabled={busy} onClick={() => void loadAnalytics()}>
            {busy ? 'Refreshing…' : 'Refresh Live Telemetry'}
          </Button>
        </div>

        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Onboarded Learners</CardDescription>
                  <CardTitle className="text-2xl">{data.totals.totalLearners}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>NDPA Consent Verified</CardDescription>
                  <CardTitle className="text-2xl text-emerald-700">{data.totals.verifiedConsentLearners}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Sealed Ledger Artifacts</CardDescription>
                  <CardTitle className="text-2xl">{data.totals.sealedArtifacts}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active Programme Cohorts</CardDescription>
                  <CardTitle className="text-2xl">{data.totals.activeCohorts}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>SHA-256 Hash Chain Audit</CardDescription>
                  <CardTitle className="text-base">
                    <Badge variant={data.ledgerAudit.allValid ? 'success' : 'warning'}>
                      {data.ledgerAudit.allValid
                        ? `Verified (${data.ledgerAudit.totalEntries} blocks)`
                        : 'Integrity Alert'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cohort Capability &amp; Skill Progression</CardTitle>
                  <CardDescription>
                    Active bitemporal skill distribution across verified learners.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.skillDistribution.length === 0 ? (
                    <p className="text-sm text-slate-500">No active skill states recorded yet.</p>
                  ) : (
                    data.skillDistribution.map((skill) => (
                      <div key={skill.code} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-800">
                            {skill.name}{' '}
                            <span className="text-xs text-slate-500">({skill.learnerCount} learners)</span>
                          </span>
                          <Badge variant="outline">{Math.round(skill.averageScore * 100)}% avg</Badge>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full bg-spark-500"
                            style={{ width: `${Math.min(100, Math.round(skill.averageScore * 100))}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">NDPA Opt-In Partner Talent Discovery Pool</CardTitle>
                  <CardDescription>
                    Strictly limited to learners whose guardian verified SMS OTP consent AND explicitly enabled{' '}
                    <code>allow_partner_talent_discovery = TRUE</code>.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.optInTalentPool.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No learners have opted into external partner talent discovery yet (all minors default to private).
                    </p>
                  ) : (
                    data.optInTalentPool.map((learner) => (
                      <div key={learner.learnerId} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-900">
                            Stage: {learner.educationStage} • {learner.schoolName ?? 'Independent'}
                          </span>
                          <Badge variant="success">{learner.verifiedArtifacts} sealed artifacts</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Learner ID: <code>{learner.learnerId.slice(0, 8)}…</code> • Declared:{' '}
                          {learner.declaredInterests.join(', ') || 'None'}
                        </p>
                        {learner.topSkills.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {learner.topSkills.slice(0, 4).map((s, idx) => (
                              <Badge key={`${s.skill}-${idx}`} variant="outline">
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
          </>
        )}
      </div>
    </main>
  );
}
