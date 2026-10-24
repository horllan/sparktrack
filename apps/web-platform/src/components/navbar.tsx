'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@sparktrack/ui';

const NAV_LINKS = [
  { href: '/student/onboarding', label: 'Onboarding' },
  { href: '/parent/consent', label: 'Guardian Consent' },
  { href: '/student/dashboard', label: 'Student Workspace' },
  { href: '/student/portfolio?learnerId=11111111-1111-4111-8111-111111111113', label: 'Verifiable Portfolio' },
  { href: '/mentor/dashboard', label: 'Mentor Rubric' },
  { href: '/parent/dashboard', label: '13-Part Report' },
  { href: '/school/dashboard', label: 'School Analytics' },
  { href: '/admin/dashboard', label: 'Cohort Admin' },
];

export function Navbar() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
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
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-bold tracking-tight text-spark-900">
            ⚡ SparkTrack
          </Link>
          <Badge variant={online ? 'advanced' : 'developing'}>
            {online ? 'Online • Ledger Sync Ready' : 'Offline • IndexedDB Outbox Active'}
          </Badge>
        </div>
        <nav className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2.5 py-1.5 transition hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

