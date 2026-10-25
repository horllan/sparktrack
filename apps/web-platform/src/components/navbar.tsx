'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Compass,
  FolderKanban,
  HeartHandshake,
  LayoutDashboard,
  LogIn,
  LogOut,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { Badge } from '@sparktrack/ui';
import { createClient } from '../lib/supabase/client';

const ROLE_LINKS = {
  student: [
    { href: '/student/dashboard', label: 'My Learning Hub', icon: LayoutDashboard },
    { href: '/student/portfolio', label: 'Verified Portfolio', icon: FolderKanban },
  ],
  parent: [
    { href: '/parent/dashboard', label: 'Family & Children Hub', icon: HeartHandshake },
    { href: '/parent/consent', label: 'SMS Consent Code', icon: ShieldCheck },
  ],
  mentor: [{ href: '/mentor/dashboard', label: 'Mentor Review Studio', icon: UsersRound }],
  school: [
    { href: '/school/dashboard', label: 'School & Student Insights', icon: LayoutDashboard },
    { href: '/student/portfolio', label: 'Verify Portfolio', icon: FolderKanban },
  ],
  admin: [{ href: '/admin/dashboard', label: 'Operations Console', icon: LayoutDashboard }],
};

const PUBLIC_SPACES = [
  { href: '/parent/dashboard', label: 'Parent & Family Hub' },
  { href: '/school/dashboard', label: 'School & Partner Hub' },
  { href: '/mentor/dashboard', label: 'Mentor Studio' },
  { href: '/student/dashboard', label: 'Student Learning Hub' },
  { href: '/student/portfolio', label: 'Public Portfolio Verifier' },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const role = pathname.startsWith('/student')
    ? 'student'
    : pathname.startsWith('/parent')
      ? 'parent'
      : pathname.startsWith('/mentor')
        ? 'mentor'
        : pathname.startsWith('/school')
          ? 'school'
          : pathname.startsWith('/admin')
            ? 'admin'
            : null;

  const links = role
    ? ROLE_LINKS[role]
    : [
        { href: '/#how-it-works', label: 'How It Works', icon: Compass },
        { href: '/#tour', label: 'Interactive Tour', icon: PlayCircle },
        { href: '/parent/dashboard', label: 'For Parents', icon: HeartHandshake },
        { href: '/school/dashboard', label: 'For Schools', icon: UsersRound },
        { href: '/student/portfolio', label: 'Verify Portfolio', icon: ShieldCheck },
      ];

  useEffect(() => {
    setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => null);
    }
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const supabase = createClient();
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setUserEmail(data.session?.user?.email ?? null);
      })
      .catch(() => null);

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    await createClient().auth.signOut();
    setUserEmail(null);
    router.push('/auth?mode=signin');
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 shadow-[0_1px_8px_rgba(17,28,52,0.035)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-[72px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="SparkTrack home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-spark-600 text-white shadow-sm transition-transform group-hover:-rotate-3">
            <Sparkles size={19} strokeWidth={2.4} aria-hidden="true" />
          </span>
          <span className="text-[17px] font-extrabold tracking-[-0.04em] text-slate-900">sparktrack</span>
        </Link>

        <nav
          aria-label="Main navigation"
          className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto px-2"
        >
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                  active ? 'bg-spark-50 text-spark-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={online ? 'success' : 'warning'} className="hidden md:inline-flex">
            <Activity size={13} className="mr-1.5" aria-hidden="true" />
            {online ? 'Online' : 'Offline Mode'}
          </Badge>

          <details className="relative">
            <summary className="flex h-10 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spark-500">
              <span className="hidden sm:inline">Workspaces</span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </summary>
            <div className="absolute right-0 top-12 z-50 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Switch Workspace
              </p>
              {PUBLIC_SPACES.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-spark-50 hover:text-spark-900"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </details>

          {userEmail ? (
            <div className="flex items-center gap-2">
              <span
                title={userEmail}
                className="hidden max-w-[140px] truncate rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 lg:inline-block"
              >
                {userEmail}
              </span>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/auth?mode=signin"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                <LogIn size={15} />
                <span>Sign In</span>
              </Link>
              <Link
                href="/auth?mode=signup&role=PARENT"
                className="hidden h-10 items-center gap-1.5 rounded-xl bg-spark-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-spark-700 sm:inline-flex"
              >
                <UserPlus size={15} />
                <span>Register</span>
              </Link>
            </div>
          )}
        </div>
      </div>
      {!online && (
        <div className="bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-950 sm:hidden">
          You’re offline. New work can be saved on this device.
        </div>
      )}
    </header>
  );
}
