'use client';
import { useEffect, useState } from 'react';
import { Check, ShieldCheck, Sparkles } from '@sparktrack/ui';
import { ConsentVerificationSchema } from '@sparktrack/contracts';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@sparktrack/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export default function ParentConsentPage() {
  const [challengeId, setChallengeId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null);
  const [allowPublicPortfolio, setAllowPublicPortfolio] = useState(false);
  const [allowPartnerTalentDiscovery, setAllowPartnerTalentDiscovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  useEffect(() => {
    setChallengeId(new URLSearchParams(window.location.search).get('challengeId') ?? '');
  }, []);

  async function submit(decision: boolean) {
    const parsed = ConsentVerificationSchema.safeParse({
      challengeId, otpCode, consentGiven: decision,
      grants: { allowPublicPortfolio: decision && allowPublicPortfolio, allowPartnerTalentDiscovery: decision && allowPartnerTalentDiscovery },
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the code and try again.');
      return;
    }

    setBusy(true);
    setError('');
    setResult('');
    setConsentGiven(decision);
    try {
      const response = await fetch(`${API_URL}/v1/auth/consent/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
        const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
        throw new Error(message ?? `Request failed (${response.status})`);
      }
      const data = await response.json() as { status: string };
      setResult(data.status === 'VERIFIED_ACTIVE'
        ? 'Consent is verified. You may close this page.'
        : 'Your response has been recorded. The learner profile will remain restricted.');
    } catch (e) {
      setConsentGiven(null);
      setError(e instanceof Error ? e.message : 'Could not verify this consent request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <section className="spark-enter max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-emerald-900 shadow-sm">
            <ShieldCheck size={14} aria-hidden="true" /> Family &amp; privacy
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-[-0.04em] text-slate-900 sm:text-5xl">
            A safe start for their next big idea.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
            Your permission helps SparkTrack record learning evidence and provide developmental insights. It never assigns a career or future identity.
          </p>
          <div className="mt-8 rounded-3xl bg-[#101d3a] p-6 text-white shadow-xl">
            <Sparkles size={21} className="text-cyan-300" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-bold">You’re in control</h2>
            <p className="mt-2 text-sm leading-6 text-blue-100/85">
              Public portfolio visibility and partner discovery are separate choices. Both are optional, and you can decline consent.
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-cyan-200">
              <Check size={15} aria-hidden="true" /> Private by default
            </div>
          </div>
        </section>
        <Card className="spark-enter w-full overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-cyan-500 to-spark-600" />
        <CardHeader>
          <CardTitle>Review consent request</CardTitle>
          <CardDescription>Enter the six-digit code from the SparkTrack text message, then choose your preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {result ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">{result}</p> : <>
            {!challengeId && <p role="alert" className="text-sm text-red-700">This link is missing its request ID. Open the full link from the consent SMS.</p>}
            <Input className="h-14 text-center font-mono text-xl tracking-[0.5em]" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric" autoComplete="one-time-code" aria-label="Six-digit SMS code" placeholder="Six-digit SMS code" />
            <p className="text-sm text-slate-600">
              Consent allows SparkTrack to record learning evidence and produce developmental insights. It does not assign a career.
              Public portfolio and partner discovery are separate optional permissions.
            </p>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-sm leading-5 text-slate-700 transition-colors hover:bg-slate-50">
              <input className="mt-0.5 h-4 w-4 accent-blue-700" type="checkbox" checked={allowPublicPortfolio} onChange={(e) => setAllowPublicPortfolio(e.target.checked)} />
              Allow the learner’s portfolio to be publicly visible.
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-sm leading-5 text-slate-700 transition-colors hover:bg-slate-50">
              <input className="mt-0.5 h-4 w-4 accent-blue-700" type="checkbox" checked={allowPartnerTalentDiscovery} onChange={(e) => setAllowPartnerTalentDiscovery(e.target.checked)} />
              Allow approved partners to discover the learner’s profile.
            </label>
            {consentGiven !== null && <p className="text-xs text-slate-600">Submitting your response…</p>}
            <div className="flex gap-3">
              <Button variant="outline" disabled={busy || !challengeId || otpCode.length !== 6} onClick={() => void submit(false)}>
                Decline
              </Button>
              <Button className="flex-1" disabled={busy || !challengeId || otpCode.length !== 6} onClick={() => void submit(true)}>
                {busy ? 'Submitting…' : 'Give consent'}
              </Button>
            </div>
          </>}
        </CardContent>
      </Card>
      </div>
    </main>
  );
}
