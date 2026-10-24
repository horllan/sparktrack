import Link from 'next/link';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@sparktrack/ui';

const DEMO_EXPLORER_ID = '11111111-1111-4111-8111-111111111113';

const PORTALS = [
  {
    title: '1. Learner Onboarding & Guardian Trigger',
    description: 'Create a student account, declare initial interests, and dispatch the guardian SMS OTP consent challenge.',
    href: '/student/onboarding',
    badge: 'NDPA Gate',
  },
  {
    title: '2. Guardian Verifiable SMS Consent',
    description: 'Verify the 6-digit OTP and configure granular public portfolio & partner talent discovery permissions.',
    href: '/parent/consent',
    badge: 'Parent OTP',
  },
  {
    title: '3. Offline-First Student Workspace',
    description: 'Queue project artifacts in IndexedDB (Dexie), seal SHA-256 ledger blocks, and explore career pathways.',
    href: '/student/dashboard',
    badge: 'Offline PWA',
  },
  {
    title: '4. Verifiable Capability Portfolio',
    description: 'Inspect the NDPA-gated public portfolio and SHA-256 ledger receipts for the 13-year-old Explorer demo.',
    href: `/student/portfolio?learnerId=${DEMO_EXPLORER_ID}`,
    badge: 'SHA-256 Proof',
  },
  {
    title: '5. Mentor 3-Minute Micro-Rubric',
    description: 'Review pending learner artifacts and record 7 evolving developmental signals offline or online.',
    href: '/mentor/dashboard',
    badge: 'Mentor Queue',
  },
  {
    title: '6. Parent 13-Part Development Report',
    description: 'Generate guardrail-verified exploratory reports and compare bitemporal skill progression over time.',
    href: `/parent/dashboard?learnerId=${DEMO_EXPLORER_ID}`,
    badge: 'Bitemporal AI',
  },
  {
    title: '7. Partner School & Talent Analytics',
    description: 'View cohort capability progression, cryptographic ledger audit status, and opt-in talent discovery.',
    href: '/school/dashboard',
    badge: 'Institution',
  },
  {
    title: '8. Operations, Cohort & Billing Admin',
    description: 'Launch holiday camps, enrol scholarship/Paystack/Stripe learners, and assign mentors to cohorts.',
    href: '/admin/dashboard',
    badge: 'Ops & Billing',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-spark-50 to-slate-50 px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="space-y-4 text-center">
          <Badge variant="competent">SparkTrack v2.0 • Youth Capability &amp; Career Exploration Platform</Badge>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Discover, Develop &amp; Demonstrate Potential
          </h1>
          <p className="mx-auto max-w-2xl text-base text-slate-600">
            Cryptographically sealed evidence ledger, bitemporal capability progression, and child-safe career exploration
            built for schools, holiday camps, mentors, and families.
          </p>
          <div className="mx-auto inline-flex flex-wrap items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 shadow-sm">
            <span>Seeded 13yo Explorer Demo Learner UUID:</span>
            <code className="rounded bg-slate-100 px-2 py-0.5 font-mono font-semibold text-slate-900">
              {DEMO_EXPLORER_ID}
            </code>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PORTALS.map((portal) => (
            <Card key={portal.href} className="flex flex-col justify-between transition hover:shadow-md">
              <CardHeader>
                <div className="mb-2 flex items-center justify-between">
                  <Badge variant="outline">{portal.badge}</Badge>
                </div>
                <CardTitle className="text-base">{portal.title}</CardTitle>
                <CardDescription className="text-xs leading-relaxed">{portal.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={portal.href}>
                  <Button variant="outline" className="w-full">
                    Open Portal →
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
