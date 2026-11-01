'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
  HeartHandshake,
  Scale,
  ShieldCheck,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@sparktrack/ui';

type LegalDocId = 'privacy' | 'terms' | 'child-safety' | 'ai-charter' | 'dpa' | 'ledger-governance';

interface LegalDocument {
  id: LegalDocId;
  title: string;
  shortLabel: string;
  subtitle: string;
  effectiveDate: string;
  jurisdictions: string[];
  sections: Array<{
    heading: string;
    body: string;
    bullets?: string[];
  }>;
}

const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    id: 'privacy',
    shortLabel: '1. Privacy Policy',
    title: 'Privacy Policy',
    subtitle:
      'How SparkTrack collects, protects, and uses personal information for learners, families, and schools.',
    effectiveDate: 'October 25, 2026',
    jurisdictions: [
      'Nigeria NDPA 2023',
      'African Data Protection Standards',
      'GDPR & Children’s Privacy',
    ],
    sections: [
      {
        heading: '1.1 Who We Serve & Our Privacy Commitment',
        body: 'SparkTrack helps learners build practical skills and project portfolios from secondary school (JSS1 and above) through university, NYSC, and career transitions. Because many of our users are under 18, we apply strict child-privacy safeguards by default.',
        bullets: [
          'Nigeria: Designed in line with the Nigeria Data Protection Act (NDPA) 2023 and the Child’s Rights Act 2003.',
          'Africa & International: Aligned with regional and international child data protection standards, including POPIA, Kenya DPA, GDPR, and COPPA.',
        ],
      },
      {
        heading: '1.2 Information We Collect',
        body: 'We collect only the information needed to run your account, record learning projects, and prepare progress reports:',
        bullets: [
          'Parent, Mentor & School Accounts: Name, email address, phone number, role, and school or organisation name.',
          'Learner Profiles: Name, learning stage, goals, and chosen interests. Date of birth and parent contact details are required for learners under 18.',
          'Communication Preferences: Adults and verified parents can choose whether to receive optional learning reminders on WhatsApp.',
          'Projects & Mentor Feedback: Project titles, descriptions, links, attached files, skills practiced, and mentor review notes.',
          'No Advertising Profiles: We never sell learner data or use student information for targeted advertising.',
        ],
      },
      {
        heading: '1.3 Parent Approval for Learners Under 18',
        body: 'Every profile for a learner under 18 starts as private by default. No project work is shared publicly unless a verified parent or legal guardian approves the profile and explicitly turns on portfolio sharing.',
      },
      {
        heading: '1.4 Your Privacy Rights',
        body: 'Parents, guardians, adult learners, and schools can exercise these rights at any time:',
        bullets: [
          'View Your Data: Access all saved projects, skill scores, and progress reports from your dashboard.',
          'Change Sharing Settings: Turn public portfolio sharing or partner discovery on or off at any time in the Family Hub.',
          'Request Account Deletion: Contact our Privacy Team to delete personal profile details and uploaded files within 72 hours.',
        ],
      },
    ],
  },
  {
    id: 'terms',
    shortLabel: '2. Terms of Service',
    title: 'Terms of Service & Acceptable Use',
    subtitle: 'Guidelines for parents, schools, partner organisations, mentors, and learners.',
    effectiveDate: 'October 25, 2026',
    jurisdictions: ['Consumer Protection Standards', 'Educational Service Terms'],
    sections: [
      {
        heading: '2.1 Account Roles & Eligibility',
        body: 'Each workspace on SparkTrack is designed for a specific role:',
        bullets: [
          'Learners Under 18: Must link a parent or guardian to approve their profile before project records are shared.',
          'Parents & Legal Guardians: Confirm they have parental responsibility for any child they register or approve.',
          'Schools & Partner Organisations: Confirm they have authority to register students and provide accurate parent contact details.',
          'Mentors & Educators: Agree to provide fair, constructive, and respectful project reviews.',
        ],
      },
      {
        heading: '2.2 Ownership of Student Work',
        body: 'Learners and their families keep 100% ownership of all projects, code, designs, essays, videos, and business ideas uploaded to SparkTrack. We only store and display your work to your approved mentors, family members, and any public portfolio view you choose to enable.',
      },
      {
        heading: '2.3 Programme Enrolments, Scholarships & Refunds',
        body: 'SparkTrack supports free school programmes, sponsored scholarships, and paid training cohorts:',
        bullets: [
          'Clear Confirmation: Paid cohort seats are activated as soon as payment is confirmed.',
          '14-Day Refund Policy: Families may request a full refund within 14 days of enrolling in a paid cohort before the programme ends.',
          'Scholarship Seats: Learners on sponsored scholarships are never charged fees.',
        ],
      },
      {
        heading: '2.4 Acceptable Use',
        body: 'Users agree to upload only their own honest work, treat learners and mentors with respect, and never attempt to access another person’s account.',
      },
    ],
  },
  {
    id: 'child-safety',
    shortLabel: '3. Child Safety Policy',
    title: 'Child Safety & Parent Consent Policy',
    subtitle: 'How we protect learners under 18 across every workspace.',
    effectiveDate: 'October 25, 2026',
    jurisdictions: ['Child’s Rights Act', 'Age-Appropriate Design Standards'],
    sections: [
      {
        heading: '3.1 Private by Default',
        body: 'No child’s profile is ever public by default. When a new profile is created for a learner under 18:',
        bullets: [
          'Parent consent is required before full portfolio sharing is enabled.',
          'Public portfolio visibility is turned off by default.',
          'Partner talent discovery is turned off by default.',
        ],
      },
      {
        heading: '3.2 Minimal Information on Public Portfolios',
        body: 'If a parent chooses to share their child’s portfolio publicly:',
        bullets: [
          'Only the learner’s display name, class stage, skills, and verified projects are shown—never their home address, phone number, email, or date of birth.',
          'Parents can turn off public sharing at any time with immediate effect.',
        ],
      },
      {
        heading: '3.3 Safe Mentor Reviews',
        body: 'SparkTrack does not allow private 1-on-1 messaging between adults and minors. Mentors interact only through structured project feedback that is visible to the learner’s parent and school.',
      },
    ],
  },
  {
    id: 'ai-charter',
    shortLabel: '4. Guidance Principles',
    title: 'Fair Guidance & Reporting Principles',
    subtitle: 'Why our progress reports focus on exploration and growth rather than fixed labels.',
    effectiveDate: 'October 25, 2026',
    jurisdictions: ['Responsible Educational Guidance', 'Child-Friendly Reporting'],
    sections: [
      {
        heading: '4.1 Exploration Over Fixed Labels',
        body: 'Young learners are still discovering what they enjoy and do well. SparkTrack treats every skill score and career suggestion as a starting point for exploration—never a fixed prediction of what someone can or cannot become.',
      },
      {
        heading: '4.2 Encouraging, Growth-Focused Language',
        body: 'Every 13-part progress report is checked before it is shown to a learner or family:',
        bullets: [
          'No Limiting Labels: Reports never tell a learner they are only suited for one path.',
          'Practical Next Steps: Suggestions focus on skills to practice and projects to try next.',
        ],
      },
      {
        heading: '4.3 Grounded in Real Human Feedback',
        body: 'Skill progress is based on real projects reviewed by teachers and mentors—not automated guessing. Personal contact details are never shared with external services.',
      },
    ],
  },
  {
    id: 'dpa',
    shortLabel: '5. School Data Agreement',
    title: 'Data Protection Agreement for Schools & Partners',
    subtitle: 'How we handle student data on behalf of partner schools, foundations, and youth programmes.',
    effectiveDate: 'October 25, 2026',
    jurisdictions: ['NDPA 2023', 'Institutional Data Protection'],
    sections: [
      {
        heading: '5.1 School & Platform Responsibilities',
        body: 'When a school or youth organisation uses SparkTrack to run student cohorts:',
        bullets: [
          'SparkTrack processes student records only to deliver the learning programme and progress reports.',
          'Strict access controls ensure school staff and mentors can only view learners enrolled in their own institution or cohort.',
        ],
      },
      {
        heading: '5.2 Security Protections',
        body: 'We protect school and family records at every layer:',
        bullets: [
          'Encrypted Connections & Storage: All data is encrypted in transit and at rest.',
          'Tamper-Evident Records: Verified project records are protected against unauthorized edits.',
          'Role-Based Access: Every workspace requires sign-in and role verification.',
        ],
      },
      {
        heading: '5.3 Incident Notification',
        body: 'If a security incident ever affects school or family data, SparkTrack notifies the partner institution and relevant authorities within 72 hours.',
      },
    ],
  },
  {
    id: 'ledger-governance',
    shortLabel: '6. Data Deletion & Records',
    title: 'Portfolio Verification & Account Deletion',
    subtitle: 'How we verify authentic student work while respecting your right to delete personal data.',
    effectiveDate: 'October 25, 2026',
    jurisdictions: ['Right to Erasure', 'Privacy by Design'],
    sections: [
      {
        heading: '6.1 Keeping Project Proof Authentic',
        body: 'When a learner completes a project and a mentor reviews it, SparkTrack creates a digital verification stamp so schools, employers, or scholarship boards can confirm the work is genuine.',
      },
      {
        heading: '6.2 How Account Deletion Works',
        body: 'We keep personal identity details separate from verification stamps so you always stay in control of your data:',
        bullets: [
          'No Personal Details in Verification Stamps: Verification stamps never contain names, emails, phone numbers, or project files.',
          'Complete Removal on Request: When a parent or adult learner requests account deletion, we remove their personal profile details and uploaded files.',
        ],
      },
    ],
  },
];

function LegalCenterContent() {
  const searchParams = useSearchParams();
  const [activeDocId, setActiveDocId] = useState<LegalDocId>('privacy');

  useEffect(() => {
    const param = searchParams.get('doc') as LegalDocId | null;
    if (param && LEGAL_DOCUMENTS.some((d) => d.id === param)) {
      setActiveDocId(param);
    }
  }, [searchParams]);

  const activeDoc = LEGAL_DOCUMENTS.find((d) => d.id === activeDocId) ?? LEGAL_DOCUMENTS[0]!;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-7">
        {/* Hero Banner */}
        <div className="spark-enter rounded-3xl border border-slate-200/80 bg-[#0e1b38] p-6 text-white shadow-xl sm:p-10">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-300">
                <Scale className="h-3.5 w-3.5" />
                <span>Privacy, Safety &amp; Terms</span>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">
                Clear rules that protect every learner.
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-blue-100/85">
                Read how we protect student privacy, support parent consent, and partner with schools across Nigeria and
                internationally.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row lg:flex-col">
              <Link href="/contact?category=PRIVACY_DPO_REQUEST">
                <Button className="w-full bg-cyan-300 text-[#0e1b38] hover:bg-cyan-200">
                  <ShieldCheck className="mr-1.5 h-4 w-4" /> Contact Privacy Team
                </Button>
              </Link>
              <Link href="/parent/consent">
                <Button
                  variant="outline"
                  className="w-full border-white/25 bg-white/10 text-white hover:bg-white/20"
                >
                  <HeartHandshake className="mr-1.5 h-4 w-4" /> Parent SMS Code
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Document Navigation Tabs */}
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/90 bg-white p-2 shadow-sm">
          {LEGAL_DOCUMENTS.map((doc) => {
            const active = doc.id === activeDoc.id;
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => setActiveDocId(doc.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold transition sm:text-sm ${
                  active
                    ? 'bg-spark-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span>{doc.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Active Legal Document Reader */}
        <Card className="border-slate-200/90 shadow-md">
          <CardHeader className="border-b border-slate-100 pb-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="default">Effective Date: {activeDoc.effectiveDate}</Badge>
              <div className="flex flex-wrap gap-1.5">
                {activeDoc.jurisdictions.map((j) => (
                  <Badge key={j} variant="outline">
                    {j}
                  </Badge>
                ))}
              </div>
            </div>
            <CardTitle className="mt-3 text-xl sm:text-2xl">{activeDoc.title}</CardTitle>
            <CardDescription className="text-sm">{activeDoc.subtitle}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            {activeDoc.sections.map((sec) => (
              <section
                key={sec.heading}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 sm:p-6"
              >
                <h2 className="text-base font-extrabold text-slate-900 sm:text-lg">{sec.heading}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-700">{sec.body}</p>
                {sec.bullets && (
                  <ul className="mt-3.5 space-y-2">
                    {sec.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-sm leading-6 text-slate-700">
                        <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-spark-600" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

            {/* Bottom Action Strip */}
            <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-spark-200 bg-spark-50/70 p-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Need a signed Institutional DPA or have a Data Subject / NDPA inquiry?
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Our Data Protection Officer (DPO) and School Partnerships team respond within 24–72 hours.
                </p>
              </div>
              <div className="flex w-full flex-wrap gap-2.5 sm:w-auto">
                <Link href="/contact?category=PRIVACY_DPO_REQUEST" className="flex-1 sm:flex-none">
                  <Button size="sm" className="w-full">
                    Submit DPO / Privacy Request <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Link href="/contact?category=SCHOOL_PARTNERSHIP" className="flex-1 sm:flex-none">
                  <Button size="sm" variant="outline" className="w-full bg-white">
                    <Building2 className="mr-1.5 h-3.5 w-3.5" /> Request School DPA
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function LegalPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Loading Legal &amp; Trust Center…</div>}>
      <LegalCenterContent />
    </Suspense>
  );
}

