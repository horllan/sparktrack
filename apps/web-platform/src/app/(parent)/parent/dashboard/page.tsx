'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Compass,
  HeartHandshake,
  Input,
  ShieldCheck,
  Sparkles,
} from '@sparktrack/ui';
import { createClient } from '../../../../lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const DEMO_EXPLORER_ID = '11111111-1111-4111-8111-111111111113';

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

type ReportTab = 'all' | 'overview' | 'skills' | 'pathways' | 'next';

const REPORT_TABS: Array<{ id: ReportTab; label: string; keys: ReadonlyArray<(typeof SECTION_KEYS)[number]> }> = [
  { id: 'overview', label: 'Overview & Interests', keys: ['executiveSummary', 'participationHistory', 'declaredVsObserved'] },
  {
    id: 'skills',
    label: 'Skills & Signals',
    keys: ['technicalSkills', 'creativeSkills', 'businessSkills', 'behaviouralSignals', 'capabilityMaturity'],
  },
  { id: 'pathways', label: 'Pathways to Explore', keys: ['careerPathways', 'entrepreneurshipPathways'] },
  { id: 'next', label: 'Progress & Next Steps', keys: ['longitudinalProgress', 'recommendedNextSteps', 'mentorInsights'] },
  { id: 'all', label: 'All 13 Sections', keys: SECTION_KEYS },
];

export default function ParentDashboardPage() {
  const [learnerId, setLearnerId] = useState(DEMO_EXPLORER_ID);
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
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
    if (!token) throw new Error('Please sign in with a Guardian account to perform this action.');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  const loadConsentPreferences = useCallback(async (id: string) => {
    if (!id.trim()) return;
    try {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch(`${API_URL}/v1/auth/consent/preferences/${id.trim()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setConsentPrefs((await res.json()) as ConsentPreferences);
    } catch {
      // Optional on initial load when not signed in
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
      setNotice(`Updated family privacy choices (${body.consentStatus}).`);
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

  const visibleKeys = REPORT_TABS.find((t) => t.id === activeTab)?.keys ?? SECTION_KEYS;

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="spark-enter flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-spark-700">Family space</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Support their growth with confidence.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Review evidence-backed progress, explore new strengths, and stay in complete control of privacy choices.
            </p>
          </div>
          <Link href="/parent/consent">
            <Button variant="outline">
              <ShieldCheck size={16} className="mr-2" aria-hidden="true" />
              Verify SMS Consent Code
            </Button>
          </Link>
        </div>

        {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">{notice}</p>}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-coral-50 text-coral-600">
                  <HeartHandshake size={19} aria-hidden="true" />
                </span>
                <div>
                  <CardTitle className="text-base">Family Privacy &amp; NDPA 2023 Consent Controls</CardTitle>
                  <CardDescription>
                    Initial consent activation requires the 6-digit SMS code on the Consent page. Once verified, you can adjust sharing or withdraw consent here at any time.
                  </CardDescription>
                </div>
              </div>
              {consentPrefs && (
                <Badge variant={consentPrefs.consentStatus === 'VERIFIED_ACTIVE' ? 'success' : 'warning'}>
                  {consentPrefs.consentStatus}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {consentPrefs ? (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
                <div className="flex flex-wrap gap-6 text-sm font-medium text-slate-800">
                  <label className="flex items-center gap-2.5">
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
                  <label className="flex items-center gap-2.5">
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
                {consentPrefs.consentStatus === 'VERIFIED_ACTIVE' ? (
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
                    Withdraw Consent (NDPA Right to Revoke)
                  </Button>
                ) : (
                  <Link href="/parent/consent" className="text-xs font-bold text-spark-700 hover:underline">
                    Complete 6-digit SMS verification to re-activate consent →
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Sign in with your Guardian account to manage live sharing toggles or withdraw consent for this learner.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-spark-50 text-spark-700">
                  <Compass size={19} aria-hidden="true" />
                </span>
                <div>
                  <CardTitle className="text-base">View their development report &amp; progress</CardTitle>
                  <CardDescription>
                    Explore the evidence and developmental signals behind each recommendation.
                  </CardDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLearnerId(DEMO_EXPLORER_ID)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-spark-50 hover:text-spark-800"
              >
                Use 13yo Explorer Demo ID
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <label htmlFor="learner-id" className="sr-only">Learner profile ID</label>
              <Input
                id="learner-id"
                value={learnerId}
                onChange={(e) => setLearnerId(e.target.value)}
                placeholder="Enter learner profile ID"
                className="flex-1 min-w-[240px]"
              />
              <Button variant="outline" disabled={busy || !learnerId.trim()} onClick={() => void fetchReport(false)}>
                View Latest Report
              </Button>
              <Button disabled={busy || !learnerId.trim()} onClick={() => void fetchReport(true)}>
                <Sparkles size={16} className="mr-1.5" aria-hidden="true" />
                {busy ? 'Synthesizing…' : 'Generate New Report'}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              <span className="text-xs font-semibold text-slate-700">Compare progress as of a past date:</span>
              <Input
                type="datetime-local"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="w-auto"
              />
              <Button size="sm" variant="outline" disabled={busy || !learnerId.trim()} onClick={() => void loadTimeTravelSnapshot()}>
                Compare snapshot
              </Button>
            </div>

            {snapshotSkills.length > 0 && (
              <div className="rounded-2xl bg-slate-50 p-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Historical Capability Snapshot</p>
                <div className="flex flex-wrap gap-2">
                  {snapshotSkills.map((s) => (
                    <Badge key={s.node_name} variant="competent">
                      {s.node_name}: {s.progression} ({Math.round(s.score * 100)}%)
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {report && (
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">
                      SparkTrack Development Report (Edition v{report.version})
                    </CardTitle>
                    <CardDescription>
                      Generated on {new Date(report.generatedAt).toLocaleString()} · Exploratory guidance only, never fixed labels
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={report.guardrailResult?.passed ? 'competent' : 'destructive'}>
                      {report.guardrailResult?.passed
                        ? `Child-Safety Verified (${report.guardrailResult.explorationLanguageCount} exploration signals)`
                        : 'Guardrail Alert'}
                    </Badge>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  {REPORT_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                        activeTab === tab.id
                          ? 'bg-spark-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </CardHeader>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {visibleKeys.map((key) => {
                const sec = report[key] as ReportSection | undefined;
                if (!sec) return null;
                const idx = SECTION_KEYS.indexOf(key);
                const wide = key === 'executiveSummary' || key === 'declaredVsObserved';
                return (
                  <Card key={key} className={wide ? 'md:col-span-2' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-bold text-slate-900">
                          {idx + 1}. {sec.title}
                        </CardTitle>
                        {key === 'declaredVsObserved' && (
                          <Badge variant="developing">Interest vs. Evidence Alignment</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-7 text-slate-700">{sec.narrative}</p>
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
