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

        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
          You are currently offline
        </h1>
        <p className="mt-3 text-slate-600 leading-relaxed text-sm md:text-base">
          SparkTrack is engineered for low-bandwidth and intermittent Nigerian internet connections.
          Your local app shell is active, and offline changes remain safe in your local browser storage.
        </p>

        {/* Sync Status Card */}
        <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-left">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                IndexedDB Local Queue
              </span>
            </div>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                isOnline
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isOnline ? 'Online (Ready to sync)' : 'Offline mode'}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-center">
            <div className="p-3 bg-white rounded-lg border border-slate-200">
              <div className="text-xl font-bold text-slate-900">{pendingArtifactsCount}</div>
              <div className="text-xs text-slate-500 mt-0.5">Pending Evidence</div>
            </div>
            <div className="p-3 bg-white rounded-lg border border-slate-200">
              <div className="text-xl font-bold text-slate-900">{pendingRubricsCount}</div>
              <div className="text-xs text-slate-500 mt-0.5">Pending Rubrics</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            Queued submissions are hashed with SHA-256 and will sync automatically when connection returns.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Checking connection...' : 'Retry Connection'}
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm transition-colors"
          >
            Return to Homepage
          </Link>
        </div>

        {/* Precached Navigation Shortcuts */}
        <div className="mt-8 pt-6 border-t border-slate-100 text-left">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Available Cached Shells
          </span>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Link
              href="/student/dashboard"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-slate-800">Student Portal</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </Link>
            <Link
              href="/mentor/dashboard"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-slate-800">Mentor Portal</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
