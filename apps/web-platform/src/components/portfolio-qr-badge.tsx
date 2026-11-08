'use client';

import { useMemo } from 'react';
import { ShieldCheck } from '@sparktrack/ui';

interface PortfolioQrBadgeProps {
  token: string;
  label?: string;
  subtitle?: string;
}

function isFinderCell(r: number, c: number, size: number): boolean {
  const inTopLeft = r < 7 && c < 7;
  const inTopRight = r < 7 && c >= size - 7;
  const inBottomLeft = r >= size - 7 && c < 7;
  return inTopLeft || inTopRight || inBottomLeft;
}

function finderBit(r: number, c: number, topR: number, leftC: number): boolean {
  const lr = r - topR;
  const lc = c - leftC;
  if (lr === 0 || lr === 6 || lc === 0 || lc === 6) return true;
  if (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4) return true;
  return false;
}

function buildMatrix(seedText: string): boolean[][] {
  const size = 21;
  const grid: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));

  // Draw standard 7x7 finder patterns in 3 corners
  const corners: Array<[number, number]> = [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ];
  for (const [tr, lc] of corners) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        grid[tr + r]![lc + c] = finderBit(tr + r, lc + c, tr, lc);
      }
    }
  }

  // Timing patterns on row 6 and col 6
  for (let i = 8; i < size - 8; i++) {
    grid[6]![i] = i % 2 === 0;
    grid[i]![6] = i % 2 === 0;
  }

  // Deterministic FNV-1a stream from token for data modules
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isFinderCell(r, c, size)) continue;
      if (r === 7 && (c < 8 || c >= size - 8)) continue;
      if (c === 7 && (r < 8 || r >= size - 8)) continue;
      if ((r === 8 && c < 8) || (c === 8 && r < 8)) continue;
      if (r === 6 || c === 6) continue;

      hash ^= (r * 31 + c * 17 + seedText.charCodeAt((r + c) % Math.max(1, seedText.length))) & 0xff;
      hash = Math.imul(hash, 16777619);
      grid[r]![c] = (Math.abs(hash) & 3) !== 0;
    }
  }

  return grid;
}

export function PortfolioQrBadge({
  token,
  label = 'Verified Portfolio Link',
  subtitle = 'Scan or visit link to verify live records',
}: PortfolioQrBadgeProps) {
  const cleanToken = token.trim() || 'spk-demo-chidi-okafor-2026';
  const matrix = useMemo(() => buildMatrix(cleanToken), [cleanToken]);

  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-slate-50/90 p-3 text-left">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xs">
        <svg
          viewBox="0 0 21 21"
          className="h-full w-full text-slate-900"
          role="img"
          aria-label={`Verification badge for ${cleanToken}`}
        >
          {matrix.map((row, r) =>
            row.map((cell, c) =>
              cell ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="currentColor" /> : null,
            ),
          )}
        </svg>
      </div>
      <div className="min-w-0 space-y-1">
        <div className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
          <ShieldCheck size={13} />
          <span>{label}</span>
        </div>
        <p className="truncate font-mono text-xs font-bold text-slate-900">/p/{cleanToken}</p>
        <p className="text-[11px] leading-snug text-slate-600">{subtitle}</p>
      </div>
    </div>
  );
}

