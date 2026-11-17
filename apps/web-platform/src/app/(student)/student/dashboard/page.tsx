'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SyncEngine, type PendingArtifact, type SyncStatus } from '@sparktrack/offline-sync';
import type { ArtifactType } from '@sparktrack/contracts';
import {
  Activity,
  ArrowRight,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Check,
  Compass,
  FolderKanban,
  Input,
  PlayCircle,
  ShieldCheck,
  Sparkles,
} from '@sparktrack/ui';
import { createClient } from '../../../../lib/supabase/client';
import {
  CapabilityRadarChart,
  GrowthTrajectoryAreaChart,
  SignalDonutChart,
} from '../../../../components/charts/capability-charts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const API_BASE = API_URL.replace(/\/api\/?$/, '');

interface SkillNode {
  id: string;
  code: string;
  name: string;
  category: string | null;
  description: string;
}

interface LearnerSummary {
  learnerId: string;
  fullName: string;
  ageGroup: 'UNDER_18' | 'ADULT';
  educationStage: string;
  learnerStage: string;
  educationLevel: string | null;
  learningGoal: string;
  currentRole: string | null;
  targetRole: string | null;
  whatsappOptIn: boolean;
  consentStatus: string;
  declaredInterests: string[];
  totalArtifacts: number;
  lastEvidenceDate: string | null;
}

const STAGE_LABELS: Record<string, string> = {
  SECONDARY_SCHOOL: 'Secondary school',
  UNIVERSITY: 'University / college',
  NYSC: 'NYSC',
  EMPLOYED: 'Working',
  CAREER_TRANSITION: 'Career transition',
  CAREER_GROWTH: 'Career growth',
  SELF_TAUGHT: 'Independent learning',
  NO_FORMAL_EDUCATION: 'Learning outside formal education',
  OTHER: 'Learning journey',
};
const GOAL_LABELS: Record<string, string> = {
  EXPLORE_INTERESTS: 'Explore interests',
  BUILD_PRACTICAL_SKILLS: 'Build practical skills',
  GET_FIRST_JOB: 'Prepare for a first job',
  CHANGE_CAREER: 'Change careers',
  GROW_IN_CAREER: 'Grow in a career',
  START_BUSINESS: 'Start a business',
  RETURN_TO_EDUCATION: 'Return to education',
  PERSONAL_GROWTH: 'Personal growth',
  OTHER: 'A personal goal',
};

interface SealedArtifact {
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
}

interface ComputedSkillScore {
  code: string;
  score: number;
  progression: 'BEGINNER' | 'DEVELOPING' | 'COMPETENT' | 'ADVANCED';
  evidenceCount: number;
}

interface PathwayAffinityItem {
  pathwayCode: string;
  pathwayName: string;
  pathwayType: string;
  affinityScore: number;
  isDivergentFromDeclared: boolean;
}

const ARTIFACT_TYPES: Array<{ value: ArtifactType; label: string }> = [
  { value: 'PROJECT_SUBMISSION', label: 'Project Submission' },
  { value: 'GIT_REPOSITORY', label: 'Code / Git Repository' },
  { value: 'DESIGN_PORTFOLIO', label: 'Design Portfolio' },
  { value: 'BUSINESS_PROTOTYPE', label: 'Business Prototype' },
  { value: 'LEARNER_REFLECTION', label: 'Learner Reflection' },
];

function formatSkillCode(code: string, catalogue: SkillNode[]): string {
  const found = catalogue.find((s) => s.code === code);
  if (found) return found.name;
  return code
    .replace(/^SKILL_|^SIG_/, '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StudentDashboardPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [summary, setSummary] = useState<LearnerSummary | null>(null);
  const [catalogue, setCatalogue] = useState<SkillNode[]>([]);
  const [artifacts, setArtifacts] = useState<SealedArtifact[]>([]);
  const [queuedLocal, setQueuedLocal] = useState<PendingArtifact[]>([]);
  const [skillScores, setSkillScores] = useState<ComputedSkillScore[]>([]);
  const [pathways, setPathways] = useState<PathwayAffinityItem[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  const [title, setTitle] = useState('');
  const [artifactType, setArtifactType] = useState<ArtifactType>('PROJECT_SUBMISSION');
  const [description, setDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [coachingTip, setCoachingTip] = useState('');
  const [suggestingSkills, setSuggestingSkills] = useState(false);
  const [busy, setBusy] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [savingWhatsAppPreference, setSavingWhatsAppPreference] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const syncEngine = useMemo(
    () =>
      new SyncEngine({
        apiBaseUrl: API_BASE,
        getAccessToken: async () => {
          const { data } = await createClient().auth.getSession();
          return data.session?.access_token ?? null;
        },
      }),
    [],
  );

  const refreshDashboard = useCallback(async () => {
    const [status, localItems] = await Promise.all([
      syncEngine.getStatus(),
      syncEngine.listQueuedArtifacts(),
    ]);
    setSyncStatus(status);
    setQueuedLocal(localItems);

    const skillsRes = await fetch(`${API_URL}/v1/learning/skills`).catch(() => null);
    if (skillsRes?.ok) setCatalogue((await skillsRes.json()) as SkillNode[]);

    const { data } = await createClient().auth.getSession();
    const token = data.session?.access_token;
    const uid = data.session?.user?.id ?? null;
    setUserId(uid);
    if (!token || !uid) return;

    const headers = { Authorization: `Bearer ${token}` };
    const [sumRes, artRes, scoreRes, pathRes] = await Promise.all([
      fetch(`${API_URL}/v1/learning/learners/${uid}/summary`, { headers }).catch(() => null),
      fetch(`${API_URL}/v1/learning/learners/${uid}/artifacts`, { headers }).catch(() => null),
      fetch(`${API_URL}/v1/skills/${uid}/scores`, { headers }).catch(() => null),
      fetch(`${API_URL}/v1/pathways/${uid}/affinities`, { headers }).catch(() => null),
    ]);

    if (sumRes?.ok) {
      const nextSummary = (await sumRes.json()) as LearnerSummary;
      setSummary(nextSummary);
      setWhatsappOptIn(nextSummary.whatsappOptIn);
    }
    if (artRes?.ok) setArtifacts((await artRes.json()) as SealedArtifact[]);
    if (scoreRes?.ok) {
      const s = (await scoreRes.json()) as { scores: ComputedSkillScore[] };
      setSkillScores(s.scores ?? []);
    }
    if (pathRes?.ok) setPathways((await pathRes.json()) as PathwayAffinityItem[]);
  }, [syncEngine]);

  async function saveWhatsAppPreference() {
    if (!userId) return;
    setSavingWhatsAppPreference(true);
    setError('');
    setNotice('');
    try {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Sign in again to update your messaging preference.');
      const response = await fetch(`${API_URL}/v1/learning/learners/${userId}/whatsapp-preference`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          optIn: whatsappOptIn,
          ...(whatsappOptIn ? { phoneNumber: whatsappPhone.trim() } : {}),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? 'Could not update your WhatsApp preference.');
      }
      setSummary((current) => (current ? { ...current, whatsappOptIn } : current));
      setNotice(
        whatsappOptIn
          ? 'Preference saved. You will be asked to confirm before SparkTrack sends WhatsApp messages.'
          : 'WhatsApp reminders are turned off.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update your WhatsApp preference.');
    } finally {
      setSavingWhatsAppPreference(false);
    }
  }

  useEffect(() => {
    void refreshDashboard();
    const handleReconnect = () => {
      void syncEngine.syncAll().then(() => refreshDashboard());
    };
    window.addEventListener('online', handleReconnect);
    return () => window.removeEventListener('online', handleReconnect);
  }, [refreshDashboard, syncEngine]);

  const toggleSkill = (code: string) =>
    setSelectedSkills((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  async function suggestSkillsWithAi() {
    if (!title.trim() && !description.trim()) {
      setError('Write a project title or short description first so we can suggest matching skills.');
      return;
    }
    setSuggestingSkills(true);
    setError('');
    try {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        const res = await fetch(`${API_URL}/v1/reports/suggest-skills`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: title.trim() || 'Student Project',
            description: description.trim(),
            artifactType,
          }),
        });
        if (res.ok) {
          const body = (await res.json()) as {
            suggestedSkillCodes?: string[];
            coachingTip?: string;
          };
          const suggested = body.suggestedSkillCodes ?? [];
          if (suggested.length > 0) {
            setSelectedSkills((prev) => Array.from(new Set([...prev, ...suggested])));
          }
          if (body.coachingTip) {
            setCoachingTip(body.coachingTip);
          }
          return;
        }
      }
      // Local offline fallback when not signed in
      const hay = `${title} ${description}`.toLowerCase();
      const matched = catalogue
        .filter((s) =>
          `${s.name} ${s.description}`.toLowerCase().split(/\W+/).some((w) => w.length >= 4 && hay.includes(w)),
        )
        .slice(0, 3)
        .map((s) => s.code);
      const fallback = matched.length > 0 ? matched : catalogue.slice(0, 2).map((s) => s.code);
      setSelectedSkills((prev) => Array.from(new Set([...prev, ...fallback])));
      setCoachingTip('Describe what you built, what challenge you solved, and how you tested your work.');
    } catch {
      setError('Could not suggest skills right now.');
    } finally {
      setSuggestingSkills(false);
    }
  }

  async function submitEvidence() {
    if (!userId || !title.trim() || selectedSkills.length === 0) {
      setError('Enter a project title and select at least one skill you used.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const storageR2Keys: string[] = [];
      if (attachmentFile) {
        const { data: sessionData } = await createClient().auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          const presignRes = await fetch(`${API_URL}/v1/learning/storage/presign`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              learnerId: userId,
              fileName: attachmentFile.name,
              contentType: attachmentFile.type || 'application/octet-stream',
            }),
          });
          if (presignRes.ok) {
            const ticket = (await presignRes.json()) as {
              mode?: 'LIVE' | 'SANDBOX_SIMULATION';
              r2Key: string;
              uploadUrl: string;
              contentType: string;
            };
            if (ticket.mode === 'SANDBOX_SIMULATION' || ticket.uploadUrl.startsWith('sandbox://')) {
              storageR2Keys.push(ticket.r2Key);
            } else {
              let uploadRes: Response;
              try {
                uploadRes = await fetch(ticket.uploadUrl, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': ticket.contentType,
                  },
                  body: attachmentFile,
                });
              } catch {
                throw new Error(
                  'Could not upload your attachment right now. Please check your connection and try again.',
                );
              }
              if (!uploadRes.ok) {
                throw new Error('Could not upload your file. Please try again.');
              }
              storageR2Keys.push(ticket.r2Key);
            }
          } else {
            throw new Error(
              'Could not prepare the file upload. Please try again in a moment.',
            );
          }
        } else {
          throw new Error('Sign in again before uploading your attachment.');
        }
      }

      await syncEngine.queueArtifact({
        clientSyncId: crypto.randomUUID(),
        learnerId: userId,
        artifactType,
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        storageR2Keys,
        externalUrls: externalUrl.trim() ? [externalUrl.trim()] : [],
        payload: { schema_version: '1.0', skill_codes: selectedSkills },
        complexityWeight: 1.0,
        capturedOfflineAt: new Date().toISOString(),
      });
      const syncResult = await syncEngine.syncAll();
      setTitle('');
      setDescription('');
      setExternalUrl('');
      setAttachmentFile(null);
      setSelectedSkills([]);
      await refreshDashboard();

      if (syncResult.syncedCount > 0 && syncResult.failedCount === 0) {
        setNotice('Confirmed! Your project was synced and sealed on the server.');
      } else if (syncResult.failedCount > 0) {
        setNotice(
          `Saved on this device (${syncResult.pendingCount} queued). Server sync needs attention (${syncResult.lastError ?? 'offline'}) — use "Sync saved work" when ready.`,
        );
      } else {
        setNotice('Saved on this device. It will sync automatically when you are online and signed in.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save evidence.');
    } finally {
      setBusy(false);
    }
  }

  async function runManualSync() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await syncEngine.syncAll();
      await refreshDashboard();
      if (res.syncedCount > 0) {
        setNotice(`Synced and confirmed ${res.syncedCount} ${res.syncedCount === 1 ? 'item' : 'items'} with the server.`);
      } else if (res.skippedNoAuth) {
        setError('Please sign in so your saved device items can sync to your learner space.');
      } else if (res.failedCount > 0) {
        setError(
          `Could not sync right now (${res.lastError ?? 'connection issue'}). Your work remains safely saved on this device.`,
        );
      } else {
        setNotice('Everything on this device is already up to date.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function resendConsent() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Sign in to request parental consent.');
      const res = await fetch(`${API_URL}/v1/auth/consent/request`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `Request failed (${res.status})`);
      }
      setNotice('Parental consent SMS sent. Ask your parent or guardian to enter the 6-digit code.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send consent SMS.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="spark-enter flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-spark-700">Your learning space</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              {summary ? `Keep your momentum, ${summary.fullName.split(' ')[0]}.` : 'Your next idea starts here.'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {summary
                ? `${STAGE_LABELS[summary.learnerStage] ?? 'Your learning journey'}${summary.educationLevel ? ` · ${summary.educationLevel}` : ''} · ${GOAL_LABELS[summary.learningGoal] ?? 'Building your next step'}`
                : 'From JSS1 onwards, university, NYSC, work, career changes, or learning outside school—build skills and proof at your own pace.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {!userId && (
              <>
                <Link href="/demo?role=student" className="inline-flex">
                  <span className="inline-flex h-12 items-center justify-center rounded-xl border border-spark-200 bg-spark-50 px-5 text-sm font-bold text-spark-800 transition-all hover:bg-spark-100">
                    <PlayCircle size={17} className="mr-2" aria-hidden="true" />
                    Explore Interactive Demo
                  </span>
                </Link>
                <Link href="/student/onboarding" className="inline-flex">
                  <span className="inline-flex h-12 items-center justify-center rounded-xl bg-spark-600 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-spark-800">
                    Create your learner space <ArrowRight size={17} className="ml-2" aria-hidden="true" />
                  </span>
                </Link>
              </>
            )}
            {userId && summary?.consentStatus === 'VERIFIED_ACTIVE' && (
              <a
                href="#add-evidence"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-spark-600 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-spark-800"
              >
                Add a project <ArrowRight size={17} className="ml-2" aria-hidden="true" />
              </a>
            )}
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

        <div className="spark-stagger grid gap-6 md:grid-cols-3">
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-spark-50 text-spark-700">
                  <Activity size={19} aria-hidden="true" />
                </span>
                <Badge variant={syncStatus?.isOnline !== false ? 'competent' : 'warning'}>
                  {syncStatus?.isOnline !== false ? 'Online' : 'Offline Mode'}
                </Badge>
              </div>
              <CardTitle className="mt-3 text-base">Your saved work</CardTitle>
              <CardDescription>Projects stay safely on this device until confirmed by the server.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5">
                <span className="text-slate-600">Saved locally (waiting to sync)</span>
                <span className="font-bold text-slate-900">{syncStatus?.totalPending ?? 0}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={busy}
                onClick={() => void runManualSync()}
              >
                {busy ? 'Syncing…' : 'Sync saved work'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <ShieldCheck size={19} aria-hidden="true" />
                </span>
                <Badge variant={summary?.consentStatus === 'VERIFIED_ACTIVE' ? 'competent' : 'developing'}>
                  {summary?.consentStatus === 'VERIFIED_ACTIVE'
                    ? summary.ageGroup === 'ADULT'
                      ? 'Self-managed'
                      : 'Guardian Verified'
                    : summary?.consentStatus === 'PENDING_PARENTAL_CONSENT'
                      ? 'Awaiting Guardian'
                      : 'Setup Needed'}
                </Badge>
              </div>
              <CardTitle className="mt-3 text-base">Privacy &amp; permissions</CardTitle>
              <CardDescription>
                {summary?.ageGroup === 'ADULT'
                  ? 'You manage your profile and sharing preferences.'
                  : 'A parent or guardian controls permissions for learners under 18.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5">
                <span className="text-slate-600">Confirmed projects</span>
                <span className="font-bold text-slate-900">{summary?.totalArtifacts ?? artifacts.length}</span>
              </div>
              {summary && summary.consentStatus !== 'VERIFIED_ACTIVE' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={busy}
                  onClick={() => void resendConsent()}
                >
                  Resend Guardian Consent SMS
                </Button>
              )}
            </CardContent>
          </Card>

          {summary?.ageGroup === 'ADULT' && (
            <Card>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Activity size={19} aria-hidden="true" />
                </div>
                <CardTitle className="mt-3 text-base">Stay in your flow</CardTitle>
                <CardDescription>
                  Choose where you would prefer SparkTrack reminders. You will confirm before messages begin.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <label className="flex items-start gap-3 text-slate-700">
                  <input
                    type="checkbox"
                    checked={whatsappOptIn}
                    onChange={(event) => setWhatsappOptIn(event.target.checked)}
                    className="mt-1"
                  />
                  <span>WhatsApp is my preferred channel for learning reminders.</span>
                </label>
                {whatsappOptIn && (
                  <Input
                    value={whatsappPhone}
                    onChange={(event) => setWhatsappPhone(event.target.value)}
                    type="tel"
                    placeholder="WhatsApp number (+234…)"
                  />
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={savingWhatsAppPreference || (whatsappOptIn && whatsappPhone.trim().length < 8)}
                  onClick={() => void saveWhatsAppPreference()}
                >
                  {savingWhatsAppPreference ? 'Saving…' : 'Save preference'}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                  <Sparkles size={19} aria-hidden="true" />
                </span>
                <Badge variant="secondary">{skillScores.length} active signals</Badge>
              </div>
              <CardTitle className="mt-3 text-base">Skills you’re growing</CardTitle>
              <CardDescription>Evolving signals from the projects you’ve shared.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {skillScores.length === 0 ? (
                <p className="text-slate-500">Add a project below to see your first skill signals appear.</p>
              ) : (
                skillScores.slice(0, 5).map((s) => (
                  <div key={s.code} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate pr-2 font-medium text-slate-800">
                        {formatSkillCode(s.code, catalogue)}
                      </span>
                      <Badge
                        variant={
                          s.progression.toLowerCase() as 'beginner' | 'developing' | 'competent' | 'advanced'
                        }
                      >
                        {s.progression} ({Math.round(s.score * 100)}%)
                      </Badge>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-spark-600 transition-all"
                        style={{ width: `${Math.min(100, Math.round(s.score * 100))}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {skillScores.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Your Skill Shape</CardTitle>
                <CardDescription>
                  Interactive view of your strongest skills from projects and mentor reviews.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CapabilityRadarChart
                  items={skillScores.map((s) => ({
                    label: formatSkillCode(s.code, catalogue),
                    value: Math.round(s.score * 100),
                    meta: s.progression,
                    detail: `${s.evidenceCount} ${s.evidenceCount === 1 ? 'project' : 'projects'}`,
                  }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Project Mix &amp; Momentum</CardTitle>
                <CardDescription>
                  Breakdown of your work and progress over time.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <SignalDonutChart
                  centerLabel={String(artifacts.length)}
                  centerSublabel="Confirmed Projects"
                  segments={[
                    {
                      label: 'Mentor Verified',
                      value: artifacts.filter((a) => a.mentorVerified).length,
                      color: '#059669',
                    },
                    {
                      label: 'Awaiting Review',
                      value: artifacts.filter((a) => !a.mentorVerified).length,
                      color: '#2563eb',
                    },
                  ]}
                />
                <GrowthTrajectoryAreaChart
                  points={[...artifacts]
                    .reverse()
                    .slice(-6)
                    .map((a, idx) => ({
                      label: a.title.length > 22 ? `${a.title.slice(0, 20)}…` : a.title,
                      value: a.qualityScore !== null ? Math.round(a.qualityScore * 100) : Math.min(95, 55 + idx * 8),
                      detail: a.mentorVerified ? 'Mentor verified' : 'Submitted',
                    }))}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {pathways.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-800">
                  <Compass size={19} aria-hidden="true" />
                </span>
                <div>
                  <CardTitle className="text-base">Ideas worth exploring</CardTitle>
                  <CardDescription>
                    Possibilities suggested by your recent hands-on projects—options to try, never fixed predictions.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {pathways.map((p) => (
                <div key={p.pathwayCode} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900">{p.pathwayName}</span>
                    <Badge variant="secondary">{Math.round(p.affinityScore * 100)}% match</Badge>
                  </div>
                  {p.isDivergentFromDeclared && (
                    <p className="rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900">
                      New strength emerging beyond your initial interests—worth a look!
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card id="add-evidence" className="overflow-hidden">
            <CardHeader>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-spark-50 text-spark-700">
                  <Sparkles size={19} aria-hidden="true" />
                </span>
                <div>
                  <CardTitle className="text-base">Add something you’ve worked on</CardTitle>
                  <CardDescription>
                    Tell us what you made or practiced. You can save it even if you’re offline.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block space-y-1.5 text-sm font-semibold text-slate-800">
                What did you work on?
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give your project or activity a name"
                />
              </label>
              <label className="block space-y-1.5 text-sm font-semibold text-slate-800">
                Type of work
                <select
                  aria-label="Artifact type"
                  value={artifactType}
                  onChange={(e) => setArtifactType(e.target.value as ArtifactType)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                >
                  {ARTIFACT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5 text-sm font-semibold text-slate-800">
                What did you learn or try?
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A few sentences about what you made, tested, or discovered…"
                  rows={3}
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-normal text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:border-spark-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-spark-100"
                />
              </label>
              <label className="block space-y-1.5 text-sm font-semibold text-slate-800">
                Link to your work <span className="font-normal text-slate-500">(optional)</span>
                <Input
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  type="url"
                  placeholder="Paste a link to a project, design, or video"
                />
              </label>

              <label className="block space-y-1.5 text-sm font-semibold text-slate-800">
                Attach a file{' '}
                <span className="font-normal text-slate-500">(optional — image, PDF, or zip)</span>
                <Input
                  type="file"
                  accept="image/*,.pdf,.zip,.mp4,.mp3"
                  onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
                  className="py-2 text-xs"
                />
                {attachmentFile && (
                  <span className="block text-xs font-normal text-spark-700">
                    Selected file: {attachmentFile.name} ({Math.round(attachmentFile.size / 1024)} KB)
                  </span>
                )}
              </label>

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-700">
                    What skills did you use? <span className="text-slate-400">({selectedSkills.length} selected)</span>
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={suggestingSkills || (!title.trim() && !description.trim())}
                    onClick={() => void suggestSkillsWithAi()}
                  >
                    <Sparkles size={14} className="mr-1.5" aria-hidden="true" />
                    {suggestingSkills ? 'Suggesting…' : 'Auto-Suggest Skills'}
                  </Button>
                </div>
                {coachingTip && (
                  <p className="mb-2.5 rounded-xl border border-spark-200 bg-spark-50/70 px-3 py-2 text-xs leading-relaxed text-spark-900">
                    <strong>Tip:</strong> {coachingTip}
                  </p>
                )}
                <div className="grid max-h-52 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {catalogue.map((skill) => {
                    const active = selectedSkills.includes(skill.code);
                    return (
                      <button
                        key={skill.code}
                        type="button"
                        onClick={() => toggleSkill(skill.code)}
                        aria-pressed={active}
                        className={`flex items-center justify-between rounded-xl border p-3 text-left text-sm transition-all ${
                          active
                            ? 'border-spark-500 bg-spark-50 font-semibold text-spark-900 shadow-sm ring-2 ring-spark-100'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span>{skill.name}</span>
                        {active && <Check size={15} className="shrink-0 text-spark-700" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button size="lg" className="w-full" disabled={busy || !userId} onClick={() => void submitEvidence()}>
                {busy ? 'Saving your work…' : 'Save your evidence'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <FolderKanban size={19} aria-hidden="true" />
                </span>
                <div>
                  <CardTitle className="text-base">Your project collection</CardTitle>
                  <CardDescription>
                    Shows both items saved on this device and projects confirmed on the server.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {queuedLocal.map((local) => (
                <div
                  key={local.clientSyncId}
                  className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-1.5 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">{local.title}</span>
                    <Badge variant="warning">
                      {local.syncStatus === 'failed' ? 'Saved on device · Retry pending' : 'Saved on this device'}
                    </Badge>
                  </div>
                  {local.description && <p className="text-xs text-slate-600">{local.description}</p>}
                  {local.lastError && <p className="text-xs text-amber-900">Last sync note: {local.lastError}</p>}
                </div>
              ))}

              {artifacts.length === 0 && queuedLocal.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                  No projects in your collection yet. Add your first project on the left to begin (or explore the{' '}
                  <Link href="/demo?role=student" className="font-bold text-spark-700 underline">
                    Interactive Product Demo
                  </Link>
                  )!
                </div>
              ) : (
                artifacts.map((art) => (
                  <div key={art.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{art.title}</span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={art.mentorVerified ? 'competent' : 'developing'}>
                          {art.mentorVerified ? 'Mentor Verified' : 'Confirmed on Server'}
                        </Badge>
                      </div>
                    </div>
                    {art.description && <p className="text-xs leading-5 text-slate-600">{art.description}</p>}
                    <div className="flex flex-wrap gap-1.5">
                      {art.skillCodes.map((code) => (
                        <Badge key={code} variant="secondary">
                          {formatSkillCode(code, catalogue)}
                        </Badge>
                      ))}
                    </div>
                    {art.rowSignatureHash && (
                      <details className="border-t border-slate-100 pt-2">
                        <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-800">
                          View authenticity proof (Block #{art.ledgerSeq})
                        </summary>
                        <p className="mt-1.5 break-all font-mono text-[11px] text-slate-500">
                          SHA-256: {art.rowSignatureHash}
                        </p>
                      </details>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
