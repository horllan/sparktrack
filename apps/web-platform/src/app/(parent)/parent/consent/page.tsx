'use client';
import { useEffect, useState } from 'react';
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
    <main className="flex min-h-screen items-center justify-center bg-spark-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Parent or Guardian Consent</CardTitle>
          <CardDescription>Confirm the SMS code and choose whether to allow SparkTrack to support the learner.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {result ? <p role="status" className="rounded bg-green-50 p-3 text-sm text-green-800">{result}</p> : <>
            {!challengeId && <p role="alert" className="text-sm text-red-700">This link is missing its request ID. Open the full link from the consent SMS.</p>}
            <Input value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric" autoComplete="one-time-code" aria-label="Six-digit SMS code" placeholder="Six-digit SMS code" />
            <p className="text-sm text-slate-600">
              Consent allows SparkTrack to record learning evidence and produce developmental insights. It does not assign a career.
              Public portfolio and partner discovery are separate optional permissions.
            </p>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={allowPublicPortfolio} onChange={(e) => setAllowPublicPortfolio(e.target.checked)} />
              Allow the learner's portfolio to be publicly visible.
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={allowPartnerTalentDiscovery} onChange={(e) => setAllowPartnerTalentDiscovery(e.target.checked)} />
              Allow approved partners to discover the learner's profile.
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
    </main>
  );
}
