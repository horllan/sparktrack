'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  KeyRound,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@sparktrack/ui';
import { createClient } from '../../../lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export default function InternalAdminAccessPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'bootstrap'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminSecret, setAdminSecret] = useState('');
  const [showSecurityKeyInput, setShowSecurityKeyInput] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [activeSession, setActiveSession] = useState<{ email: string; role: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [awaitingEmailConfirm, setAwaitingEmailConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function detectSession() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const userEmail = data.session?.user?.email;
        if (!token || !userEmail) return;
        const res = await fetch(`${API_URL}/v1/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null);
        if (!res?.ok || cancelled) return;
        const me = (await res.json()) as { role?: string };
        if (me.role && !cancelled) {
          setActiveSession({ email: userEmail, role: me.role });
          setEmail((prev) => prev || userEmail);
        }
      } catch {
        // Non-fatal
      }
    }
    void detectSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function bootstrapWithToken(token: string) {
    const res = await fetch(`${API_URL}/v1/auth/admin/bootstrap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fullName: fullName.trim() || 'SparkTrack Operations Admin',
        email: email.trim(),
        adminSecret: adminSecret.trim(),
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? 'Invalid operator security key.');
    }
  }

  async function handleResendConfirmation() {
    if (!email.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const supabase = createClient();
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: window.location.href },
      });
      if (resendErr) throw resendErr;
      setNotice('Confirmation email re-sent. Check your inbox (and spam folder), then click Staff Sign In.');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not resend confirmation email. You can also confirm the user directly in Supabase Dashboard → Authentication → Users.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAdminAuth(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    setAwaitingEmailConfirm(false);
    try {
      const supabase = createClient();
      const trimmedEmail = email.trim();
      const trimmedSecret = adminSecret.trim();

      if (mode === 'bootstrap') {
        if (trimmedSecret.length < 32) {
          throw new Error('The operator security key must be at least 32 characters.');
        }

        // Attempt 1: Direct auto-confirmed operator provisioning via backend Admin API
        const regRes = await fetch(`${API_URL}/v1/auth/admin/register-operator`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: fullName.trim() || 'SparkTrack Operations Admin',
            email: trimmedEmail,
            password,
            adminSecret: trimmedSecret,
          }),
        }).catch(() => null);

        if (regRes?.ok) {
          const signInRes = await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          });
          if (signInRes.error) throw signInRes.error;
          router.push('/admin/dashboard');
          return;
        }

        if (regRes && regRes.status === 403) {
          const body = (await regRes.json().catch(() => null)) as { message?: string } | null;
          throw new Error(body?.message ?? 'Invalid operator security key.');
        }

        // Fallback when SUPABASE_SERVICE_ROLE_KEY is not configured:
        // Try signing in first in case the account already exists, otherwise sign up.
        let token: string | undefined;
        const existingSignIn = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (!existingSignIn.error && existingSignIn.data.session?.access_token) {
          token = existingSignIn.data.session.access_token;
        } else {
          const signUpRes = await supabase.auth.signUp({
            email: trimmedEmail,
            password,
            options: { emailRedirectTo: window.location.href },
          });
          if (signUpRes.error) throw signUpRes.error;
          token = signUpRes.data.session?.access_token;
        }

        if (!token) {
          setAwaitingEmailConfirm(true);
          setMode('signin');
          setNotice(
            'Account created, but Supabase requires email confirmation before issuing a session. Check your inbox (or confirm the user in Supabase Dashboard → Authentication → Users), then sign in here with your Security Key.',
          );
          return;
        }

        await bootstrapWithToken(token);
        router.push('/admin/dashboard');
        return;
      }

      // Staff Sign In mode
      const authRes = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (authRes.error) {
        if (authRes.error.message.toLowerCase().includes('email not confirmed')) {
          setAwaitingEmailConfirm(true);
          throw new Error(
            'Your email is not confirmed yet. Click "Resend Confirmation Email" below or confirm the user in Supabase Dashboard → Authentication → Users.',
          );
        }
        throw authRes.error;
      }

      const token = authRes.data.session?.access_token;
      if (!token) throw new Error('Sign in succeeded, but no active session token was returned.');

      if (mode === 'signin' && (!showSecurityKeyInput || !trimmedSecret)) {
        const meRes = await fetch(`${API_URL}/v1/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null);
        if (meRes?.ok) {
          const me = (await meRes.json()) as { role?: string };
          if (me.role !== 'SUPER_ADMIN' && me.role !== 'SCHOOL_ADMIN' && me.role !== 'ORG_PARTNER') {
            setShowSecurityKeyInput(true);
            throw new Error(
              'Your account is signed in, but does not have Admin access yet. Enter your Security Key below to activate Super Admin permissions.',
            );
          }
        }
      } else if (trimmedSecret) {
        await bootstrapWithToken(token);
      }

      router.push('/admin/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restricted portal authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-[82vh] items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-md space-y-6">
        <Card className="overflow-hidden border-slate-300 shadow-2xl">
          <div className="h-1.5 bg-gradient-to-r from-slate-900 via-spark-700 to-cyan-500" />
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="warning">
                <ShieldAlert className="mr-1 h-3.5 w-3.5" /> Staff Only
              </Badge>
              <Lock className="h-4 w-4 text-slate-400" />
            </div>
            <CardTitle className="mt-3 text-xl">Admin &amp; Operations Sign In</CardTitle>
            <CardDescription>
              Restricted to authorised SparkTrack operations staff.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {activeSession &&
              (activeSession.role === 'SUPER_ADMIN' ||
                activeSession.role === 'SCHOOL_ADMIN' ||
                activeSession.role === 'ORG_PARTNER') && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-emerald-950">Active Admin Session</span>
                    <Badge variant="success">{activeSession.role}</Badge>
                  </div>
                  <p className="mt-1 text-emerald-900">
                    Signed in as <strong>{activeSession.email}</strong>. No password or key needed.
                  </p>
                  <Button
                    type="button"
                    className="mt-3 w-full"
                    onClick={() => router.push('/admin/dashboard')}
                  >
                    Continue to Admin Console <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </div>
              )}

            <form
              className="space-y-4"
              onSubmit={(e) => {
                void handleAdminAuth(e);
              }}
            >
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setShowSecurityKeyInput(false);
                  setAdminSecret('');
                  setError('');
                }}
                className={`rounded-lg py-2 text-xs font-bold transition ${
                  mode === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Staff Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('bootstrap');
                  setShowSecurityKeyInput(true);
                  setError('');
                }}
                className={`rounded-lg py-2 text-xs font-bold transition ${
                  mode === 'bootstrap' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Activate Admin Key
              </button>
            </div>

            {error && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
                {error}
              </p>
            )}
            {notice && (
              <p
                role="status"
                className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-900"
              >
                {notice}
              </p>
            )}

            {mode === 'bootstrap' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Full Name</label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Work Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@sparktrack.org"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-[11px] font-semibold text-spark-700 hover:underline"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>

            {mode === 'signin' && !showSecurityKeyInput ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowSecurityKeyInput(true)}
                  className="text-[11px] font-semibold text-spark-700 hover:underline"
                >
                  First-time activation? Enter Security Key
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <KeyRound className="h-3.5 w-3.5 text-spark-600" />
                    <span>
                      Security Key {mode === 'signin' ? '(optional if already activated)' : '(32+ chars)'}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSecret((v) => !v)}
                    className="text-[11px] font-semibold text-spark-700 hover:underline"
                  >
                    {showSecret ? 'Hide' : 'Show'}
                  </button>
                </div>
                <Input
                  type={showSecret ? 'text' : 'password'}
                  name="operator-security-key"
                  autoComplete="new-password"
                  value={adminSecret}
                  onChange={(e) => setAdminSecret(e.target.value)}
                  placeholder="Paste ADMIN_REGISTRATION_SECRET"
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={
                busy ||
                !email.trim() ||
                password.length < 6 ||
                (mode === 'bootstrap' && (fullName.trim().length < 2 || adminSecret.trim().length < 32))
              }
            >
              <ShieldCheck className="mr-1.5 h-4 w-4" />
              {busy
                ? 'Signing in…'
                : mode === 'bootstrap'
                  ? 'Activate Admin Account'
                  : 'Open Admin Console'}
            </Button>

            {awaitingEmailConfirm && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={busy || !email.trim()}
                onClick={() => void handleResendConfirmation()}
              >
                Resend Confirmation Email
              </Button>
            )}
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

