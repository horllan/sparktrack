'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Activity, ArrowUpRight, Compass, FolderKanban, LayoutDashboard, ShieldCheck, Sparkles, Badge } from '@sparktrack/ui';

const ROLE_LINKS = {
  student: [
    { href: '/student/dashboard', label: 'My learning', icon: LayoutDashboard },
    { href: '/student/portfolio', label: 'Portfolio', icon: FolderKanban },
  ],
  parent: [
    { href: '/parent/dashboard', label: 'Family overview', icon: LayoutDashboard },
    { href: '/parent/consent', label: 'Consent', icon: ShieldCheck },
  ],
  mentor: [{ href: '/mentor/dashboard', label: 'Review work', icon: LayoutDashboard }],
  school: [{ href: '/school/dashboard', label: 'Insights', icon: LayoutDashboard }],
  admin: [{ href: '/admin/dashboard', label: 'Operations', icon: LayoutDashboard }],
};

const OTHER_SPACES = [
  { href: '/student/dashboard', label: 'Learner space' },
  { href: '/parent/dashboard', label: 'Family space' },
  { href: '/mentor/dashboard', label: 'Mentor space' },
  { href: '/school/dashboard', label: 'School insights' },
  { href: '/admin/dashboard', label: 'Operations' },
];

export function Navbar() {
  const pathname = usePathname();
  const [online, setOnline] = useState(true);
  const role = pathname.startsWith('/student') ? 'student'
    : pathname.startsWith('/parent') ? 'parent'
    : pathname.startsWith('/mentor') ? 'mentor'
    : pathname.startsWith('/school') ? 'school'
    : pathname.startsWith('/admin') ? 'admin'
    : null;
  const links = role ? ROLE_LINKS[role] : [
    { href: '/student/onboarding', label: 'Get started', icon: Compass },
    { href: '/student/dashboard', label: 'Learner space', icon: LayoutDashboard },
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
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 shadow-[0_1px_8px_rgba(17,28,52,0.035)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-[72px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="SparkTrack home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-spark-600 text-white shadow-sm transition-transform group-hover:-rotate-3">
            <Sparkles size={19} strokeWidth={2.4} aria-hidden="true" />
          </span>
          <span className="text-[17px] font-extrabold tracking-[-0.04em] text-slate-900">sparktrack</span>
        </Link>

        <nav aria-label="Main navigation" className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto px-2">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                  active ? 'bg-spark-50 text-spark-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
          {role && (
            <Link
              href="/student/onboarding"
              className="hidden shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
            >
              <Compass size={16} aria-hidden="true" />
              Explore
            </Link>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={online ? 'success' : 'warning'} className="hidden sm:inline-flex">
            <Activity size={13} className="mr-1.5" aria-hidden="true" />
            {online ? 'Online' : 'Offline'}
          </Badge>
          <details className="relative">
            <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spark-500">
              <span className="hidden sm:inline">Workspaces</span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </summary>
            <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Switch space</p>
              {OTHER_SPACES.map((item) => (
                <Link key={item.href} href={item.href} className="block rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-spark-50 hover:text-spark-900">
                  {item.label}
                </Link>
              ))}
            </div>
          </details>
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
