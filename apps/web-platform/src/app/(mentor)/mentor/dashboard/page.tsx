'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SyncEngine } from '@sparktrack/offline-sync';
import type { BehaviouralSignal } from '@sparktrack/contracts';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Check,
  FolderKanban,
  Input,
  PlayCircle,
  Sparkles,
  UsersRound,
} from '@sparktrack/ui';
import { createClient } from '../../../../lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const API_BASE = API_URL.replace(/\/api\/?$/, '');

const SIGNALS: Array<{ key: BehaviouralSignal; label: string; hint: string }> = [
  { key: 'analytical_thinking', label: 'Analytical Thinking', hint: 'Breaks down problems step by step' },
  { key: 'persistence', label: 'Persistence & Grit', hint: 'Keeps iterating when something fails' },
  { key: 'problem_solving', label: 'Problem Solving', hint: 'Finds practical ways around obstacles' },
  { key: 'creativity', label: 'Creativity', hint: 'Tries original ideas or designs' },
  { key: 'collaboration', label: 'Collaboration', hint: 'Supports peers and shares tasks well' },
  { key: 'communication', label: 'Communication', hint: 'Explains their work clearly' },
  { key: 'initiative', label: 'Initiative', hint: 'Takes ownership without waiting to be asked' },
];

const INTENSITY_LABELS: Record<number, string> = {
  1: '1 · Emerging',
  2: '2 · Growing',
  3: '3 · Strong',
  4: '4 · Standout',
};

interface QueueItem {
  artifactId: string;
  learnerId: string;
  learnerName: string;
  educationStage: string;
  artifactType: string;
  title: string;
  description: string | null;
  skillCodes: string[];
  complexityWeight: number;
  capturedOfflineAt: string;
  ledgerSeq: number | null;
  rowSignatureHash: string | null;
}

export default function MentorDashboardPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [learnerId, setLearnerId] = useState('');
  const [cohortId, setCohortId] = useState('');
  const [artifactId, setArtifactId] = useState('');
  const [qualityScore, setQualityScore] = useState('0.90');
  const [overallComment, setOverallComment] = useState('');
  const [selectedSignals, setSelectedSignals] = useState<Record<string, number>>({
    analytical_thinking: 4,
    persistence: 3,
  });
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

  const loadQueue = useCallback(async () => {
    try {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_URL}/v1/mentorship/queue`, { headers });
      if (res.ok) setQueue((await res.json()) as QueueItem[]);
    } catch {
      // Offline-safe
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  function toggleSignal(sig: BehaviouralSignal) {
    setSelectedSignals((prev) => {
      const next = { ...prev };
      if (sig in next) delete next[sig];
      else next[sig] = 3;
      return next;
    });
  }

  function setIntensity(sig: BehaviouralSignal, intensity: number) {
    setSelectedSignals((prev) => ({ ...prev, [sig]: intensity }));
  }

  async function submitRubric() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await createClient().auth.getSession();
      const mentorId = data.session?.user?.id;
      const token = data.session?.access_token;
      if (!mentorId) throw new Error('Sign in with a Mentor account to submit a micro-rubric.');

      const observedSignals = Object.entries(selectedSignals).map(([signal, intensity]) => ({
        signal: signal as BehaviouralSignal,
        intensity,
      }));
      if (observedSignals.length === 0) throw new Error('Select at least one behavioural signal.');

      if (artifactId.trim() && token) {
        await fetch(`${API_URL}/v1/mentorship/artifacts/${artifactId.trim()}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ qualityScore: Number(qualityScore) }),
        }).catch(() => null);
      }

      await syncEngine.queueRubric({
        clientSyncId: crypto.randomUUID(),
        mentorId,
        learnerId: learnerId.trim(),
        cohortId: cohortId.trim(),
        ...(artifactId.trim() ? { artifactId: artifactId.trim() } : {}),
        qualityScore: Number(qualityScore),
        observedSignals,
        ...(overallComment.trim() ? { overallComment: overallComment.trim() } : {}),
        capturedOfflineAt: new Date().toISOString(),
      });
      const syncResult = await syncEngine.syncAll();
      await loadQueue();

      if (syncResult.syncedCount > 0 && syncResult.failedCount === 0) {
        setNotice('Confirmed! Your 3-minute observation was synced and sealed on the server.');
      } else {
        setNotice(
          'Saved on this device in the offline outbox. It will sync when your connection and mentor session are active.',
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit micro-rubric.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="spark-enter flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-spark-700">Mentor workspace</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Help young people see their progress.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Review learner work in under 3 minutes, share encouraging feedback, and notice strengths as they develop.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link href="/demo?role=mentor">
              <Button variant="outline">
                <PlayCircle size={16} className="mr-1.5" />
                Interactive Mentor Demo
              </Button>
            </Link>
            <Button variant="outline" onClick={() => void loadQueue()}>
              Refresh Review Queue ({queue.length})
            </Button>
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

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="h-fit">
            <CardHeader>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <FolderKanban size={19} aria-hidden="true" />
                </span>
                <div>
                  <CardTitle className="text-base">Work waiting for your review</CardTitle>
                  <CardDescription>Select a learner submission to pre-fill the observation form.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {queue.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  <p>
                    No unverified submissions in your queue right now (sign in with a Mentor account to load cohort
                    submissions, or launch the{' '}
                    <Link href="/demo?role=mentor" className="font-bold text-spark-700 underline">
                      Interactive Mentor Sandbox
                    </Link>
                    ).
                  </p>
                </div>
              ) : (
                queue.map((item) => {
                  const selected = artifactId === item.artifactId;
                  return (
                    <div
                      key={item.artifactId}
                      className={`rounded-2xl border p-4 text-sm transition-all ${
                        selected
                          ? 'border-spark-500 bg-spark-50/60 ring-2 ring-spark-100'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-900">{item.title}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {item.learnerName} · {item.educationStage}
                          </p>
                        </div>
                        <Badge variant="developing">{item.artifactType.replace(/_/g, ' ')}</Badge>
                      </div>
                      {item.description && <p className="mt-2 text-xs text-slate-600">{item.description}</p>}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1">
                          {item.skillCodes.map((code) => (
                            <Badge key={code} variant="secondary">
                              {code.replace(/^SKILL_|^SIG_/, '').replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          variant={selected ? 'default' : 'outline'}
                          onClick={() => {
                            setLearnerId(item.learnerId);
                            setArtifactId(item.artifactId);
                          }}
                        >
                          {selected ? 'Selected' : 'Review project'}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-spark-50 text-spark-700">
                  <UsersRound size={19} aria-hidden="true" />
                </span>
                <div>
                  <CardTitle className="text-base">Share your 3-minute observation</CardTitle>
                  <CardDescription>
                    Focus on what you observed in this activity. These are growing signals, never permanent labels.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block space-y-1 text-xs font-semibold text-slate-700">
                  Learner ID
                  <Input value={learnerId} onChange={(e) => setLearnerId(e.target.value)} placeholder="Enter Learner ID" />
                </label>
                <label className="block space-y-1 text-xs font-semibold text-slate-700">
                  Cohort ID
                  <Input value={cohortId} onChange={(e) => setCohortId(e.target.value)} placeholder="Enter Cohort ID" />
                </label>
                <label className="block space-y-1 text-xs font-semibold text-slate-700">
                  Project ID <span className="font-normal text-slate-400">(optional)</span>
                  <Input value={artifactId} onChange={(e) => setArtifactId(e.target.value)} placeholder="Enter Project ID" />
                </label>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-sm font-bold text-slate-900">
                    Project Quality &amp; Effort:{' '}
                    <span className="text-spark-700">{Math.round(Number(qualityScore) * 100)}%</span>
                  </label>
                  <div className="flex gap-1.5">
                    {['0.70', '0.80', '0.90', '0.95'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setQualityScore(preset)}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                          qualityScore === preset
                            ? 'border-spark-500 bg-spark-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {Math.round(Number(preset) * 100)}%
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="range"
                  min="0.40"
                  max="1.00"
                  step="0.01"
                  aria-label="Project quality and effort score"
                  value={qualityScore}
                  onChange={(e) => setQualityScore(e.target.value)}
                  className="w-full accent-spark-600"
                />
              </div>

              <div>
                <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                  Which strengths stood out? ({Object.keys(selectedSignals).length} selected)
                </p>
                <div className="space-y-2.5">
                  {SIGNALS.map((sig) => {
                    const active = sig.key in selectedSignals;
                    const currentIntensity = selectedSignals[sig.key] ?? 3;
                    return (
                      <div
                        key={sig.key}
                        className={`rounded-2xl border p-3.5 transition-all ${
                          active ? 'border-spark-400 bg-spark-50/50 shadow-2xs' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => toggleSignal(sig.key)}
                            aria-pressed={active}
                            className="flex flex-1 items-center gap-2.5 text-left"
                          >
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                active
                                  ? 'border-spark-600 bg-spark-600 text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {active && <Check size={13} aria-hidden="true" />}
                            </span>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{sig.label}</p>
                              <p className="text-xs text-slate-500">{sig.hint}</p>
                            </div>
                          </button>
                        </div>

                        {active && (
                          <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                            {[1, 2, 3, 4].map((lvl) => (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => setIntensity(sig.key, lvl)}
                                className={`rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                                  currentIntensity === lvl
                                    ? 'border-spark-600 bg-spark-600 text-white shadow-2xs'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {INTENSITY_LABELS[lvl]}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <label className="block space-y-1.5 text-sm font-semibold text-slate-800">
                Encouraging note for the learner <span className="font-normal text-slate-500">(optional)</span>
                <textarea
                  value={overallComment}
                  onChange={(e) => setOverallComment(e.target.value)}
                  rows={3}
                  placeholder="Share one specific thing they handled well and one idea they could try next…"
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-normal text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:border-spark-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-spark-100"
                />
              </label>

              <Button
                size="lg"
                className="w-full"
                disabled={busy || !learnerId.trim() || !cohortId.trim()}
                onClick={() => void submitRubric()}
              >
                <Sparkles size={17} className="mr-2" aria-hidden="true" />
                {busy ? 'Saving observation…' : 'Submit 3-minute observation'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
