'use client';
import { useState } from 'react';
import { Check, Compass, ShieldCheck, Sparkles } from '@sparktrack/ui';
import { LearnerOnboardingSchema } from '@sparktrack/contracts';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@sparktrack/ui';
import { createClient } from '../../../../lib/supabase/client';

const INTERESTS = ['Coding & Programming', 'Graphic Design', 'Cybersecurity', 'Robotics', 'Business & Entrepreneurship',
  'AI & Data Science', 'Video Production', 'Web Development'];
const LEARNER_STAGES = [
  ['SECONDARY_SCHOOL', 'Secondary school (JSS1 or above)'], ['UNIVERSITY', 'University or college'],
  ['NYSC', 'NYSC'], ['EMPLOYED', 'Working / employed'], ['CAREER_TRANSITION', 'Changing career'],
  ['CAREER_GROWTH', 'Growing in my current career'], ['SELF_TAUGHT', 'Learning independently'],
  ['NO_FORMAL_EDUCATION', 'Not in formal education'], ['OTHER', 'Another stage'],
];
const LEARNING_GOALS = [
  ['EXPLORE_INTERESTS', 'Discover what I enjoy and do well'], ['BUILD_PRACTICAL_SKILLS', 'Build practical skills'],
  ['GET_FIRST_JOB', 'Prepare for my first job'], ['CHANGE_CAREER', 'Move into a different career'],
  ['GROW_IN_CAREER', 'Improve or advance in my career'], ['START_BUSINESS', 'Start a business'],
  ['RETURN_TO_EDUCATION', 'Return to education or training'], ['PERSONAL_GROWTH', 'Learn for personal growth'],
  ['OTHER', 'Something else'],
];

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
  const [ageGroup, setAgeGroup] = useState<'UNDER_18' | 'ADULT'>('UNDER_18');
  const [learnerStage, setLearnerStage] = useState('SECONDARY_SCHOOL');
  const [educationLevel, setEducationLevel] = useState('');
  const [learningGoal, setLearningGoal] = useState('EXPLORE_INTERESTS');
  const [currentRole, setCurrentRole] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
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
      fullName, ageGroup, ...(ageGroup === 'UNDER_18' && dateOfBirth ? { dateOfBirth } : {}), learnerStage,
      ...(educationLevel ? { educationLevel } : {}), learningGoal,
      ...(currentRole ? { currentRole } : {}), ...(targetRole ? { targetRole } : {}),
      declaredInterests: interests, whatsappOptIn,
      ...(whatsappOptIn && ageGroup === 'ADULT' && whatsappPhone ? { whatsappPhoneNumber: whatsappPhone } : {}),
      ...(ageGroup === 'UNDER_18' ? { guardian: {
        fullName: guardianName,
        ...(guardianEmail ? { email: guardianEmail } : {}),
        phoneNumber: guardianPhone,
        relationship: 'PARENT',
      } } : {}),
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

      setStep(4);
      if (ageGroup === 'UNDER_18') {
        const consent = await fetch(`${API_URL}/v1/auth/consent/request`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!consent.ok) throw new Error(await responseError(consent));
        const consentResult = await consent.json() as { status: string };
        setNotice(consentResult.status === 'VERIFIED_ACTIVE'
          ? 'Your parent or guardian has already verified consent. You can now continue to SparkTrack.'
          : 'A consent request has been sent to your parent or guardian by SMS. They can open the link in that message to respond.');
      } else {
        setNotice('Your learner space is ready. Add a project, skill, or experience whenever you are ready to begin.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete onboarding.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <section className="spark-enter max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-spark-100 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-spark-800 shadow-sm">
            <Sparkles size={14} aria-hidden="true" /> Your first steps
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-[-0.04em] text-slate-900 sm:text-5xl">
            Start with what makes you curious.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
            Whether you are starting in JSS1, at university, doing NYSC, already working, changing careers, or learning without formal education, SparkTrack helps you build practical skills and proof of what you can do.
          </p>
          <div className="mt-8 space-y-3">
            {[
              { icon: Compass, title: 'Explore at your pace', text: 'Interests can change as you try new things.' },
              { icon: ShieldCheck, title: 'The right support for your age', text: 'Learners under 18 invite a guardian; adult learners manage their own space.' },
              { icon: Check, title: 'Build a record of growth', text: 'Keep track of projects and skills you practice.' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-spark-50 text-spark-700">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">{title}</p>
                  <p className="mt-1 text-sm leading-5 text-slate-600">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <Card className="spark-enter w-full overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-spark-600 via-cyan-500 to-coral-500" />
        <CardHeader>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.13em] text-spark-700">
              {step < 4 ? `Step ${step} of 3` : 'You’re all set'}
            </span>
            {step < 4 && <span className="text-xs font-medium text-slate-500">{Math.round((step / 3) * 100)}% complete</span>}
          </div>
          <div className="mb-4 flex gap-1.5" aria-hidden="true">
            {[1, 2, 3].map((part) => (
              <span key={part} className={`h-1.5 flex-1 rounded-full ${part <= step ? 'bg-spark-600' : 'bg-slate-100'}`} />
            ))}
          </div>
          <CardTitle>{step === 4 ? 'Welcome to your SparkTrack journey' : 'Create your learner space'}</CardTitle>
          <CardDescription>
            {step === 1 ? 'Tell us where you are now and what you want to do next.' : step === 2 ? 'Choose a few interests to get started.' : step === 3 ? ageGroup === 'UNDER_18' ? 'Add a parent or guardian for consent.' : 'Choose how you would like SparkTrack to keep in touch.' : 'Your learner space is ready.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {notice && <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{notice}</p>}
          {step === 1 && (<>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="Your email" />
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
              autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
              placeholder={authMode === 'signup' ? 'Password (at least 8 characters)' : 'Password'} />
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-slate-800">Which age group are you in?</legend>
              <div className="grid grid-cols-2 gap-2">
                {([['UNDER_18', 'Under 18'], ['ADULT', '18 or older']] as const).map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={ageGroup === value} onClick={() => setAgeGroup(value)}
                    className={`rounded-xl border p-3 text-sm font-semibold ${ageGroup === value ? 'border-spark-500 bg-spark-50 text-spark-900' : 'border-slate-200 text-slate-700'}`}>{label}</button>
                ))}
              </div>
            </fieldset>
            {ageGroup === 'UNDER_18' && <Input value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} type="date" aria-label="Date of birth" />}
            <label className="block space-y-1 text-sm font-semibold text-slate-800">Where are you in your journey?
              <select value={learnerStage} onChange={(e) => setLearnerStage(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal">
                {LEARNER_STAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            {learnerStage === 'SECONDARY_SCHOOL' && (
              <label className="block space-y-1 text-sm font-semibold text-slate-800">Current class
                <select value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal">
                  <option value="">Choose your class</option>
                  {['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'].map((level) => <option key={level} value={level}>{level}</option>)}
                </select>
              </label>
            )}
            {learnerStage === 'UNIVERSITY' && <Input value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)} placeholder="Course or year (optional)" />}
            <label className="block space-y-1 text-sm font-semibold text-slate-800">What would you like to achieve?
              <select value={learningGoal} onChange={(e) => setLearningGoal(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal">
                {LEARNING_GOALS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            {['EMPLOYED', 'CAREER_TRANSITION', 'CAREER_GROWTH', 'NYSC'].includes(learnerStage) && <>
              <Input value={currentRole} onChange={(e) => setCurrentRole(e.target.value)} placeholder="What do you do now? (optional)" />
              <Input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="What would you like to do next? (optional)" />
            </>}
            {needsEmailConfirmation ? (
              <Button className="w-full" disabled={busy} onClick={() => void authenticate(false)}>
                {busy ? 'Signing in…' : 'I have confirmed my email — continue'}
              </Button>
            ) : (
              <Button className="w-full" disabled={busy || !email || password.length < (authMode === 'signup' ? 8 : 1) ||
                (authMode === 'signup' && (!fullName || (ageGroup === 'UNDER_18' && !dateOfBirth)))}
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
                  className={`rounded-xl border p-3.5 text-left text-sm font-medium transition-all ${interests.includes(interest) ? 'border-spark-500 bg-spark-50 text-spark-900 shadow-sm ring-2 ring-spark-100' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}>
                  {interest}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1" disabled={interests.length === 0} onClick={() => setStep(3)}>Continue</Button>
            </div>
          </>)}
          {step === 3 && ageGroup === 'UNDER_18' && (<>
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
          {step === 3 && ageGroup === 'ADULT' && (<>
            <p className="text-sm text-slate-600">You manage your own learner space. Choose a few interests to personalize your first activities.</p>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
              <input type="checkbox" checked={whatsappOptIn} onChange={(e) => setWhatsappOptIn(e.target.checked)} className="mt-1" />
              <span>I would prefer SparkTrack updates and learning reminders on WhatsApp. I can change this preference at any time.</span>
            </label>
            {whatsappOptIn && <Input value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} type="tel" placeholder="WhatsApp number, including country code (+234…)" />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button className="flex-1" disabled={busy || (whatsappOptIn && whatsappPhone.trim().length < 8)} onClick={() => void submitOnboarding()}>
                {busy ? 'Setting up…' : 'Create my learner space'}
              </Button>
            </div>
          </>)}
          {step === 4 && (
            <p className="text-sm text-slate-700">{ageGroup === 'UNDER_18' ? 'Your profile is saved. It remains pending until your parent or guardian responds to the SMS request.' : 'Your profile is ready. Start with a project, a skill you want to build, or a career goal you want to explore.'}</p>
          )}
        </CardContent>
      </Card>
      </div>
    </main>
  );
}
