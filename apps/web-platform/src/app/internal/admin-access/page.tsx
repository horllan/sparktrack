'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function handleAdminAuth() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const supabase = createClient();
      const authRes =
        mode === 'bootstrap'
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
        setNotice('Confirm your operator email address first, then return here to complete Super Admin provisioning.');
        return;
      }

      if (mode === 'bootstrap') {
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
          throw new Error(body?.message ?? 'Admin bootstrap rejected.');
        }
      } else {
        // If signing in and adminSecret was also provided, elevate/verify role
        if (adminSecret.trim()) {
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
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
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
              <label className="text-xs font-semibold text-slate-700">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <KeyRound className="h-3.5 w-3.5 text-spark-600" />
                <span>
                  Security Key {mode === 'signin' ? '(optional if already activated)' : '(required)'}
                </span>
              </label>
              <Input
                type="password"
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                placeholder="Enter administrator security key"
              />
            </div>

            <Button
              className="w-full"
              disabled={
                busy ||
                !email.trim() ||
                password.length < 6 ||
                (mode === 'bootstrap' && (fullName.trim().length < 2 || adminSecret.trim().length < 16))
              }
              onClick={() => void handleAdminAuth()}
            >
              <ShieldCheck className="mr-1.5 h-4 w-4" />
              {busy
                ? 'Signing in…'
                : mode === 'bootstrap'
                  ? 'Activate Admin Account'
                  : 'Open Admin Console'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

