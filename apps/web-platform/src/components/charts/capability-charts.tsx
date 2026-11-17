'use client';

import { useEffect, useId, useState } from 'react';
import { Badge } from '@sparktrack/ui';

export interface RadarItem {
  label: string;
  value: number; // 0 to 100
  meta?: string;
  detail?: string;
}

export interface DonutSegment {
  label: string;
  value: number;
  color?: string;
  hint?: string;
}

export interface TelemetryBarItem {
  label: string;
  value: number; // 0 to 100
  badge?: string;
  subtitle?: string;
  benchmark?: number;
}

export interface TrajectoryPoint {
  label: string;
  value: number; // 0 to 100
  detail?: string;
}

const PALETTE = [
  '#2563eb', // spark-500
  '#0891b2', // cyan-600
  '#7c3aed', // violet-600
  '#059669', // emerald-600
  '#d97706', // amber-600
  '#e11d48', // rose-600
];

function useMountReveal(delayMs = 40): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return ready;
}

export function CapabilityRadarChart({
  items,
  emptyText = 'Add or review a few projects to reveal the skill shape.',
}: {
  items: RadarItem[];
  emptyText?: string;
}) {
  const revealed = useMountReveal(60);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const displayItems = items.slice(0, 7);
  if (displayItems.length < 3) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-xs leading-relaxed text-slate-500">
        {emptyText}
      </div>
    );
  }

  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 88;
  const rings = [25, 50, 75, 100];
  const count = displayItems.length;

  const angleFor = (idx: number) => (Math.PI * 2 * idx) / count - Math.PI / 2;
  const pointFor = (idx: number, pct: number) => {
    const r = (Math.max(0, Math.min(100, pct)) / 100) * maxR * (revealed ? 1 : 0.08);
    const a = angleFor(idx);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };

  const polygonPoints = displayItems
    .map((item, idx) => {
      const pt = pointFor(idx, item.value);
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    })
    .join(' ');

  const activeItem = activeIndex !== null ? displayItems[activeIndex] : null;

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[260px_1fr]">
      <div className="relative mx-auto w-full max-w-[260px]">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full overflow-visible" role="img" aria-label="Skill capability radar chart">
          {rings.map((ring) => {
            const ringPts = displayItems
              .map((_, idx) => {
                const r = (ring / 100) * maxR;
                const a = angleFor(idx);
                return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
              })
              .join(' ');
            return (
              <polygon
                key={ring}
                points={ringPts}
                fill={ring === 100 ? 'rgba(241, 245, 249, 0.55)' : 'none'}
                stroke="#cbd5e1"
                strokeWidth={ring === 100 ? 1.2 : 0.8}
                strokeDasharray={ring === 100 ? undefined : '3 3'}
              />
            );
          })}

          {displayItems.map((item, idx) => {
            const a = angleFor(idx);
            const outerX = cx + maxR * Math.cos(a);
            const outerY = cy + maxR * Math.sin(a);
            const labelX = cx + (maxR + 20) * Math.cos(a);
            const labelY = cy + (maxR + 18) * Math.sin(a);
            const shortLabel = item.label.length > 14 ? `${item.label.slice(0, 12)}…` : item.label;
            return (
              <g key={item.label}>
                <line x1={cx} y1={cy} x2={outerX} y2={outerY} stroke="#e2e8f0" strokeWidth={1} />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor={Math.cos(a) > 0.25 ? 'start' : Math.cos(a) < -0.25 ? 'end' : 'middle'}
                  dominantBaseline="central"
                  className="fill-slate-600 text-[10px] font-semibold"
                >
                  {shortLabel}
                </text>
              </g>
            );
          })}

          <polygon
            points={polygonPoints}
            fill="rgba(37, 99, 235, 0.20)"
            stroke="#2563eb"
            strokeWidth={2.2}
            strokeLinejoin="round"
            className="transition-all duration-700 ease-out"
          />

          {displayItems.map((item, idx) => {
            const pt = pointFor(idx, item.value);
            const isActive = activeIndex === idx;
            return (
              <g
                key={item.label}
                className="cursor-pointer"
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
                onClick={() => setActiveIndex(activeIndex === idx ? null : idx)}
              >
                <circle cx={pt.x} cy={pt.y} r={12} fill="transparent" />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isActive ? 6 : 4}
                  fill={isActive ? '#1d4ed8' : '#ffffff'}
                  stroke="#2563eb"
                  strokeWidth={2.2}
                  className="transition-all duration-300"
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="space-y-2">
        {activeItem ? (
          <div className="rounded-xl border border-spark-200 bg-spark-50/80 p-3 text-xs transition-all">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-900">{activeItem.label}</span>
              <Badge variant="competent">{Math.round(activeItem.value)}%</Badge>
            </div>
            {(activeItem.meta || activeItem.detail) && (
              <p className="mt-1 leading-relaxed text-slate-600">
                {activeItem.meta ? `${activeItem.meta} • ` : ''}
                {activeItem.detail ?? 'Verified through project evidence'}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-slate-500">
            Hover or tap any point on the chart to inspect exact mastery and supporting evidence.
          </p>
        )}

        <div className="space-y-1.5">
          {displayItems.map((item, idx) => {
            const isActive = activeIndex === idx;
            return (
              <button
                key={item.label}
                type="button"
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
                onClick={() => setActiveIndex(activeIndex === idx ? null : idx)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                  isActive ? 'bg-spark-50 text-spark-900 ring-1 ring-spark-200' : 'hover:bg-slate-50'
                }`}
              >
                <span className="truncate pr-2 font-medium text-slate-800">{item.label}</span>
                <span className="shrink-0 font-bold text-slate-900">{Math.round(item.value)}%</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SignalDonutChart({
  segments,
  centerLabel,
  centerSublabel,
}: {
  segments: DonutSegment[];
  centerLabel: string;
  centerSublabel: string;
}) {
  const revealed = useMountReveal(80);
  const [hovered, setHovered] = useState<number | null>(null);

  const nonZero = segments.filter((s) => s.value > 0);
  const total = nonZero.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-xs text-slate-500">
        No activity recorded yet for this breakdown.
      </div>
    );
  }

  const size = 172;
  const cx = size / 2;
  const cy = size / 2;
  const r = 60;
  const circumference = 2 * Math.PI * r;

  let cumulative = 0;
  const arcs = nonZero.map((seg, idx) => {
    const share = seg.value / total;
    const length = share * circumference;
    const offset = -cumulative * circumference;
    cumulative += share;
    return {
      ...seg,
      idx,
      share,
      length,
      offset,
      color: seg.color ?? PALETTE[idx % PALETTE.length]!,
    };
  });

  const active = hovered !== null ? arcs[hovered] : null;

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[172px_1fr]">
      <div className="relative mx-auto h-[172px] w-[172px]">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" role="img" aria-label="Distribution donut chart">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef2f7" strokeWidth={18} />
          {arcs.map((arc) => {
            const isHovered = hovered === arc.idx;
            return (
              <circle
                key={arc.label}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={arc.color}
                strokeWidth={isHovered ? 22 : 18}
                strokeDasharray={`${revealed ? arc.length : 0} ${circumference}`}
                strokeDashoffset={arc.offset}
                strokeLinecap="butt"
                className="cursor-pointer transition-all duration-700 ease-out"
                onMouseEnter={() => setHovered(arc.idx)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setHovered(hovered === arc.idx ? null : arc.idx)}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
          <span className="text-xl font-extrabold tracking-tight text-slate-900">
            {active ? `${Math.round(active.share * 100)}%` : centerLabel}
          </span>
          <span className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-500">
            {active ? active.label : centerSublabel}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        {arcs.map((arc) => {
          const isHovered = hovered === arc.idx;
          return (
            <button
              key={arc.label}
              type="button"
              onMouseEnter={() => setHovered(arc.idx)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => setHovered(hovered === arc.idx ? null : arc.idx)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition ${
                isHovered ? 'bg-slate-100 ring-1 ring-slate-200' : 'hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-2 font-semibold text-slate-800">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: arc.color }} />
                <span>{arc.label}</span>
              </span>
              <span className="font-bold text-slate-900">
                {arc.value} <span className="font-normal text-slate-500">({Math.round(arc.share * 100)}%)</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AnimatedTelemetryBars({
  items,
  emptyText = 'No metrics available yet.',
}: {
  items: TelemetryBarItem[];
  emptyText?: string;
}) {
  const revealed = useMountReveal(80);
  const [hovered, setHovered] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-xs text-slate-500">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const pct = Math.max(0, Math.min(100, Math.round(item.value)));
        const isHovered = hovered === idx;
        return (
          <div
            key={item.label}
            onMouseEnter={() => setHovered(idx)}
            onMouseLeave={() => setHovered(null)}
            className={`rounded-xl border p-3 transition ${
              isHovered ? 'border-spark-300 bg-spark-50/40 shadow-2xs' : 'border-slate-200/80 bg-slate-50/50'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-bold text-slate-900">{item.label}</span>
                {item.subtitle && <p className="mt-0.5 text-[11px] text-slate-500">{item.subtitle}</p>}
              </div>
              <div className="flex items-center gap-2">
                {item.badge && <Badge variant="outline">{item.badge}</Badge>}
                <span className="font-extrabold text-slate-900">{pct}%</span>
              </div>
            </div>
            <div className="relative mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-200/75">
              <div
                className="h-full rounded-full bg-gradient-to-r from-spark-600 via-spark-500 to-cyan-500 transition-all duration-700 ease-out"
                style={{ width: revealed ? `${pct}%` : '0%' }}
              />
              {item.benchmark !== undefined && (
                <div
                  title={`Target benchmark: ${item.benchmark}%`}
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-800/70"
                  style={{ left: `${Math.min(100, Math.max(0, item.benchmark))}%` }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GrowthTrajectoryAreaChart({
  points,
  emptyText = 'Record at least two milestones to plot growth over time.',
}: {
  points: TrajectoryPoint[];
  emptyText?: string;
}) {
  const gradId = useId();
  const revealed = useMountReveal(100);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-xs text-slate-500">
        {emptyText}
      </div>
    );
  }

  const width = 460;
  const height = 160;
  const padX = 24;
  const padY = 20;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const coords = points.map((pt, idx) => {
    const x = padX + (idx / (points.length - 1)) * plotW;
    const clamped = Math.max(0, Math.min(100, pt.value));
    const y = padY + plotH - (clamped / 100) * plotH;
    return { ...pt, x, y, clamped };
  });

  const linePath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1]!.x.toFixed(1)} ${(padY + plotH).toFixed(1)} L ${coords[0]!.x.toFixed(1)} ${(padY + plotH).toFixed(1)} Z`;

  const delta = Math.round(coords[coords.length - 1]!.clamped - coords[0]!.clamped);
  const active =
    (activeIdx !== null ? coords[activeIdx] : undefined) ?? coords[coords.length - 1]!;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div>
          <span className="font-bold text-slate-900">{active.label}</span>
          {active.detail && <span className="ml-2 text-slate-500">• {active.detail}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={delta >= 0 ? 'success' : 'outline'}>
            {delta >= 0 ? `+${delta}% progression` : `${delta}% change`}
          </Badge>
          <span className="font-extrabold text-spark-700">{Math.round(active.clamped)}%</span>
        </div>
      </div>

      <div className="w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/50 p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Growth trajectory chart">
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {[25, 50, 75].map((tick) => {
            const y = padY + plotH - (tick / 100) * plotH;
            return (
              <line
                key={tick}
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            );
          })}

          <path
            d={areaPath}
            fill={`url(#${gradId})`}
            className="transition-opacity duration-700"
            style={{ opacity: revealed ? 1 : 0 }}
          />
          <path
            d={linePath}
            fill="none"
            stroke="#2563eb"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-opacity duration-700"
            style={{ opacity: revealed ? 1 : 0 }}
          />

          {coords.map((c, idx) => {
            const isSelected = activeIdx === idx;
            return (
              <g
                key={`${c.label}-${idx}`}
                className="cursor-pointer"
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(null)}
                onClick={() => setActiveIdx(activeIdx === idx ? null : idx)}
              >
                <circle cx={c.x} cy={c.y} r={14} fill="transparent" />
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isSelected ? 6 : 4}
                  fill={isSelected ? '#1d4ed8' : '#ffffff'}
                  stroke="#2563eb"
                  strokeWidth={2.2}
                  className="transition-all duration-200"
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
