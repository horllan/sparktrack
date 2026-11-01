'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
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
      challengeId: challengeId.trim(),
      otpCode,
      consentGiven: decision,
      grants: {
        allowPublicPortfolio: decision && allowPublicPortfolio,
        allowPartnerTalentDiscovery: decision && allowPartnerTalentDiscovery,
      },
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
        const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
        const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
        throw new Error(message ?? `Request failed (${response.status})`);
      }
      const data = (await response.json()) as { status: string };
      setResult(
        data.status === 'VERIFIED_ACTIVE'
          ? 'Consent is verified. You may now return to the Parent & Family Hub.'
          : 'Your response has been recorded. The learner profile will remain restricted.',
      );
    } catch (e) {
      setConsentGiven(null);
      setError(e instanceof Error ? e.message : 'Could not verify this consent request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <section className="spark-enter max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-emerald-900 shadow-sm">
            <ShieldCheck size={14} aria-hidden="true" /> Family &amp; privacy
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-[-0.04em] text-slate-900 sm:mt-6 sm:text-5xl">
            A safe start for their next big idea.
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600 sm:mt-4 sm:text-base sm:leading-7">
            Your permission helps SparkTrack record learning evidence and provide developmental insights. It never
            assigns a career or future identity.
          </p>
          <div className="mt-6 rounded-3xl bg-[#101d3a] p-5 text-white shadow-xl sm:mt-8 sm:p-6">
            <Sparkles size={21} className="text-cyan-300" aria-hidden="true" />
            <h2 className="mt-3 text-base font-bold sm:mt-4 sm:text-lg">You’re in control</h2>
            <p className="mt-2 text-xs leading-6 text-blue-100/85 sm:text-sm">
              Public portfolio visibility and partner discovery are separate choices. Both are optional, and you can
              also register a child directly from your{' '}
              <Link href="/parent/dashboard" className="underline text-cyan-300">
                Parent Hub
              </Link>
              .
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-cyan-200">
              <Check size={15} aria-hidden="true" /> Private by default
            </div>
          </div>
        </section>

        <Card className="spark-enter w-full overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-cyan-500 to-spark-600" />
          <CardHeader>
            <CardTitle>Review SMS consent request</CardTitle>
            <CardDescription>
              Enter the six-digit code from the SparkTrack text message, then choose your privacy preferences.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </p>
            )}
            {result ? (
              <div className="space-y-3">
                <p
                  role="status"
                  className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900"
                >
                  {result}
                </p>
                <Link href="/parent/dashboard" className="block">
                  <Button className="w-full">Go to Parent &amp; Family Hub</Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Request ID (filled automatically from your SMS link)
                  </label>
                  <Input
                    value={challengeId}
                    onChange={(e) => setChallengeId(e.target.value)}
                    placeholder="Enter the Request ID from your text message"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">6-Digit SMS Verification Code</label>
                  <Input
                    className="h-14 text-center font-mono text-xl tracking-[0.4em]"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    aria-label="Six-digit SMS code"
                    placeholder="000000"
                  />
                </div>
                <p className="text-xs leading-5 text-slate-600 sm:text-sm">
                  Consent allows SparkTrack to record learning evidence and produce developmental insights. Public
                  portfolio and partner discovery are separate optional permissions.
                </p>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-sm leading-5 text-slate-700 transition-colors hover:bg-slate-50">
                  <input
                    className="mt-0.5 h-4 w-4 accent-blue-700"
                    type="checkbox"
                    checked={allowPublicPortfolio}
                    onChange={(e) => setAllowPublicPortfolio(e.target.checked)}
                  />
                  <span>Allow the learner’s portfolio to be publicly visible.</span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-sm leading-5 text-slate-700 transition-colors hover:bg-slate-50">
                  <input
                    className="mt-0.5 h-4 w-4 accent-blue-700"
                    type="checkbox"
                    checked={allowPartnerTalentDiscovery}
                    onChange={(e) => setAllowPartnerTalentDiscovery(e.target.checked)}
                  />
                  <span>Allow approved partners to discover the learner’s profile.</span>
                </label>
                {consentGiven !== null && <p className="text-xs text-slate-600">Submitting your response…</p>}
                <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={busy || !challengeId.trim() || otpCode.length !== 6}
                    onClick={() => void submit(false)}
                  >
                    Decline
                  </Button>
                  <Button
                    className="w-full flex-1"
                    disabled={busy || !challengeId.trim() || otpCode.length !== 6}
                    onClick={() => void submit(true)}
                  >
                    {busy ? 'Submitting…' : 'Give Consent'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
