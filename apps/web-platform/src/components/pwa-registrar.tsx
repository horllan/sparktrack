'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { SyncEngine, db } from '@sparktrack/offline-sync';
import { createClient } from '../lib/supabase/client';
import {
  WifiOff,
  RefreshCw,
  CheckCircle2,
  X,
  Sparkles,
} from '@sparktrack/ui';

export function PwaRegistrar() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);

  const engineRef = useRef<SyncEngine | null>(null);

  // Initialize SyncEngine once on client
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

    const getAccessToken = async (): Promise<string | null> => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? null;
      } catch {
        return null;
      }
    };

    engineRef.current = new SyncEngine({
      apiBaseUrl,
      getAccessToken,
      db,
    });
  }, []);

  // Check pending count in IndexedDB
  const refreshPendingCount = useCallback(async () => {
    try {
      const artifacts = await db.pendingArtifacts.where('syncStatus').equals('pending').count();
      const rubrics = await db.pendingRubrics.where('syncStatus').equals('pending').count();
      setPendingCount(artifacts + rubrics);
    } catch {
      // IndexedDB might not be supported or initialized yet
    }
  }, []);

  // Trigger sync run
  const triggerSync = useCallback(async () => {
    if (!engineRef.current || !navigator.onLine) return;
    setIsSyncing(true);
    setSyncFeedback(null);

    try {
      const result = await engineRef.current.syncAll();
      await refreshPendingCount();

      if (result.syncedCount > 0) {
        setSyncFeedback(`Successfully synchronized ${result.syncedCount} offline record${result.syncedCount > 1 ? 's' : ''}`);
        setTimeout(() => setSyncFeedback(null), 5000);
      } else if (result.failedCount > 0) {
        setSyncFeedback(`Sync encountered ${result.failedCount} temporary issue${result.failedCount > 1 ? 's' : ''}. Will retry automatically.`);
        setTimeout(() => setSyncFeedback(null), 6000);
      }
    } catch (err) {
      console.warn('[OfflineSync] Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [refreshPendingCount]);

  // Service Worker Registration & Online/Offline listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);
    void refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      void refreshPendingCount();
      void triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setDismissed(false);
      void refreshPendingCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setUpdateAvailable(true);
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    }

    // Interval check for pending items every 30 seconds
    const interval = setInterval(() => {
      void refreshPendingCount();
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [refreshPendingCount, triggerSync]);

  const handleUpdateReload = () => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  if (dismissed && isOnline && !syncFeedback && !updateAvailable) {
    return null;
  }

  return (
    <aside aria-label="Connectivity and sync status">
      {/* 1. Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-600 text-white text-xs md:text-sm font-medium px-4 py-2 flex items-center justify-between gap-3 shadow-md transition-all">
          <div className="flex items-center gap-2 max-w-4xl mx-auto flex-1">
            <WifiOff className="w-4 h-4 shrink-0 text-amber-200" />
            <span>
              <strong>Offline Mode Active</strong> — Working in low-bandwidth cache. Evidence and rubric submissions are saved securely to your device and will sync when reconnected.
            </span>
          </div>
          {pendingCount > 0 && (
            <span className="bg-amber-700 text-amber-100 text-xs px-2.5 py-0.5 rounded-full whitespace-nowrap">
              {pendingCount} queued
            </span>
          )}
        </div>
      )}

      {/* 2. Syncing In Progress Banner */}
      {isOnline && isSyncing && (
        <div className="bg-blue-600 text-white text-xs md:text-sm font-medium px-4 py-2 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2 max-w-4xl mx-auto flex-1">
            <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-blue-200" />
            <span>
              Syncing offline evidence and rubrics to SparkTrack cloud ledger...
            </span>
          </div>
        </div>
      )}

      {/* 3. Sync Completion / Feedback Pill */}
      {isOnline && !isSyncing && syncFeedback && (
        <div className="bg-emerald-700 text-white text-xs md:text-sm font-medium px-4 py-2 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2 max-w-4xl mx-auto flex-1">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-200" />
            <span>{syncFeedback}</span>
          </div>
          <button
            onClick={() => setSyncFeedback(null)}
            className="text-emerald-200 hover:text-white transition-colors cursor-pointer"
            aria-label="Dismiss sync notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4. Service Worker Update Available Pill */}
      {updateAvailable && (
        <div className="bg-slate-900 text-white text-xs md:text-sm px-4 py-2.5 flex items-center justify-between gap-3 border-b border-slate-700">
          <div className="flex items-center gap-2 max-w-4xl mx-auto flex-1">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>A new version of SparkTrack is ready.</span>
            <button
              onClick={handleUpdateReload}
              className="ml-2 underline font-semibold text-amber-400 hover:text-amber-300 cursor-pointer"
            >
              Update now
            </button>
          </div>
          <button
            onClick={() => setUpdateAvailable(false)}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Dismiss update notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </aside>
  );
}
