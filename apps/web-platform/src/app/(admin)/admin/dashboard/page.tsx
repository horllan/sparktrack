import { Card, CardContent, CardHeader, CardTitle } from '@sparktrack/ui';

export default function AdminDashboardPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">SparkTrack Operations &amp; Cohort Admin</h1>
        <div className="grid gap-6 md:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-base">Holiday &amp; Term Cohorts</CardTitle></CardHeader><CardContent className="text-sm text-slate-500">Manage cohorts, capacity, and pricing.</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Partner Organisations</CardTitle></CardHeader><CardContent className="text-sm text-slate-500">Manage schools, NGOs, and sponsors.</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Capability Graph</CardTitle></CardHeader><CardContent className="text-sm text-slate-500">Inspect skills, capabilities, and pathways.</CardContent></Card>
        </div>
      </div>
    </main>
  );
}

