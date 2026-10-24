'use client';

import { useMemo, useState } from 'react';
import { SyncEngine } from '@sparktrack/offline-sync';
import type { BehaviouralSignal } from '@sparktrack/contracts';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@sparktrack/ui';
import { createClient } from '../../../../lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const API_BASE = API_URL.replace(/\/api\/?$/, '');

const SIGNALS: Array<{ key: BehaviouralSignal; label: string }> = [
  { key: 'analytical_thinking', label: 'Analytical Thinking' },
  { key: 'persistence', label: 'Persistence & Grit' },
  { key: 'problem_solving', label: 'Problem Solving' },
  { key: 'creativity', label: 'Creativity' },
  { key: 'collaboration', label: 'Collaboration' },
  { key: 'communication', label: 'Communication' },
  { key: 'initiative', label: 'Initiative' },
];

export default function MentorDashboardPage() {
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
      if (!mentorId) throw new Error('Sign in with a Mentor account to submit a micro-rubric.');

      const observedSignals = Object.entries(selectedSignals).map(([signal, intensity]) => ({
        signal: signal as BehaviouralSignal,
        intensity,
      }));
      if (observedSignals.length === 0) throw new Error('Select at least one behavioural signal.');

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
      await syncEngine.syncAll();
      setNotice('Micro-rubric queued in IndexedDB and synced to the cryptographic evidence ledger.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit micro-rubric.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mentor 3-Minute Mobile-Offline Micro-Rubric</h1>
          <p className="text-sm text-slate-600">
            Verify learner artifacts and record evolving developmental signals (offline-first via IndexedDB).
          </p>
        </div>

        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evaluate Learner Evidence &amp; Behavioural Signals</CardTitle>
            <CardDescription>
              Signals are treated strictly as evolving developmental observations, never permanent labels.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Input value={learnerId} onChange={(e) => setLearnerId(e.target.value)} placeholder="Learner UUID" />
              <Input value={cohortId} onChange={(e) => setCohortId(e.target.value)} placeholder="Cohort UUID" />
              <Input value={artifactId} onChange={(e) => setArtifactId(e.target.value)} placeholder="Artifact UUID (optional)" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Verified Quality Score (0.00 – 1.00): <span className="font-bold">{qualityScore}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={qualityScore}
                onChange={(e) => setQualityScore(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-700">Observed Behavioural Signals (Intensity 1–4):</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SIGNALS.map((sig) => {
                  const active = sig.key in selectedSignals;
                  const intensity = selectedSignals[sig.key] ?? 3;
                  return (
                    <div key={sig.key} className={`flex items-center justify-between rounded-lg border p-2.5 text-sm ${active ? 'border-spark-500 bg-spark-50' : 'border-slate-200 bg-white'}`}>
                      <button type="button" onClick={() => toggleSignal(sig.key)} className="text-left font-medium">
                        {sig.label}
                      </button>
                      {active ? (
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map((lvl) => (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => setIntensity(sig.key, lvl)}
                              className={`h-6 w-6 rounded text-xs font-semibold ${intensity === lvl ? 'bg-spark-500 text-white' : 'bg-white border border-slate-200'}`}
                            >
                              {lvl}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <Badge variant="outline">Off</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Input
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
              placeholder="Concise mentor observation note (max 500 chars)"
            />

            <Button className="w-full" disabled={busy || !learnerId || !cohortId} onClick={() => void submitRubric()}>
              {busy ? 'Queueing & Syncing Rubric…' : 'Seal 3-Minute Micro-Rubric'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
