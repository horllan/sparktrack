'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Compass,
  HeartHandshake,
  Lock,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@sparktrack/ui';
import { createClient } from '../../lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

type PublicRole = 'PARENT' | 'SCHOOL_ADMIN' | 'MENTOR' | 'LEARNER';

const ROLE_OPTIONS: Array<{
  id: PublicRole;
  title: string;
  subtitle: string;
  badge: string;
  description: string;
  icon: typeof HeartHandshake;
  accent: string;
  destination: string;
}> = [
  {
    id: 'PARENT',
    title: 'Parent or Guardian',
    subtitle: 'Register yourself, then add your JSS / SSS child',
    badge: 'Recommended for JSS1–SS3',
    description:
      'Parents and guardians register first to create a safe family account, add one or more children, and control NDPA privacy settings.',
    icon: HeartHandshake,
    accent: 'border-coral-500/40 bg-coral-50/60 text-coral-600',
    destination: '/parent/dashboard',
  },
  {
    id: 'SCHOOL_ADMIN',
    title: 'School or Organisation',
    subtitle: 'Schools, NGOs, camps & training partners',
    badge: 'Institutional Portal',
    description:
      'Onboard your school or youth programme, register students with guardian contacts, and track cohort skill progression.',
    icon: Building2,
    accent: 'border-violet-500/40 bg-violet-50/60 text-violet-700',
    destination: '/school/dashboard',
  },
  {
    id: 'MENTOR',
    title: 'Mentor or Educator',
    subtitle: 'Teachers, coaches & industry verifiers',
    badge: 'Evidence Verifier',
    description:
      'Review student project submissions, score rubric quality, and log 1–4 behavioural signal observations.',
    icon: UsersRound,
    accent: 'border-emerald-500/40 bg-emerald-50/60 text-emerald-700',
    destination: '/mentor/dashboard',
  },
  {
    id: 'LEARNER',
    title: 'Student / Learner',
    subtitle: 'Access your learning hub or teen onboarding',
    badge: 'Explorer Space',
    description:
      'Junior and Secondary students registered by a parent or school can sign in here, or older teens can start self-onboarding.',
    icon: Compass,
    accent: 'border-spark-500/40 bg-spark-50/60 text-spark-700',
    destination: '/student/dashboard',
  },
];

function AuthHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [selectedRole, setSelectedRole] = useState<PublicRole>('PARENT');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [organisationName, setOrganisationName] = useState('');
  const [organisationType, setOrganisationType] = useState<'SCHOOL' | 'NGO' | 'TRAINING_PROVIDER'>('SCHOOL');
  const [invitationToken, setInvitationToken] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const modeParam = searchParams.get('mode');
    const roleParam = searchParams.get('role') as PublicRole | null;
    const inviteParam = searchParams.get('invite');
    if (modeParam === 'signin' || modeParam === 'signup') {
      setMode(modeParam);
    }
    if (roleParam && ROLE_OPTIONS.some((r) => r.id === roleParam)) {
      setSelectedRole(roleParam);
    }
    if (inviteParam) {
      setInvitationToken(inviteParam);
    }
  }, [searchParams]);

  const activeRoleMeta = ROLE_OPTIONS.find((r) => r.id === selectedRole) ?? ROLE_OPTIONS[0]!;

  async function handleSubmit() {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      // If learner wants to sign up directly, guide them to the dedicated 3-step student+guardian onboarding wizard
      if (mode === 'signup' && selectedRole === 'LEARNER') {
        router.push('/student/onboarding');
        return;
      }
      if (mode === 'signup' && selectedRole !== 'PARENT' && !invitationToken.trim()) {
        throw new Error(
          'School, partner, and mentor accounts require a signed Staff Invitation Token (SPK-INV...). Enter your token below or request one via Contact & Support.',
        );
      }

      const supabase = createClient();
      const authRes =
        mode === 'signup'
          ? await supabase.auth.signUp({
              email: email.trim(),
              password,
              options: { emailRedirectTo: window.location.href },
            })
          : await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });

      if (authRes.error) throw authRes.error;

      const token = authRes.data.session?.access_token;
      if (!token) {
        setMode('signin');
        setNotice(
          'Account created! Please check your email inbox to confirm your email address, then sign in below to continue.',
        );
        return;
      }

      if (mode === 'signup') {
        const isParent = selectedRole === 'PARENT';
        const endpoint = isParent ? `${API_URL}/v1/auth/register-role` : `${API_URL}/v1/auth/accept-invitation`;
        const regRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(
            isParent
              ? {
                  role: 'PARENT',
                  fullName: fullName.trim(),
                  email: email.trim(),
                  ...(phoneNumber.trim() ? { phoneNumber: phoneNumber.trim() } : {}),
                }
              : {
                  invitationToken: invitationToken.trim(),
                  role: selectedRole,
                  fullName: fullName.trim(),
                  email: email.trim(),
                  ...(phoneNumber.trim() ? { phoneNumber: phoneNumber.trim() } : {}),
                  ...(selectedRole === 'SCHOOL_ADMIN' && organisationName.trim()
                    ? {
                        organisationName: organisationName.trim(),
                        organisationType,
                      }
                    : {}),
                },
          ),
        });

        if (!regRes.ok) {
          const errBody = (await regRes.json().catch(() => null)) as { message?: string } | null;
          throw new Error(errBody?.message ?? 'Could not complete role registration.');
        }

        if (selectedRole === 'PARENT') {
          router.push('/parent/dashboard?welcome=add-child');
        } else if (selectedRole === 'SCHOOL_ADMIN') {
          router.push('/school/dashboard?welcome=add-student');
        } else {
          router.push(activeRoleMeta.destination);
        }
        return;
      }

      // Sign-in mode: query /v1/auth/me to route the user to their provisioned workspace
      const meRes = await fetch(`${API_URL}/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (meRes.ok) {
        const me = (await meRes.json()) as { role?: string };
        if (me.role === 'PARENT') {
          router.push('/parent/dashboard');
          return;
        }
        if (me.role === 'SCHOOL_ADMIN' || me.role === 'ORG_PARTNER') {
          router.push('/school/dashboard');
          return;
        }
        if (me.role === 'MENTOR') {
          router.push('/mentor/dashboard');
          return;
        }
        if (me.role === 'SUPER_ADMIN') {
          router.push('/admin/dashboard');
          return;
        }
      }
      router.push(activeRoleMeta.destination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authentication failed. Please check your details.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header & Mode Switcher */}
        <div className="spark-enter flex flex-col items-start justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.28)] backdrop-blur sm:flex-row sm:items-center sm:p-8">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-spark-200 bg-spark-50 px-3 py-1 text-xs font-semibold text-spark-700">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Unified SparkTrack Access Hub</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              {mode === 'signup' ? 'Choose how you are joining SparkTrack.' : 'Welcome back to SparkTrack.'}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Junior and Secondary school students (<span className="font-semibold text-slate-800">JSS1–SS3</span>) are
              registered by a <span className="font-semibold text-slate-800">Parent/Guardian</span> or{' '}
              <span className="font-semibold text-slate-800">School</span> first to guarantee NDPA child safety.
            </p>
          </div>

          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100/80 p-1.5">
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
                setNotice('');
              }}
              className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${
                mode === 'signup' ? 'bg-spark-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError('');
                setNotice('');
              }}
              className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${
                mode === 'signin' ? 'bg-spark-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
          </div>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[1.08fr_0.92fr]">
          {/* Left Column: Interactive Role Selection Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                1. Select Your Role Workspace
              </p>
              <Badge variant="outline">4 Role Portals</Badge>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              {ROLE_OPTIONS.map((role) => {
                const Icon = role.icon;
                const active = selectedRole === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      setSelectedRole(role.id);
                      setError('');
                    }}
                    className={`group flex h-full flex-col justify-between rounded-2xl border p-5 text-left transition-all ${
                      active
                        ? 'border-spark-500 bg-white shadow-lg ring-2 ring-spark-500/15'
                        : 'border-slate-200/90 bg-white/80 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${role.accent}`}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <Badge variant={active ? 'default' : 'outline'}>{role.badge}</Badge>
                      </div>
                      <h2 className="mt-4 text-base font-extrabold text-slate-900">{role.title}</h2>
                      <p className="mt-0.5 text-xs font-semibold text-spark-700">{role.subtitle}</p>
                      <p className="mt-2.5 text-xs leading-5 text-slate-600">{role.description}</p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-spark-700">
                      <span>{active ? 'Selected Workspace' : 'Select this role'}</span>
                      <CheckCircle2 className={`h-4 w-4 ${active ? 'text-spark-600' : 'text-slate-300'}`} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Helpful Parent/School Registration Guidance Box */}
            <div className="rounded-2xl border border-blue-200/80 bg-blue-50/70 p-4 text-xs leading-5 text-blue-950">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-spark-600" />
                <div>
                  <p className="font-bold text-slate-900">
                    How Junior &amp; Senior Secondary (JSS1–SS3) Registration Works
                  </p>
                  <p className="mt-1 text-slate-700">
                    1. <strong>Parent/Guardian</strong> or <strong>School</strong> creates an account here first.
                    <br />
                    2. Inside your dashboard, click <strong>&ldquo;Add Child / Student&rdquo;</strong> to create the
                    student’s profile, choose their interests, and receive their unique{' '}
                    <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px]">SPK-XXXX</code> Learner ID.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Dynamic Form Card */}
          <Card className="overflow-hidden border-slate-200/90 shadow-xl">
            <div className="h-1.5 bg-gradient-to-r from-spark-600 via-cyan-500 to-coral-500" />
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant="default">{activeRoleMeta.title}</Badge>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                  <Lock className="h-3.5 w-3.5" /> End-to-End Protected
                </span>
              </div>
              <CardTitle className="mt-2 text-xl">
                {mode === 'signup' ? `Create your ${activeRoleMeta.title} account` : `Sign in as ${activeRoleMeta.title}`}
              </CardTitle>
              <CardDescription>{activeRoleMeta.subtitle}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {error && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  {notice}
                </p>
              )}

              {mode === 'signup' && selectedRole === 'LEARNER' ? (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Are you in Junior or Senior Secondary School (JSS1–SS3)?</p>
                  <p className="text-xs leading-5 text-slate-600">
                    Ask your <strong>Parent/Guardian</strong> or <strong>School</strong> to register you from their
                    account first. If you are 16+ or ready to invite your parent via SMS consent right now, you can use
                    the guided Student Onboarding wizard.
                  </p>
                  <div className="flex flex-col gap-2.5 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setSelectedRole('PARENT')}
                    >
                      Switch to Parent Registration
                    </Button>
                    <Link href="/student/onboarding" className="flex-1">
                      <Button type="button" className="w-full">
                        Continue Teen Onboarding <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  {mode === 'signup' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">
                          {selectedRole === 'PARENT'
                            ? 'Parent / Guardian Full Name'
                            : selectedRole === 'SCHOOL_ADMIN'
                              ? 'Administrator / Coordinator Full Name'
                              : 'Mentor Full Name'}
                        </label>
                        <Input
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Mrs. Funke Adeyemi"
                        />
                      </div>

                      {selectedRole === 'SCHOOL_ADMIN' && (
                        <div className="grid gap-3 sm:grid-cols-[1.3fr_0.7fr]">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-700">School or Organisation Name</label>
                            <Input
                              value={organisationName}
                              onChange={(e) => setOrganisationName(e.target.value)}
                              placeholder="e.g. Lagos Model Secondary School"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-700">Institution Type</label>
                            <select
                              value={organisationType}
                              onChange={(e) => setOrganisationType(e.target.value as typeof organisationType)}
                              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-900"
                            >
                              <option value="SCHOOL">Secondary / Junior School</option>
                              <option value="NGO">NGO / Youth Foundation</option>
                              <option value="TRAINING_PROVIDER">STEM / Training Hub</option>
                            </select>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">
                          Phone Number (for SMS notifications &amp; verification)
                        </label>
                        <Input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="+2348012345678"
                        />
                      </div>

                      {(selectedRole === 'SCHOOL_ADMIN' || selectedRole === 'MENTOR') && (
                        <div className="space-y-1.5 rounded-2xl border border-violet-200/80 bg-violet-50/50 p-3.5">
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-bold text-slate-900">
                              Staff Invitation Token (Required)
                            </label>
                            <Link
                              href="/contact"
                              className="text-[11px] font-semibold text-spark-700 underline hover:text-spark-800"
                            >
                              Request an Invitation →
                            </Link>
                          </div>
                          <Input
                            value={invitationToken}
                            onChange={(e) => setInvitationToken(e.target.value)}
                            placeholder="SPK-INV.SCHOOL_ADMIN.1799..."
                            className="bg-white font-mono text-xs"
                          />
                          <p className="text-[11px] leading-4 text-slate-600">
                            Institutional and mentor roles are protected by signed staff invitations to prevent unauthorized access to learner cohorts.
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Email Address</label>
                    <Input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Password</label>
                    <Input
                      type="password"
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'signup' ? 'Minimum 8 characters' : 'Enter your password'}
                    />
                  </div>

                  {mode === 'signup' && (
                    <p className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-[11px] leading-5 text-slate-600">
                      By creating an account, you agree to SparkTrack’s{' '}
                      <Link href="/legal?doc=terms" className="font-semibold text-spark-700 underline">
                        Terms of Service
                      </Link>
                      ,{' '}
                      <Link href="/legal?doc=privacy" className="font-semibold text-spark-700 underline">
                        Privacy Policy (NDPA 2023 • POPIA • GDPR)
                      </Link>
                      , and{' '}
                      <Link href="/legal?doc=child-safety" className="font-semibold text-spark-700 underline">
                        Child Safeguarding Charter
                      </Link>
                      .
                    </p>
                  )}

                  <Button
                    className="w-full"
                    disabled={
                      busy ||
                      !email.trim() ||
                      password.length < (mode === 'signup' ? 8 : 1) ||
                      (mode === 'signup' && fullName.trim().length < 2) ||
                      (mode === 'signup' && selectedRole === 'SCHOOL_ADMIN' && organisationName.trim().length < 2)
                    }
                    onClick={() => void handleSubmit()}
                  >
                    {busy
                      ? 'Please wait…'
                      : mode === 'signup'
                        ? `Create ${activeRoleMeta.title} Account`
                        : `Sign In to ${activeRoleMeta.title} Hub`}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </>
              )}

              {/* Quick Demo Explorer Bar */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500">Exploring the live demo environment?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    href={activeRoleMeta.destination}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <span>Preview {activeRoleMeta.title} Workspace</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    href="/parent/consent"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <span>Enter Guardian SMS Code</span>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-slate-500">Loading SparkTrack Access Hub…</div>}>
      <AuthHubContent />
    </Suspense>
  );
}
