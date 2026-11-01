'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  ChevronRight,
  Compass,
  FolderKanban,
  HeartHandshake,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UsersRound,
  X,
  Badge,
} from '@sparktrack/ui';
import { createClient } from '../lib/supabase/client';

const ROLE_LINKS = {
  student: [
    { href: '/student/dashboard', label: 'My Workspace', icon: LayoutDashboard },
    { href: '/student/portfolio', label: 'Portfolio', icon: FolderKanban },
    { href: '/student/onboarding', label: 'Profile Setup', icon: Compass },
  ],
  parent: [
    { href: '/parent/dashboard', label: 'Family Hub', icon: HeartHandshake },
    { href: '/parent/consent', label: 'SMS Consent', icon: ShieldCheck },
  ],
  mentor: [{ href: '/mentor/dashboard', label: 'Mentor Workspace', icon: UsersRound }],
  school: [
    { href: '/school/dashboard', label: 'School Overview', icon: LayoutDashboard },
    { href: '/student/portfolio', label: 'Verify Portfolio', icon: FolderKanban },
  ],
  admin: [{ href: '/admin/dashboard', label: 'Admin Console', icon: LayoutDashboard }],
};

const PUBLIC_SPACES = [
  { href: '/demo', label: 'Product Demo', icon: PlayCircle },
  { href: '/parent/dashboard', label: 'Parents & Guardians', icon: HeartHandshake },
  { href: '/school/dashboard', label: 'Schools & Partners', icon: Building2 },
  { href: '/mentor/dashboard', label: 'Mentors', icon: UsersRound },
  { href: '/student/dashboard', label: 'Students & Learners', icon: Compass },
  { href: '/student/portfolio', label: 'Portfolio Check', icon: FolderKanban },
];

const MOBILE_BOTTOM_TABS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/demo', label: 'Demo', icon: PlayCircle },
  { href: '/parent/dashboard', label: 'Family', icon: HeartHandshake },
  { href: '/student/dashboard', label: 'Learner', icon: Compass },
  { href: '/auth', label: 'Account', icon: UserPlus },
];

function getPageLabel(pathname: string): string {
  if (pathname.startsWith('/demo')) return 'Product Demo';
  if (pathname.startsWith('/parent/consent')) return 'Parent Consent';
  if (pathname.startsWith('/parent')) return 'Family Hub';
  if (pathname.startsWith('/student/portfolio')) return 'Public Portfolio';
  if (pathname.startsWith('/student/onboarding')) return 'Learner Setup';
  if (pathname.startsWith('/student')) return 'Student Workspace';
  if (pathname.startsWith('/mentor')) return 'Mentor Workspace';
  if (pathname.startsWith('/school')) return 'School Overview';
  if (pathname.startsWith('/admin')) return 'Admin Console';
  if (pathname.startsWith('/auth')) return 'Sign In & Register';
  if (pathname.startsWith('/legal')) return 'Privacy & Terms';
  if (pathname.startsWith('/contact')) return 'Contact Us';
  if (pathname.startsWith('/internal')) return 'Staff Access';
  return 'Home';
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isHome = pathname === '/';
  const pageLabel = getPageLabel(pathname);

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
    ? [...ROLE_LINKS[role], { href: '/demo', label: 'Demo', icon: PlayCircle }]
    : [
        { href: '/demo', label: 'Demo', icon: PlayCircle },
        { href: '/#how-it-works', label: 'How It Works', icon: Compass },
        { href: '/parent/dashboard', label: 'Parents', icon: HeartHandshake },
        { href: '/school/dashboard', label: 'Schools', icon: UsersRound },
        { href: '/legal', label: 'Privacy', icon: ShieldCheck },
        { href: '/contact', label: 'Contact', icon: Activity },
      ];

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  }

  async function handleSignOut() {
    await createClient().auth.signOut();
    setUserEmail(null);
    setMobileMenuOpen(false);
    router.push('/auth?mode=signin');
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-[0_1px_8px_rgba(17,28,52,0.04)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[64px] max-w-[1440px] items-center justify-between gap-2 px-3 sm:min-h-[72px] sm:gap-4 sm:px-6 lg:px-10">
          {/* Left: Back Button (when not on Home) + Brand Logo */}
          <div className="flex items-center gap-2">
            {!isHome && (
              <button
                type="button"
                onClick={handleBack}
                aria-label="Go back to previous page"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/90 px-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-100 hover:text-slate-900 active:scale-95 sm:px-3"
              >
                <ArrowLeft size={15} aria-hidden="true" />
                <span className="hidden xs:inline sm:inline">Back</span>
              </button>
            )}

            <Link href="/" className="group flex shrink-0 items-center gap-2" aria-label="SparkTrack home">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-spark-600 text-white shadow-sm transition-transform group-hover:-rotate-3">
                <Sparkles size={18} strokeWidth={2.4} aria-hidden="true" />
              </span>
              <span className="text-base font-extrabold tracking-[-0.04em] text-slate-900 sm:text-[17px]">
                sparktrack
              </span>
            </Link>
          </div>

          {/* Center Desktop Navigation */}
          <nav
            aria-label="Main navigation"
            className="hidden min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto px-2 lg:flex"
          >
            {!isHome && (
              <Link
                href="/"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <Home size={15} aria-hidden="true" />
                <span>Home</span>
              </Link>
            )}
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

          {/* Right Actions (Desktop + Mobile Menu Toggle) */}
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={online ? 'success' : 'warning'} className="hidden xl:inline-flex">
              <Activity size={13} className="mr-1.5" aria-hidden="true" />
              {online ? 'Online' : 'Offline Mode'}
            </Badge>

            {/* Desktop Workspaces Dropdown */}
            <details className="relative hidden md:block">
              <summary className="flex h-10 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spark-500">
                <span>Workspaces</span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </summary>
              <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Switch Workspace
                </p>
                {PUBLIC_SPACES.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-spark-50 hover:text-spark-900"
                    >
                      <Icon size={15} className="text-spark-600" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </details>

            {/* Desktop Auth Buttons */}
            {userEmail ? (
              <div className="hidden items-center gap-2 md:flex">
                <span
                  title={userEmail}
                  className="max-w-[130px] truncate rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  {userEmail}
                </span>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link
                  href="/auth?mode=signin"
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 shadow-2xs transition hover:bg-slate-50"
                >
                  <LogIn size={15} />
                  <span>Sign In</span>
                </Link>
                <Link
                  href="/auth?mode=signup&role=PARENT"
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-spark-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-spark-700"
                >
                  <UserPlus size={15} />
                  <span>Register</span>
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xs transition hover:bg-slate-50 lg:hidden"
            >
              {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>

        {/* Contextual Breadcrumb & Quick-Back Bar on Inner Pages */}
        {!isHome && (
          <div className="border-t border-slate-100 bg-slate-50/90 px-3 py-1.5 sm:px-6 lg:px-10">
            <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2 text-xs">
              <div className="flex min-w-0 items-center gap-1.5 text-slate-500">
                <Link href="/" className="font-semibold text-slate-700 hover:text-spark-700">
                  Home
                </Link>
                <ChevronRight size={13} className="shrink-0 text-slate-400" />
                <span className="truncate font-bold text-spark-800">{pageLabel}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="font-semibold text-slate-600 hover:text-slate-900"
                >
                  ← Previous Page
                </button>
                <Link href="/auth" className="hidden font-semibold text-spark-700 hover:underline sm:inline">
                  Switch Role →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Offline Banner */}
        {!online && (
          <div className="bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-950">
            You are offline. Your work is saved on this device and will sync when you reconnect.
          </div>
        )}

        {/* Mobile Slide-Down Drawer Menu */}
        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 pb-6 pt-4 shadow-2xl lg:hidden">
            <div className="space-y-5">
              {/* Current Section Links */}
              <div>
                <p className="px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Navigation</p>
                <div className="mt-2 grid gap-1">
                  <Link
                    href="/"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Home size={16} className="text-spark-600" />
                    <span>Home Page</span>
                  </Link>
                  {links.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <Icon size={16} className="text-spark-600" />
                      <span>{label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* All Role Workspaces */}
              <div className="border-t border-slate-100 pt-4">
                <p className="px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Role Workspaces
                </p>
                <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {PUBLIC_SPACES.map((space) => {
                    const Icon = space.icon;
                    return (
                      <Link
                        key={space.href}
                        href={space.href}
                        className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-spark-50"
                      >
                        <Icon size={16} className="text-spark-600" />
                        <span>{space.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Auth CTAs */}
              <div className="border-t border-slate-100 pt-4">
                {userEmail ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
                    <span className="truncate text-xs font-semibold text-slate-700">{userEmail}</span>
                    <button
                      type="button"
                      onClick={() => void handleSignOut()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800"
                    >
                      <LogOut size={13} /> Sign Out
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <Link
                      href="/auth?mode=signin"
                      className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800"
                    >
                      <LogIn size={15} /> Sign In
                    </Link>
                    <Link
                      href="/auth?mode=signup&role=PARENT"
                      className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-spark-600 text-sm font-bold text-white"
                    >
                      <UserPlus size={15} /> Register
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Mobile Sticky Bottom Tab Bar (Thumb-Friendly App Navigation) */}
      <nav
        aria-label="Mobile quick navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 px-2 py-1.5 shadow-[0_-4px_20px_rgba(15,23,42,0.06)] backdrop-blur-lg md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {MOBILE_BOTTOM_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center rounded-xl py-1.5 text-[11px] font-bold transition ${
                  active ? 'bg-spark-50 text-spark-700' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon size={17} aria-hidden="true" />
                <span className="mt-0.5 truncate">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
