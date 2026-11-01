'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@sparktrack/offline-sync';
import {
  WifiOff,
  RefreshCw,
  Database,
  ArrowRight,
  ShieldCheck,
  FolderKanban,
  UserCheck,
} from '@sparktrack/ui';

export default function OfflinePage() {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [pendingArtifactsCount, setPendingArtifactsCount] = useState<number>(0);
  const [pendingRubricsCount, setPendingRubricsCount] = useState<number>(0);

  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);

    // Read IndexedDB queue status
    const checkQueue = async () => {
      try {
        const artifacts = await db.pendingArtifacts.count();
        const rubrics = await db.pendingRubrics.count();
        setPendingArtifactsCount(artifacts);
        setPendingRubricsCount(rubrics);
      } catch {
        // IndexedDB might not be available or empty
      }
    };

    checkQueue();

    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  const handleRetry = () => {
    setIsRetrying(true);
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-slate-50">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-6 md:p-8 text-center">
        {/* Offline Icon Header */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-6">
          <WifiOff className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          You are offline right now
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 md:text-base">
          SparkTrack works even when your internet connection drops. Any projects or feedback you save stay safe on this
          device and sync automatically once you are back online.
        </p>

        {/* Sync Status Card */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Saved on This Device
              </span>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                isOnline
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isOnline ? 'Online (Ready to sync)' : 'Offline'}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xl font-bold text-slate-900">{pendingArtifactsCount}</div>
              <div className="mt-0.5 text-xs text-slate-500">Saved Projects</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xl font-bold text-slate-900">{pendingRubricsCount}</div>
              <div className="mt-0.5 text-xs text-slate-500">Saved Reviews</div>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            Your saved items will sync automatically as soon as your connection returns.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Checking connection...' : 'Try Again'}
          </button>
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 sm:w-auto"
          >
            Back to Home
          </Link>
        </div>

        {/* Navigation Shortcuts */}
        <div className="mt-8 border-t border-slate-100 pt-6 text-left">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Quick Links
          </span>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link
              href="/student/dashboard"
              className="group flex items-center justify-between rounded-lg border border-slate-200 p-3 transition-colors hover:border-blue-400 hover:bg-blue-50/50"
            >
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-slate-800">Student Workspace</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-blue-600" />
            </Link>
            <Link
              href="/mentor/dashboard"
              className="group flex items-center justify-between rounded-lg border border-slate-200 p-3 transition-colors hover:border-blue-400 hover:bg-blue-50/50"
            >
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-slate-800">Mentor Workspace</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-blue-600" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
