'use client';
import { useState } from 'react';
import { LearnerOnboardingSchema } from '@sparktrack/contracts';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@sparktrack/ui';
import { createClient } from '../../../../lib/supabase/client';

const INTERESTS = ['Coding & Programming', 'Graphic Design', 'Cybersecurity', 'Robotics', 'Business & Entrepreneurship',
  'AI & Data Science', 'Video Production', 'Web Development'];

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

async function responseError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
  return Array.isArray(body?.message) ? body.message.join(', ') : body?.message ?? `Request failed (${response.status})`;
}

export default function StudentOnboardingPage() {
  const [step, setStep] = useState(1);
  const [interests, setInterests] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [educationStage, setEducationStage] = useState('');
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');
  const [guardianName, setGuardianName] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const toggle = (interest: string) => setInterests((current) =>
    current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest]);

  async function authenticate(createAccount: boolean) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const supabase = createClient();
      const result = createAccount
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.href } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (!result.data.session) {
        setNeedsEmailConfirmation(true);
        setAuthMode('signin');
        setNotice('Check your email to confirm your account, then return here and continue.');
        return;
      }
      setNeedsEmailConfirmation(false);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not authenticate your account.');
    } finally {
      setBusy(false);
    }
  }

  async function submitOnboarding() {
    const parsed = LearnerOnboardingSchema.safeParse({
      fullName, dateOfBirth, educationStage, declaredInterests: interests,
      guardian: {
        fullName: guardianName,
        ...(guardianEmail ? { email: guardianEmail } : {}),
        phoneNumber: guardianPhone,
        relationship: 'PARENT',
      },
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the onboarding details.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session has expired. Sign in again to continue.');

      const onboard = await fetch(`${API_URL}/v1/auth/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(parsed.data),
      });
      if (!onboard.ok) throw new Error(await responseError(onboard));

      const consent = await fetch(`${API_URL}/v1/auth/consent/request`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!consent.ok) throw new Error(await responseError(consent));
      const consentResult = await consent.json() as { status: string };
      setStep(4);
      setNotice(consentResult.status === 'VERIFIED_ACTIVE'
        ? 'Your parent or guardian has already verified consent. You can now continue to SparkTrack.'
        : 'A consent request has been sent to your parent or guardian by SMS. They can open the link in that message to respond.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete onboarding.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-spark-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Welcome to SparkTrack</CardTitle>
          <CardDescription>{step < 4 ? `Step ${step} of 3` : 'Onboarding submitted'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {notice && <p role="status" className="rounded bg-blue-50 p-3 text-sm text-blue-800">{notice}</p>}
          {step === 1 && (<>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="Your email" />
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
              autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
              placeholder={authMode === 'signup' ? 'Password (at least 8 characters)' : 'Password'} />
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
            <Input value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} type="date" aria-label="Date of birth" />
            <Input value={educationStage} onChange={(e) => setEducationStage(e.target.value)} placeholder="Education stage (e.g. JSS3)" />
            {needsEmailConfirmation ? (
              <Button className="w-full" disabled={busy} onClick={() => void authenticate(false)}>
                {busy ? 'Signing in…' : 'I have confirmed my email — continue'}
              </Button>
            ) : (
              <Button className="w-full" disabled={busy || !email || password.length < (authMode === 'signup' ? 8 : 1) ||
                (authMode === 'signup' && (!fullName || !dateOfBirth || !educationStage))}
                onClick={() => void authenticate(authMode === 'signup')}>
                {busy ? 'Please wait…' : authMode === 'signup' ? 'Create account and continue' : 'Sign in and continue'}
              </Button>
            )}
            {!needsEmailConfirmation && (
              <button type="button" className="w-full text-sm text-spark-800 underline"
                onClick={() => { setAuthMode(authMode === 'signup' ? 'signin' : 'signup'); setError(''); setNotice(''); }}>
                {authMode === 'signup' ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
              </button>
            )}
          </>)}
          {step === 2 && (<>
            <p className="text-sm text-slate-600">What would you like to explore? You can change this any time.</p>
            <div className="grid grid-cols-2 gap-2">
              {INTERESTS.map((interest) => (
                <button key={interest} type="button" onClick={() => toggle(interest)} aria-pressed={interests.includes(interest)}
                  className={`rounded-lg border p-3 text-left text-sm ${interests.includes(interest) ? 'border-spark-500 bg-spark-100' : 'border-slate-200'}`}>
                  {interest}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1" disabled={interests.length === 0} onClick={() => setStep(3)}>Continue</Button>
            </div>
          </>)}
          {step === 3 && (<>
            <p className="text-sm text-slate-600">A parent or guardian must review the consent request before learner evidence can be recorded.</p>
            <Input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="Guardian's full name" />
            <Input value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} type="email" placeholder="Guardian's email (optional)" />
            <Input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} type="tel" placeholder="Guardian's phone (+234…)" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button className="flex-1" disabled={busy || !guardianName || !guardianPhone} onClick={() => void submitOnboarding()}>
                {busy ? 'Submitting…' : 'Send consent request'}
              </Button>
            </div>
          </>)}
          {step === 4 && (
            <p className="text-sm text-slate-700">Your profile is saved. It remains pending until your parent or guardian responds to the SMS request.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
