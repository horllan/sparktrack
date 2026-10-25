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
  ShieldCheck,
  Sparkles,
} from '@sparktrack/ui';
import { createClient } from '../../../../lib/supabase/client';

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
  educationStage: string;
  consentStatus: string;
  declaredInterests: string[];
  totalArtifacts: number;
  lastEvidenceDate: string | null;
}

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
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
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

    if (sumRes?.ok) setSummary((await sumRes.json()) as LearnerSummary);
    if (artRes?.ok) setArtifacts((await artRes.json()) as SealedArtifact[]);
    if (scoreRes?.ok) {
      const s = (await scoreRes.json()) as { scores: ComputedSkillScore[] };
      setSkillScores(s.scores ?? []);
    }
    if (pathRes?.ok) setPathways((await pathRes.json()) as PathwayAffinityItem[]);
  }, [syncEngine]);

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

  async function submitEvidence() {
    if (!userId || !title.trim() || selectedSkills.length === 0) {
      setError('Enter a project title and select at least one skill you used.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await syncEngine.queueArtifact({
        clientSyncId: crypto.randomUUID(),
        learnerId: userId,
        artifactType,
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        storageR2Keys: [],
        externalUrls: externalUrl.trim() ? [externalUrl.trim()] : [],
        payload: { schema_version: '1.0', skill_codes: selectedSkills },
        complexityWeight: 1.0,
        capturedOfflineAt: new Date().toISOString(),
      });
      const syncResult = await syncEngine.syncAll();
      setTitle('');
      setDescription('');
      setExternalUrl('');
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
        setError(`Could not sync right now (${res.lastError ?? 'connection issue'}). Your work remains safely saved on this device.`);
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
                ? `${summary.educationStage} · Exploring ${summary.declaredInterests.join(', ') || 'new interests'}`
                : 'Sign in or complete onboarding to set up your learner space and start capturing your projects.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {!userId && (
              <Link href="/student/onboarding" className="inline-flex">
                <span className="inline-flex h-12 items-center justify-center rounded-xl bg-spark-600 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-spark-800">
                  Create your learner space <ArrowRight size={17} className="ml-2" aria-hidden="true" />
                </span>
              </Link>
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

        {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">{notice}</p>}

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
                    ? 'Guardian Verified'
                    : summary?.consentStatus === 'PENDING_PARENTAL_CONSENT'
                      ? 'Awaiting Guardian'
                      : 'Setup Needed'}
                </Badge>
              </div>
              <CardTitle className="mt-3 text-base">Family permission</CardTitle>
              <CardDescription>Your guardian’s consent keeps your learning space safe and private.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5">
                <span className="text-slate-600">Confirmed projects</span>
                <span className="font-bold text-slate-900">{summary?.totalArtifacts ?? artifacts.length}</span>
              </div>
              {summary && summary.consentStatus !== 'VERIFIED_ACTIVE' && (
                <Button size="sm" variant="outline" className="w-full" disabled={busy} onClick={() => void resendConsent()}>
                  Resend Guardian Consent SMS
                </Button>
              )}
            </CardContent>
          </Card>

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
                      <span className="truncate pr-2 font-medium text-slate-800">{formatSkillCode(s.code, catalogue)}</span>
                      <Badge variant={s.progression.toLowerCase() as 'beginner' | 'developing' | 'competent' | 'advanced'}>
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
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give your project or activity a name" />
              </label>
              <label className="block space-y-1.5 text-sm font-semibold text-slate-800">
                Type of work
                <select
                  aria-label="Artifact type"
                  value={artifactType}
                  onChange={(e) => setArtifactType(e.target.value as ArtifactType)}
                  className="w-full"
                >
                  {ARTIFACT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
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
                <Input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} type="url" placeholder="Paste a link to a project, design, or video" />
              </label>

              <div>
                <p className="mb-2 text-xs font-semibold text-slate-700">
                  What skills did you use? <span className="text-slate-400">({selectedSkills.length} selected)</span>
                </p>
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
                  {local.lastError && (
                    <p className="text-xs text-amber-900">Last sync note: {local.lastError}</p>
                  )}
                </div>
              ))}

              {artifacts.length === 0 && queuedLocal.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                  No projects in your collection yet. Add your first project on the left to begin!
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
