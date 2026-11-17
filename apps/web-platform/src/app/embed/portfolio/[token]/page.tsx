'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, ShieldCheck } from '@sparktrack/ui';
import { DEMO_CASE_STUDIES, computeDemoState } from '../../../../lib/demo-case-studies';
import { PortfolioQrBadge } from '../../../../components/portfolio-qr-badge';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

interface EmbedPortfolioData {
  profile: {
    displayName: string;
    educationStage: string;
    schoolName: string | null;
    declaredInterests: string[];
  };
  skills: Array<{
    node_code: string;
    node_name: string;
    score: number;
    progression: string;
    evidence_count: number;
  }>;
  artifactsCount: number;
}

export default function EmbedPortfolioWidgetPage() {
  const params = useParams<{ token: string }>();
  const token = decodeURIComponent(params.token ?? '');
  const [data, setData] = useState<EmbedPortfolioData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/v1/learning/portfolio/shared/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Portfolio unavailable or private');
        const body = (await res.json()) as {
          profile: EmbedPortfolioData['profile'];
          skills: EmbedPortfolioData['skills'];
          artifacts: unknown[];
        };
        setData({
          profile: body.profile,
          skills: body.skills ?? [],
          artifactsCount: body.artifacts?.length ?? 0,
        });
      })
      .catch(() => {
        const cs = DEMO_CASE_STUDIES.find(
          (c) => c.shareToken.toLowerCase() === token.trim().toLowerCase(),
        );
        if (!cs) {
          setError('Verified portfolio is private or link has been revoked.');
          return;
        }
        const computed = computeDemoState(
          cs,
          cs.defaultOnboardingYear,
          cs.trainings.map((t) => t.id),
        );
        const firstName = cs.fullName.trim().split(/\s+/)[0] ?? 'Explorer';
        setData({
          profile: {
            displayName: `${firstName} (${cs.educationStage})`,
            educationStage: cs.educationStage,
            schoolName: cs.organisationName,
            declaredInterests: cs.declaredInterests,
          },
          skills: computed.skillScores.map((s) => ({
            node_code: s.code,
            node_name: s.name,
            score: s.score,
            progression: s.progression,
            evidence_count: s.evidenceCount,
          })),
          artifactsCount: computed.activeProjects.length,
        });
      });
  }, [token]);

  if (error) {
    return (
      <div className="p-4">
        <Card className="border-amber-200 bg-amber-50/70">
          <CardContent className="p-4 text-xs font-medium text-amber-900">{error}</CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-xs text-slate-500">Loading verified SparkTrack skill card…</div>
    );
  }

  return (
    <div className="p-3 sm:p-4">
      <Card className="mx-auto max-w-2xl border-slate-200/90 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>SparkTrack Verified Skills</span>
              </div>
              <CardTitle className="mt-2 text-lg">{data.profile.displayName}</CardTitle>
              <CardDescription className="text-xs">
                {data.profile.schoolName ?? 'SparkTrack Partner Network'} • {data.artifactsCount} sealed projects
              </CardDescription>
            </div>
            <PortfolioQrBadge token={token} />
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5 pt-0">
          {data.skills.slice(0, 5).map((s) => (
            <div key={s.node_code} className="space-y-1 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-800">{s.node_name}</span>
                <Badge variant="secondary">
                  {s.progression} ({Math.round(s.score * 100)}%)
                </Badge>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-spark-600"
                  style={{ width: `${Math.min(100, Math.round(s.score * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

