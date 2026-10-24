import { Card, CardContent, CardHeader, CardTitle } from '@sparktrack/ui';

export default function SchoolDashboardPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Partner School Analytics Portal</h1>
        <Card>
          <CardHeader><CardTitle className="text-base">Cohort Capability &amp; Pathway Analytics</CardTitle></CardHeader>
          <CardContent className="text-sm text-slate-600">
            Aggregate cohort capability progression and co-curricular exploration insights.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

