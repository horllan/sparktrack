'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@sparktrack/ui';
import { createClient } from '../../../../lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

interface ReportSection {
  key: string;
  title: string;
  narrative: string;
}

interface GeneratedReport {
  id: string;
  version: number;
  learnerId: string;
  generatedAt: string;
  synthesisModel: string;
  guardrailResult: {
    passed: boolean;
    deterministicViolations: Array<{ phrase: string; sectionKey: string }>;
    explorationLanguageCount: number;
  };
  [key: string]: unknown;
}

interface ConsentPreferences {
  learnerId: string;
  consentStatus: 'PENDING_PARENTAL_CONSENT' | 'VERIFIED_ACTIVE' | 'RESTRICTED_INTERNAL_ONLY' | 'REVOKED';
  consentVerifiedAt: string | null;
  allowPublicPortfolio: boolean;
  allowPartnerTalentDiscovery: boolean;
}

const SECTION_KEYS = [
  'executiveSummary',
  'participationHistory',
  'declaredVsObserved',
  'technicalSkills',
  'creativeSkills',
  'businessSkills',
  'behaviouralSignals',
  'capabilityMaturity',
  'careerPathways',
  'entrepreneurshipPathways',
  'longitudinalProgress',
  'recommendedNextSteps',
  'mentorInsights',
] as const;

export default function ParentDashboardPage() {
  const [learnerId, setLearnerId] = useState('11111111-1111-4111-8111-111111111113');
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [asOfDate, setAsOfDate] = useState('');
  const [snapshotSkills, setSnapshotSkills] = useState<Array<{ node_name: string; progression: string; score: number }>>([]);
  const [consentPrefs, setConsentPrefs] = useState<ConsentPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function authHeaders() {
    const { data } = await createClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Please sign in to access authenticated Parent Portal actions.');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  const loadConsentPreferences = useCallback(async (id: string) => {
    if (!id.trim()) return;
    try {
      const res = await fetch(`${API_URL}/v1/auth/consent/preferences/${id.trim()}`);
      if (res.ok) setConsentPrefs((await res.json()) as ConsentPreferences);
    } catch {
      // Optional on initial load
    }
  }, []);

  useEffect(() => {
    void loadConsentPreferences(learnerId);
  }, [learnerId, loadConsentPreferences]);

  async function updatePrivacyPreferences(next: {
    consentStatus: 'VERIFIED_ACTIVE' | 'RESTRICTED_INTERNAL_ONLY' | 'REVOKED';
    allowPublicPortfolio: boolean;
    allowPartnerTalentDiscovery: boolean;
  }) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/v1/auth/consent/preferences/${learnerId.trim()}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(next),
      });
      const body = (await res.json()) as ConsentPreferences & { message?: string };
      if (!res.ok) throw new Error(body.message ?? 'Could not update NDPA privacy preferences.');
      setConsentPrefs(body);
      setNotice(`Updated NDPA consent & privacy controls (${body.consentStatus}).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update privacy preferences.');
    } finally {
      setBusy(false);
    }
  }

  async function fetchReport(generateNew: boolean) {
    if (!learnerId.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const headers = await authHeaders();
      const res = await fetch(
        `${API_URL}/v1/reports/${learnerId.trim()}/${generateNew ? 'generate' : 'latest'}`,
        { method: generateNew ? 'POST' : 'GET', headers },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `Request failed (${res.status})`);
      }
      setReport((await res.json()) as GeneratedReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load development report.');
    } finally {
      setBusy(false);
    }
  }

  async function loadTimeTravelSnapshot() {
    if (!learnerId.trim()) return;
    setBusy(true);
    setError('');
    try {
      const headers = await authHeaders();
      const query = asOfDate ? `?asOf=${encodeURIComponent(new Date(asOfDate).toISOString())}` : '';
      const res = await fetch(`${API_URL}/v1/progress/${learnerId.trim()}${query}`, { headers });
      if (!res.ok) throw new Error(`Snapshot query failed (${res.status})`);
      const data = (await res.json()) as { skills: Array<{ node_name: string; progression: string; score: number }> };
      setSnapshotSkills(data.skills ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to query bitemporal snapshot.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Parent &amp; Guardian Development Report Portal</h1>
          <p className="text-sm text-slate-600">
            13-Part SparkTrack Development Report, Bitemporal Progression Viewer &amp; NDPA 2023 Child-Safety Controls
          </p>
        </div>

        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}

        {consentPrefs && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Guardian NDPA 2023 Privacy &amp; Consent Controls</CardTitle>
                  <CardDescription>
                    Control public portfolio visibility, external partner talent discovery, or revoke consent at any time.
                  </CardDescription>
                </div>
                <Badge variant={consentPrefs.consentStatus === 'VERIFIED_ACTIVE' ? 'success' : 'warning'}>
                  {consentPrefs.consentStatus}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={consentPrefs.allowPublicPortfolio}
                    disabled={busy || consentPrefs.consentStatus !== 'VERIFIED_ACTIVE'}
                    onChange={(e) =>
                      void updatePrivacyPreferences({
                        consentStatus: 'VERIFIED_ACTIVE',
                        allowPublicPortfolio: e.target.checked,
                        allowPartnerTalentDiscovery: consentPrefs.allowPartnerTalentDiscovery,
                      })
                    }
                  />
                  <span>Allow Public Verifiable Portfolio</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={consentPrefs.allowPartnerTalentDiscovery}
                    disabled={busy || consentPrefs.consentStatus !== 'VERIFIED_ACTIVE'}
                    onChange={(e) =>
                      void updatePrivacyPreferences({
                        consentStatus: 'VERIFIED_ACTIVE',
                        allowPublicPortfolio: consentPrefs.allowPublicPortfolio,
                        allowPartnerTalentDiscovery: e.target.checked,
                      })
                    }
                  />
                  <span>Allow Partner Talent Discovery</span>
                </label>
              </div>
              <div className="flex gap-2">
                {consentPrefs.consentStatus !== 'VERIFIED_ACTIVE' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void updatePrivacyPreferences({
                        consentStatus: 'VERIFIED_ACTIVE',
                        allowPublicPortfolio: false,
                        allowPartnerTalentDiscovery: false,
                      })
                    }
                  >
                    Restore Active Consent (Private)
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void updatePrivacyPreferences({
                        consentStatus: 'REVOKED',
                        allowPublicPortfolio: false,
                        allowPartnerTalentDiscovery: false,
                      })
                    }
                  >
                    Revoke Consent (NDPA Right to Withdraw)
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Load or Synthesize 13-Part Development Report</CardTitle>
            <CardDescription>
              Protected by the Child-Safety Non-Deterministic Guardrail (Exploration Over Assignment).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Input
                value={learnerId}
                onChange={(e) => setLearnerId(e.target.value)}
                placeholder="Enter Learner UUID"
                className="flex-1 min-w-[240px]"
              />
              <Button variant="outline" disabled={busy || !learnerId.trim()} onClick={() => void fetchReport(false)}>
                View Latest Report
              </Button>
              <Button disabled={busy || !learnerId.trim()} onClick={() => void fetchReport(true)}>
                {busy ? 'Synthesizing…' : 'Generate New Report'}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
              <span className="text-xs font-medium text-slate-600">Bitemporal Time-Travel Snapshot:</span>
              <Input
                type="datetime-local"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="w-auto"
              />
              <Button size="sm" variant="outline" disabled={busy || !learnerId.trim()} onClick={() => void loadTimeTravelSnapshot()}>
                Compare Snapshot As-Of Date
              </Button>
            </div>

            {snapshotSkills.length > 0 && (
              <div className="rounded-lg bg-slate-100 p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-700">Historical Capability Profile Snapshot:</p>
                <div className="flex flex-wrap gap-2">
                  {snapshotSkills.map((s) => (
                    <Badge key={s.node_name} variant="secondary">
                      {s.node_name}: {s.progression} ({Math.round(s.score * 100)}%)
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {report && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-lg">
                    SparkTrack Development Report (v{report.version})
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={report.guardrailResult?.passed ? 'competent' : 'destructive'}>
                      {report.guardrailResult?.passed
                        ? `Child-Safety Guardrail Passed (${report.guardrailResult.explorationLanguageCount} exploration signals)`
                        : 'Guardrail Warning'}
                    </Badge>
                    <Badge variant="outline">{report.synthesisModel}</Badge>
                  </div>
                </div>
                <CardDescription>Generated at {new Date(report.generatedAt).toLocaleString()}</CardDescription>
              </CardHeader>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {SECTION_KEYS.map((key, idx) => {
                const sec = report[key] as ReportSection | undefined;
                if (!sec) return null;
                return (
                  <Card key={key} className={idx === 0 || key === 'declaredVsObserved' ? 'md:col-span-2' : ''}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-spark-900">
                        {idx + 1}. {sec.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed text-slate-700">{sec.narrative}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
