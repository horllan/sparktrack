'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SyncEngine, type SyncStatus } from '@sparktrack/offline-sync';
import type { ArtifactType } from '@sparktrack/contracts';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@sparktrack/ui';
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
  { value: 'GIT_REPOSITORY', label: 'Git Repository' },
  { value: 'DESIGN_PORTFOLIO', label: 'Design Portfolio' },
  { value: 'BUSINESS_PROTOTYPE', label: 'Business Prototype' },
  { value: 'LEARNER_REFLECTION', label: 'Learner Reflection' },
];

export default function StudentDashboardPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [summary, setSummary] = useState<LearnerSummary | null>(null);
  const [catalogue, setCatalogue] = useState<SkillNode[]>([]);
  const [artifacts, setArtifacts] = useState<SealedArtifact[]>([]);
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
    setSyncStatus(await syncEngine.getStatus());
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
  }, [refreshDashboard]);

  const toggleSkill = (code: string) =>
    setSelectedSkills((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  async function submitEvidence() {
    if (!userId || !title.trim() || selectedSkills.length === 0) {
      setError('Enter a project title and select at least one skill signal.');
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
      await syncEngine.syncAll();
      setTitle('');
      setDescription('');
      setExternalUrl('');
      setSelectedSkills([]);
      await refreshDashboard();
      setNotice('Evidence saved to local IndexedDB queue and synced to the cryptographic ledger.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to queue or sync evidence.');
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
      setNotice('Parental consent SMS sent. Ask your parent or guardian to open the link in the message.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send consent SMS.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-spark-900">⚡ SparkTrack Learner Workspace</h1>
            <p className="text-sm text-slate-600">
              {summary
                ? `${summary.fullName} · ${summary.educationStage} · Declared Interests: ${summary.declaredInterests.join(', ') || 'None'}`
                : 'Sign in or complete onboarding to unlock your personalised workspace.'}
            </p>
          </div>
          {!userId && (
            <Link href="/student/onboarding">
              <Button>Complete Onboarding</Button>
            </Link>
          )}
        </div>

        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}

        {/* Top Status Row */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Offline-First Sync Queue</CardTitle>
              <CardDescription>Dexie.js IndexedDB + Idempotent Sync</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Connectivity</span>
                <Badge variant={syncStatus?.isOnline !== false ? 'competent' : 'secondary'}>
                  {syncStatus?.isOnline !== false ? 'Online' : 'Offline Mode'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Pending local items</span>
                <span className="font-semibold">{syncStatus?.totalPending ?? 0}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={busy}
                onClick={() => void syncEngine.syncAll().then(refreshDashboard)}
              >
                Sync Offline Queue Now
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Child Safety &amp; Consent</CardTitle>
              <CardDescription>NDPA Verifiable Parental Consent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Status</span>
                <Badge variant={summary?.consentStatus === 'VERIFIED_ACTIVE' ? 'competent' : 'developing'}>
                  {summary?.consentStatus ?? 'UNPROVISIONED'}
                </Badge>
              </div>
              {summary && summary.consentStatus !== 'VERIFIED_ACTIVE' && (
                <Button size="sm" variant="outline" className="w-full" disabled={busy} onClick={() => void resendConsent()}>
                  Resend Guardian Consent SMS
                </Button>
              )}
              <p className="text-xs text-slate-500">
                Verified artifacts: <span className="font-medium text-slate-700">{summary?.totalArtifacts ?? 0}</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Emerging Skill Signals</CardTitle>
              <CardDescription>Time-Decayed Evidence Scores</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {skillScores.length === 0 ? (
                <p className="text-slate-500">Submit project evidence below to compute your initial skill signals.</p>
              ) : (
                skillScores.slice(0, 5).map((s) => (
                  <div key={s.code} className="flex items-center justify-between">
                    <span className="truncate pr-2">{s.code.replace(/^SKILL_|^SIG_/, '').replace(/_/g, ' ')}</span>
                    <Badge variant={s.progression.toLowerCase() as 'beginner' | 'developing' | 'competent' | 'advanced'}>
                      {s.progression} ({Math.round(s.score * 100)}%)
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pathway Exploration Map */}
        {pathways.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Career &amp; Entrepreneurship Pathway Exploration</CardTitle>
              <CardDescription>
                Non-deterministic exploration map comparing your declared interests against observed project evidence.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {pathways.map((p) => (
                <div key={p.pathwayCode} className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-800">{p.pathwayName}</span>
                    <Badge variant="secondary">{Math.round(p.affinityScore * 100)}% match</Badge>
                  </div>
                  {p.isDivergentFromDeclared && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                      Discovery signal: Strong observed evidence outside your initially declared interests — worth exploring!
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Offline-First Evidence Uploader & Cryptographic Portfolio */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Submit Project &amp; Learning Evidence (Offline-Capable)</CardTitle>
              <CardDescription>
                Saved locally to IndexedDB first with a UUID, then sealed into the SHA-256 cryptographic ledger.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project or activity title (e.g. Python Network Packet Analyzer)" />
              <select
                aria-label="Artifact type"
                value={artifactType}
                onChange={(e) => setArtifactType(e.target.value as ArtifactType)}
                className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {ARTIFACT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What did you build, test, or learn?" />
              <Input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} type="url" placeholder="External link (GitHub, Figma, video URL — optional)" />

              <div>
                <p className="mb-2 text-xs font-medium text-slate-600">Select demonstrated skills from the Capability Graph:</p>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {catalogue.map((skill) => (
                    <button
                      key={skill.code}
                      type="button"
                      onClick={() => toggleSkill(skill.code)}
                      aria-pressed={selectedSkills.includes(skill.code)}
                      className={`rounded border p-2 text-left text-xs transition-colors ${
                        selectedSkills.includes(skill.code)
                          ? 'border-spark-500 bg-spark-100 font-medium'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {skill.name}
                    </button>
                  ))}
                </div>
              </div>

              <Button className="w-full" disabled={busy || !userId} onClick={() => void submitEvidence()}>
                {busy ? 'Queueing & Sealing…' : 'Save & Seal Evidence Artifact'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cryptographically Sealed Evidence Portfolio</CardTitle>
              <CardDescription>Append-only SHA-256 hash-chained ledger entries</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {artifacts.length === 0 ? (
                <p className="text-sm text-slate-500">No sealed evidence artifacts yet.</p>
              ) : (
                artifacts.map((art) => (
                  <div key={art.id} className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800">{art.title}</span>
                      <Badge variant={art.mentorVerified ? 'competent' : 'secondary'}>
                        {art.mentorVerified ? 'Mentor Verified' : art.artifactType}
                      </Badge>
                    </div>
                    {art.description && <p className="text-xs text-slate-600">{art.description}</p>}
                    <div className="flex flex-wrap gap-1">
                      {art.skillCodes.map((code) => (
                        <span key={code} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">{code}</span>
                      ))}
                    </div>
                    {art.rowSignatureHash && (
                      <p className="font-mono text-[11px] text-slate-400 truncate">
                        Ledger #{art.ledgerSeq} · SHA-256: {art.rowSignatureHash}
                      </p>
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
