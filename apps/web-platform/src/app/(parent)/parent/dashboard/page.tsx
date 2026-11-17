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
  PlayCircle,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UsersRound,
} from '@sparktrack/ui';
import { createClient } from '../../../../lib/supabase/client';
import {
  AnimatedTelemetryBars,
  CapabilityRadarChart,
  SignalDonutChart,
} from '../../../../components/charts/capability-charts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const CHILD_INTERESTS = [
  'Coding & Programming',
  'Robotics',
  'Graphic Design',
  'AI & Data Science',
  'Business & Entrepreneurship',
  'Cybersecurity',
  'Video Production',
  'Web Development',
];

const EDUCATION_STAGES = [
  'JSS1',
  'JSS2',
  'JSS3',
  'SS1',
  'SS2',
  'SS3',
  'University / College',
  'Vocational / Apprenticeship',
  'Self-taught / no formal education',
  'Other',
];

interface ManagedChild {
  learnerId: string;
  fullName: string;
  educationStage: string;
  dateOfBirth: string;
  consentStatus: string;
  whatsappOptIn: boolean;
  declaredInterests: string[];
  schoolName: string | null;
  accessCode: string;
}

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
  skillScores?: Array<{
    code: string;
    score: number;
    progression: string;
    evidenceCount: number;
  }>;
  pathwayAffinities?: Array<{
    pathwayCode: string;
    pathwayName: string;
    pathwayType: string;
    affinityScore: number;
    isDivergentFromDeclared: boolean;
  }>;
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
  {
    id: 'overview',
    label: 'Overview & Interests',
    keys: ['executiveSummary', 'participationHistory', 'declaredVsObserved'],
  },
  {
    id: 'skills',
    label: 'Skills & Signals',
    keys: ['technicalSkills', 'creativeSkills', 'businessSkills', 'behaviouralSignals', 'capabilityMaturity'],
  },
  { id: 'pathways', label: 'Pathways to Explore', keys: ['careerPathways', 'entrepreneurshipPathways'] },
  {
    id: 'next',
    label: 'Progress & Next Steps',
    keys: ['longitudinalProgress', 'recommendedNextSteps', 'mentorInsights'],
  },
  { id: 'all', label: 'All 13 Sections', keys: SECTION_KEYS },
];

export default function ParentDashboardPage() {
  const [learnerId, setLearnerId] = useState('');
  const [childrenList, setChildrenList] = useState<ManagedChild[]>([]);
  const [showAddChild, setShowAddChild] = useState(false);
  const [childWhatsAppOptIn, setChildWhatsAppOptIn] = useState(false);
  const [childWhatsAppPhone, setChildWhatsAppPhone] = useState('');
  const [savingChildWhatsApp, setSavingChildWhatsApp] = useState(false);

  // Add Child Form State
  const [childName, setChildName] = useState('');
  const [childDob, setChildDob] = useState('2013-05-14');
  const [childStage, setChildStage] = useState('JSS2');
  const [childSchool, setChildSchool] = useState('');
  const [childInterests, setChildInterests] = useState<string[]>(['Robotics', 'Coding & Programming']);
  const [activateConsentNow, setActivateConsentNow] = useState(true);

  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [asOfDate, setAsOfDate] = useState('');
  const [snapshotSkills, setSnapshotSkills] = useState<
    Array<{ node_name: string; progression: string; score: number }>
  >([]);
  const [consentPrefs, setConsentPrefs] = useState<ConsentPreferences | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const selectedChild = childrenList.find((child) => child.learnerId === learnerId);

  async function authHeaders() {
    const { data } = await createClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Please sign in with your Parent/Guardian account at /auth first.');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  const loadManagedChildren = useCallback(async () => {
    try {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch(`${API_URL}/v1/auth/children`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const list = (await res.json()) as ManagedChild[];
        setChildrenList(list);
        if (list[0]) {
          setLearnerId(list[0].learnerId);
        }
      }
    } catch {
      // Optional when unauthenticated
    }
  }, []);

  useEffect(() => {
    setChildWhatsAppOptIn(selectedChild?.whatsappOptIn ?? false);
    setChildWhatsAppPhone('');
  }, [selectedChild?.learnerId, selectedChild?.whatsappOptIn]);

  async function saveChildWhatsAppPreference() {
    if (!selectedChild) return;
    setSavingChildWhatsApp(true);
    setError('');
    setNotice('');
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/v1/learning/learners/${selectedChild.learnerId}/whatsapp-preference`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          optIn: childWhatsAppOptIn,
          ...(childWhatsAppOptIn ? { phoneNumber: childWhatsAppPhone.trim() } : {}),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? 'Could not update the learner’s WhatsApp preference.');
      }
      setChildrenList((current) =>
        current.map((child) =>
          child.learnerId === selectedChild.learnerId ? { ...child, whatsappOptIn: childWhatsAppOptIn } : child,
        ),
      );
      setNotice(
        childWhatsAppOptIn
          ? 'Guardian preference saved. You will be asked to confirm before SparkTrack sends WhatsApp messages.'
          : 'WhatsApp reminders are turned off for this learner.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the WhatsApp preference.');
    } finally {
      setSavingChildWhatsApp(false);
    }
  }

  const loadConsentPreferences = useCallback(async (id: string) => {
    if (!id.trim()) return;
    try {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const [res, shareRes] = await Promise.all([
        fetch(`${API_URL}/v1/auth/consent/preferences/${id.trim()}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/v1/learning/learners/${id.trim()}/share-link`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (res.ok) setConsentPrefs((await res.json()) as ConsentPreferences);
      if (shareRes.ok) {
        const shareBody = (await shareRes.json()) as { token?: string | null };
        setShareToken(shareBody.token ?? null);
      }
    } catch {
      // Optional on initial load when not signed in
    }
  }, []);

  useEffect(() => {
    void loadManagedChildren();
    if (typeof window !== 'undefined' && window.location.search.includes('welcome=add-child')) {
      setShowAddChild(true);
    }
  }, [loadManagedChildren]);

  useEffect(() => {
    void loadConsentPreferences(learnerId);
  }, [learnerId, loadConsentPreferences]);

  const toggleChildInterest = (interest: string) => {
    setChildInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest],
    );
  };

  async function handleRegisterChild() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/v1/auth/children`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fullName: childName.trim(),
          dateOfBirth: childDob,
          educationStage: childStage,
          ...(childSchool.trim() ? { schoolName: childSchool.trim() } : {}),
          declaredInterests: childInterests,
          activateConsentImmediately: activateConsentNow,
          allowPublicPortfolio: false,
          allowPartnerTalentDiscovery: false,
        }),
      });
      const body = (await res.json()) as {
        learnerId?: string;
        fullName?: string;
        accessCode?: string;
        consentStatus?: string;
        message?: string;
      };
      if (!res.ok) throw new Error(body.message ?? 'Could not register child profile.');

      setNotice(
        `Registered ${body.fullName}! Student Access Code: ${body.accessCode} (Profile ID: ${body.learnerId}).`,
      );
      setChildName('');
      setShowAddChild(false);
      if (body.learnerId) {
        setLearnerId(body.learnerId);
      }
      await loadManagedChildren();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not register child.');
    } finally {
      setBusy(false);
    }
  }

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
      if (!body.allowPublicPortfolio || body.consentStatus !== 'VERIFIED_ACTIVE') {
        setShareToken(null);
      }
      setNotice(`Updated family privacy choices (${body.consentStatus}).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update privacy preferences.');
    } finally {
      setBusy(false);
    }
  }

  async function handleIssueShareLink(rotate: boolean) {
    if (!learnerId.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/v1/learning/learners/${learnerId.trim()}/share-link`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ rotate }),
      });
      const body = (await res.json()) as { token?: string; message?: string };
      if (!res.ok) throw new Error(body.message ?? 'Could not create portfolio share link.');
      setShareToken(body.token ?? null);
      setNotice(rotate ? 'Generated a new portfolio share link (previous link deactivated).' : 'Portfolio share link is ready.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create portfolio share link.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeShareLink() {
    if (!learnerId.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/v1/learning/learners/${learnerId.trim()}/share-link`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error('Could not revoke portfolio share link.');
      setShareToken(null);
      setNotice('Portfolio share link revoked.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not revoke portfolio share link.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyShareLink() {
    if (!shareToken || typeof window === 'undefined') return;
    const url = `${window.location.origin}/p/${shareToken}`;
    await navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
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
      const data = (await res.json()) as {
        skills: Array<{ node_name: string; progression: string; score: number }>;
      };
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
        {/* Hero Header */}
        <div className="spark-enter flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-spark-700">
              Parent &amp; Guardian Hub
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Support their growth with confidence.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Register an under-18 learner from JSS1 onwards, including learners outside formal education. Control NDPA
              privacy choices and explore their evidence-backed 13-part development report.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link href="/demo?role=parent">
              <Button variant="outline">
                <PlayCircle size={16} className="mr-2" aria-hidden="true" />
                Interactive Demo Report
              </Button>
            </Link>
            <Button onClick={() => setShowAddChild((v) => !v)}>
              <UserPlus size={16} className="mr-2" aria-hidden="true" />
              {showAddChild ? 'Close Learner Form' : 'Add Under-18 Learner'}
            </Button>
            <Link href="/parent/consent">
              <Button variant="outline">
                <ShieldCheck size={16} className="mr-2" aria-hidden="true" />
                Verify SMS Consent Code
              </Button>
            </Link>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900"
          >
            {notice}
          </p>
        )}

        {/* REGISTERED CHILDREN BAR */}
        {childrenList.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <UsersRound className="h-4 w-4 text-spark-600" /> My Children:
            </span>
            {childrenList.map((child) => {
              const selected = learnerId === child.learnerId;
              return (
                <button
                  key={child.learnerId}
                  type="button"
                  onClick={() => setLearnerId(child.learnerId)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                    selected
                      ? 'border-spark-500 bg-spark-50 text-spark-900 shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                  }`}
                >
                  <span>
                    {child.fullName} ({child.educationStage})
                  </span>
                  <Badge variant={child.consentStatus === 'VERIFIED_ACTIVE' ? 'success' : 'warning'}>
                    {child.accessCode}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}

        {selectedChild?.consentStatus === 'VERIFIED_ACTIVE' && (
          <Card className="border-emerald-200/80">
            <CardHeader>
              <CardTitle className="text-base">Keep your learner connected</CardTitle>
              <CardDescription>
                As their verified guardian, choose whether you prefer SparkTrack learning reminders on WhatsApp.
                Messages require a separate confirmation before they begin.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <label className="flex items-start gap-3 text-slate-700">
                <input
                  type="checkbox"
                  checked={childWhatsAppOptIn}
                  onChange={(event) => setChildWhatsAppOptIn(event.target.checked)}
                  className="mt-1"
                />
                <span>WhatsApp is my preferred channel for updates about this learner.</span>
              </label>
              {childWhatsAppOptIn && (
                <Input
                  value={childWhatsAppPhone}
                  onChange={(event) => setChildWhatsAppPhone(event.target.value)}
                  type="tel"
                  placeholder="Guardian WhatsApp number (+234…)"
                />
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={savingChildWhatsApp || (childWhatsAppOptIn && childWhatsAppPhone.trim().length < 8)}
                onClick={() => void saveChildWhatsAppPreference()}
              >
                {savingChildWhatsApp ? 'Saving…' : 'Save guardian preference'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ADD CHILD / WARD DRAWER CARD */}
        {showAddChild && (
          <Card className="border-spark-300 shadow-lg">
            <div className="h-1.5 bg-gradient-to-r from-coral-500 via-spark-600 to-cyan-500" />
            <CardHeader>
              <CardTitle className="text-lg">Register an Under-18 Learner (JSS1 onwards)</CardTitle>
              <CardDescription>
                Create your child’s learner profile under your guardian account. You will receive their unique Learner
                ID and Access Code immediately.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Child’s Full Name</label>
                  <Input
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    placeholder="e.g. Tobi Adeyemi"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Date of Birth</label>
                  <Input type="date" value={childDob} onChange={(e) => setChildDob(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Class / Education Stage</label>
                  <select
                    value={childStage}
                    onChange={(e) => setChildStage(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-900"
                  >
                    {EDUCATION_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">School Name (optional)</label>
                  <Input
                    value={childSchool}
                    onChange={(e) => setChildSchool(e.target.value)}
                    placeholder="e.g. King's College Lagos"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700">
                  Initial Curiosity Areas (select at least 1 — your child can explore more anytime):
                </p>
                <div className="flex flex-wrap gap-2">
                  {CHILD_INTERESTS.map((interest) => {
                    const active = childInterests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => toggleChildInterest(interest)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                          active
                            ? 'border-spark-500 bg-spark-50 text-spark-900'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs font-medium text-emerald-950">
                <input
                  type="checkbox"
                  checked={activateConsentNow}
                  onChange={(e) => setActivateConsentNow(e.target.checked)}
                />
                <span>
                  As this child’s parent/legal guardian, I grant NDPA 2023 consent for SparkTrack to record learning
                  projects and generate developmental reports (profile remains private by default).
                </span>
              </label>

              <div className="flex justify-end gap-2.5">
                <Button variant="outline" onClick={() => setShowAddChild(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={busy || childName.trim().length < 2 || childInterests.length === 0}
                  onClick={() => void handleRegisterChild()}
                >
                  <UserPlus size={15} className="mr-1.5" />
                  {busy ? 'Registering Child…' : 'Create Child Learner Profile'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* NDPA PRIVACY CONTROLS */}
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
                    Every minor profile defaults to private. Once consent is verified, you can adjust sharing or
                    withdraw consent here at any time.
                  </CardDescription>
                </div>
              </div>
              {consentPrefs && (
                <Badge variant={consentPrefs.consentStatus === 'VERIFIED_ACTIVE' ? 'success' : 'warning'}>
                  {consentPrefs.consentStatus === 'VERIFIED_ACTIVE' ? 'Consent Active' : 'Pending Approval'}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {consentPrefs ? (
              <div className="space-y-3">
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

                {consentPrefs.consentStatus === 'VERIFIED_ACTIVE' && consentPrefs.allowPublicPortfolio && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs">
                    <div>
                      <p className="font-bold text-emerald-950">Shareable Portfolio Link</p>
                      <p className="mt-0.5 text-emerald-800">
                        {shareToken
                          ? `Active link: /p/${shareToken} (never exposes internal profile IDs)`
                          : 'Create a revocable public portfolio link for schools, scholarships, or internships.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {shareToken ? (
                        <>
                          <Link href={`/p/${shareToken}`}>
                            <Button size="sm" variant="outline">
                              Open Link
                            </Button>
                          </Link>
                          <Button size="sm" onClick={() => void handleCopyShareLink()}>
                            {shareCopied ? 'Copied!' : 'Copy Link'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void handleIssueShareLink(true)}
                          >
                            Rotate Link
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void handleRevokeShareLink()}
                          >
                            Revoke
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" disabled={busy} onClick={() => void handleIssueShareLink(false)}>
                          Create Share Link
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Sign in with your Parent/Guardian account at{' '}
                <Link href="/auth?mode=signin&role=PARENT" className="font-semibold text-spark-700 underline">
                  /auth
                </Link>{' '}
                to manage live sharing toggles or register a child (or preview all 4 case-study reports in the{' '}
                <Link href="/demo?role=parent" className="font-semibold text-spark-700 underline">
                  Interactive Demo Center
                </Link>
                ).
              </p>
            )}
          </CardContent>
        </Card>

        {/* 13-PART REPORT GENERATOR & TIME TRAVEL */}
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
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <label htmlFor="learner-id" className="sr-only">
                Learner profile ID
              </label>
              <Input
                id="learner-id"
                value={learnerId}
                onChange={(e) => setLearnerId(e.target.value)}
                placeholder="Enter learner profile ID"
                className="min-w-[240px] flex-1"
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
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !learnerId.trim()}
                onClick={() => void loadTimeTravelSnapshot()}
              >
                Compare snapshot
              </Button>
            </div>

            {snapshotSkills.length > 0 && (
              <div className="space-y-2 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Past Progress Snapshot
                </p>
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
                      Progress Report
                    </CardTitle>
                    <CardDescription>
                      Prepared on {new Date(report.generatedAt).toLocaleDateString()} · Practical guidance based on verified projects
                    </CardDescription>
                  </div>
                  <div className="no-print flex flex-wrap items-center gap-2">
                    <Badge variant={report.guardrailResult?.passed ? 'competent' : 'destructive'}>
                      {report.guardrailResult?.passed
                        ? 'Child-Safe Guidance Verified'
                        : 'Needs Review'}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => window.print()}>
                      Print / Save PDF
                    </Button>
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

            {(report.skillScores?.length || report.pathwayAffinities?.length) ? (
              <div className="grid gap-5 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Observed Skill Shape</CardTitle>
                    <CardDescription>
                      Interactive view of the skills your child has shown across verified projects.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CapabilityRadarChart
                      items={(report.skillScores ?? []).map((s) => ({
                        label: s.code.replace(/^SKILL_|^SIG_/, '').replace(/_/g, ' '),
                        value: Math.round(s.score * 100),
                        meta: s.progression,
                        detail: `${s.evidenceCount} ${s.evidenceCount === 1 ? 'project' : 'projects'}`,
                      }))}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Skill Maturity Mix</CardTitle>
                    <CardDescription>
                      How skills are distributed across learning stages.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SignalDonutChart
                      centerLabel={String(report.skillScores?.length ?? 0)}
                      centerSublabel="Active Skills"
                      segments={[
                        {
                          label: 'Advanced',
                          value: (report.skillScores ?? []).filter((s) => s.progression === 'ADVANCED').length,
                          color: '#059669',
                        },
                        {
                          label: 'Competent',
                          value: (report.skillScores ?? []).filter((s) => s.progression === 'COMPETENT').length,
                          color: '#2563eb',
                        },
                        {
                          label: 'Developing',
                          value: (report.skillScores ?? []).filter((s) => s.progression === 'DEVELOPING').length,
                          color: '#0891b2',
                        },
                        {
                          label: 'Beginner',
                          value: (report.skillScores ?? []).filter((s) => s.progression === 'BEGINNER').length,
                          color: '#d97706',
                        },
                      ]}
                    />
                  </CardContent>
                </Card>

                {(report.pathwayAffinities?.length ?? 0) > 0 && (
                  <Card className="lg:col-span-3">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Career &amp; Entrepreneurship Pathways Worth Exploring</CardTitle>
                      <CardDescription>
                        Match strength based on current project evidence—options to try, not fixed predictions.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <AnimatedTelemetryBars
                        items={(report.pathwayAffinities ?? []).slice(0, 5).map((p) => ({
                          label: p.pathwayName,
                          value: Math.round(p.affinityScore * 100),
                          badge: p.isDivergentFromDeclared ? 'New strength' : p.pathwayType.replace(/_/g, ' '),
                          subtitle: p.isDivergentFromDeclared
                            ? 'Stronger than their initial interests—worth exploring together.'
                            : 'Aligned with their declared curiosity areas.',
                        }))}
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : null}

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
