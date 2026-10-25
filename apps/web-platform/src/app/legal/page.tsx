'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
  Globe,
  HeartHandshake,
  Lock,
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
    title: 'Global & Regional Privacy Policy (NDPA 2023 • POPIA • GDPR • COPPA)',
    subtitle:
      'How SparkTrack collects, protects, and processes personal data across Nigeria, Africa, and international jurisdictions.',
    effectiveDate: 'October 25, 2026',
    jurisdictions: [
      'Nigeria NDPA 2023 & NDPC GAID',
      'South Africa POPIA & Kenya DPA',
      'EU / UK GDPR (Art. 8)',
      'US COPPA & FERPA',
    ],
    sections: [
      {
        heading: '1.1 Scope & Multi-Jurisdictional Commitment',
        body: 'SparkTrack Intelligence ("SparkTrack", "we", "our") operates a Longitudinal Youth Capability & Future Pathways Intelligence Platform designed first for Nigeria, scaling across Africa and globally. Because our platform serves Junior and Senior Secondary learners (ages 10–18) alongside parents, mentors, and schools, we apply the strictest child-data protection standard across all operating jurisdictions.',
        bullets: [
          'Nigeria: Full compliance with the Nigeria Data Protection Act (NDPA) 2023 (Sections 24–38, Section 31 on Children, Sections 41–43 on Cross-Border Transfers) and the Child’s Rights Act (CRA) 2003.',
          'Pan-Africa: Aligned with the AU Malabo Convention, South Africa POPIA (Sections 34–35 requiring prior consent of a competent person), Kenya Data Protection Act 2019 (Section 33), Ghana Act 843, and Rwanda Law No. 058/2021.',
          'International: Compliant with EU/UK GDPR (Article 8 & UK Age-Appropriate Design Code / Children’s Code) and US COPPA / FERPA.',
        ],
      },
      {
        heading: '1.2 Categories of Personal Data We Collect',
        body: 'We adhere strictly to data minimization—collecting only what is required to verify guardian consent, record learning projects, and synthesize longitudinal skill reports:',
        bullets: [
          'Parent / Guardian & Institutional Account Data: Full name, email address, phone number (for SMS OTP verification), role, and school/organisation affiliation.',
          'Learner Profile Data: Full name, date of birth, education stage (e.g., Primary 5–6, JSS1–SS3), school affiliation, and self-declared curiosity areas.',
          'Learning Evidence & Mentor Signals: Project titles, descriptions, external links, uploaded media keys, self-tagged skills, mentor rubric quality scores, and 1–4 behavioural signal observations.',
          'Zero Behavioural Advertising: SparkTrack never sells student data, never builds advertising profiles on minors, and disables camera, microphone, and geolocation tracking by default via HTTP Permissions-Policy headers.',
        ],
      },
      {
        heading: '1.3 Lawful Basis & Verifiable Parental Consent',
        body: 'For any minor learner profile, processing of learning evidence is gated by Verifiable Parental/Guardian Consent (NDPA Section 31; GDPR Article 8; POPIA Section 35; COPPA). Every new learner profile defaults to PENDING_PARENTAL_CONSENT with all external sharing flags set to FALSE until a verified parent/guardian activates consent via our 6-digit HMAC-SHA256 SMS OTP challenge or direct Parent Hub registration.',
      },
      {
        heading: '1.4 Data Subject Rights & How to Exercise Them',
        body: 'Parents, guardians, learners, and institutional controllers have the right to:',
        bullets: [
          'Right to Access & Data Portability: Inspect all recorded artifacts, bitemporal skill scores, and 13-part development reports in real time.',
          'Right to Withdraw Consent Instantly: Toggle off public portfolio visibility, disable partner talent discovery, or revoke consent entirely (ConsentStatus = REVOKED) in one click inside the Parent Hub (/parent/dashboard).',
          'Right to Rectification & Erasure ("Right to be Forgotten"): Submit a DPO request via /contact?category=PRIVACY_DPO_REQUEST to scrub personal identifiers from core.users and core.learner_profiles within 72 hours.',
        ],
      },
    ],
  },
  {
    id: 'terms',
    shortLabel: '2. Terms of Service',
    title: 'Terms of Service, Role Obligations & Acceptable Use Policy',
    subtitle: 'Governing agreement for Parents/Guardians, Schools, Partner Organisations, Mentors, and Learners.',
    effectiveDate: 'October 25, 2026',
    jurisdictions: ['Nigeria FCCPC & Contract Law', 'Pan-African Commercial Standards', 'Global SaaS Terms'],
    sections: [
      {
        heading: '2.1 Account Registration & Role Eligibility',
        body: 'SparkTrack provides role-specific workspaces governed by strict access controls:',
        bullets: [
          'Junior & Senior Secondary Students (JSS1–SS3): Must be registered by a Parent/Legal Guardian (/auth?role=PARENT) or an authorised School/Organisation (/auth?role=SCHOOL_ADMIN), or complete Guardian SMS OTP verification before syncing evidence.',
          'Parents & Legal Guardians: Warrant that they hold legal parental responsibility for any minor they register or approve.',
          'Schools, NGOs & Training Partners: Warrant that they have institutional authority to onboard students and provide accurate parent/guardian contact details for NDPA consent.',
          'Mentors & Educators: Must adhere to the SparkTrack Mentor Safeguarding Code of Conduct and provide objective, constructive rubric verification.',
        ],
      },
      {
        heading: '2.2 Intellectual Property Ownership of Student Projects',
        body: 'Learners and their families retain 100% copyright and intellectual property ownership over all projects, source code, robotics designs, essays, videos, and business concepts submitted to SparkTrack. By submitting an artifact, you grant SparkTrack a non-exclusive, revocable license solely to store, cryptographically seal, display to authorised mentors/family members, and compute capability progression.',
      },
      {
        heading: '2.3 Programme Cohort Billing, Scholarships & Refunds',
        body: 'SparkTrack supports Free Pilots, Sponsored Scholarships, Paystack (NGN), and Stripe (USD/Global) for Holiday Camps, School Term Co-Curricular cohorts, and Weekend Workshops:',
        bullets: [
          'Webhook-Verified Activation: Paid enrolments transition from PENDING_PAYMENT to ACTIVE automatically upon cryptographic webhook verification.',
          '14-Day Refund Guarantee: In accordance with the Nigerian Federal Competition and Consumer Protection Act (FCCPC) and international consumer standards, families may request a full refund within 14 days of cohort enrolment prior to programme completion.',
          'Scholarship Protection: Learners on Sponsored Scholarships are never charged fees or asked for payment credentials.',
        ],
      },
      {
        heading: '2.4 Acceptable Use & Platform Integrity',
        body: 'Users must not upload unlawful, plagiarized, or harmful content; attempt to bypass role-based access guards; or attempt to alter records in the append-only cryptographic evidence ledger.',
      },
    ],
  },
  {
    id: 'child-safety',
    shortLabel: '3. Child Safety Charter',
    title: 'Child Protection, Safeguarding & Guardian Consent Policy',
    subtitle:
      'Built on the Nigerian Child’s Rights Act 2003, the African Charter on the Rights and Welfare of the Child (ACRWC), and the UK Children’s Code.',
    effectiveDate: 'October 25, 2026',
    jurisdictions: ['Child’s Rights Act 2003 (Nigeria)', 'AU ACRWC', 'UK Children’s Code', 'UNICEF Child Safeguarding'],
    sections: [
      {
        heading: '3.1 Privacy-by-Default for Every Minor',
        body: 'No minor profile on SparkTrack is ever publicly visible by default. At database creation, every learner record enforces three mandatory locks:',
        bullets: [
          'consent_status = PENDING_PARENTAL_CONSENT (blocks evidence ingestion until guardian verification)',
          'allow_public_portfolio = FALSE (blocks public portfolio access at /v1/learning/portfolio/:learnerId)',
          'allow_partner_talent_discovery = FALSE (excludes the minor from institutional talent discovery pools)',
        ],
      },
      {
        heading: '3.2 Data Minimization in Public & Partner Views',
        body: 'Even when a verified parent/guardian explicitly enables Public Portfolio Sharing or Partner Talent Discovery:',
        bullets: [
          'Public portfolios display only the learner’s first name and education stage (e.g., "Tobi (JSS3)")—never their home address, phone number, email, or full date of birth.',
          'Parents can revoke public or partner visibility in real time with zero delay.',
        ],
      },
      {
        heading: '3.3 Mentor Safeguarding & Interaction Boundaries',
        body: 'SparkTrack eliminates unmonitored 1-on-1 private chat between adults and minors. Mentor interaction is strictly limited to structured rubric quality scoring and curriculum-aligned behavioural signal observations visible to the learner’s parent/guardian and school administrator.',
      },
    ],
  },
  {
    id: 'ai-charter',
    shortLabel: '4. AI Ethics Charter',
    title: 'AI Ethics, UNESCO/UNICEF Child AI & Non-Deterministic Guidance Charter',
    subtitle: 'Why SparkTrack bans deterministic career labels and enforces dual-layer AI guardrails for youth.',
    effectiveDate: 'October 25, 2026',
    jurisdictions: ['UNESCO AI Ethics', 'UNICEF AI for Children', 'EU AI Act (Educational AI)', 'NITDA / NDPC AI Guidance'],
    sections: [
      {
        heading: '4.1 Exploration Over Predetermination',
        body: 'A 12- or 15-year-old is still discovering who they are. Traditional aptitude tests often assign rigid labels that limit a young person’s confidence. SparkTrack’s 6 intelligence engines are mathematically and ethically designed to treat every capability score and pathway affinity as an evolving, time-bound signal—never a fixed destiny.',
      },
      {
        heading: '4.2 Automated Dual-Layer AI Guardrail Verification',
        body: 'Every 13-Part Longitudinal Development Report generated by our Recommendation Synthesis Engine passes through an automated Guardrail Verifier before it can be saved or shown to a family:',
        bullets: [
          'Prohibited Deterministic Language: Phrases such as "must become", "is destined for", "only suited for", "cannot succeed in", "fixed talent", or "permanent career" trigger an automatic guardrail rejection.',
          'Mandatory Exploratory Framing: Reports must use growth-oriented, exploratory framing ("shows emerging affinity for", "could explore", "building momentum in").',
          'Transparent Audit Badge: Every report displays its live Child-Safety Guardrail Verification status and count of exploratory signals.',
        ],
      },
      {
        heading: '4.3 Human-in-the-Loop Verification & Zero PII to LLMs',
        body: 'AI never grades student character in isolation. Skill scores are grounded in human mentor rubric verification (1.35× verified weight) and transparent logarithmic saturation math. Furthermore, when narrative synthesis is invoked, student contact PII (phone numbers, emails, surnames) is never transmitted to external language models.',
      },
    ],
  },
  {
    id: 'dpa',
    shortLabel: '5. School & NGO DPA',
    title: 'Institutional Data Processing Agreement (DPA) for Schools, Ministries & NGOs',
    subtitle: 'Standard enterprise data protection addendum for secondary schools, foundations, and government programmes.',
    effectiveDate: 'October 25, 2026',
    jurisdictions: ['NDPA 2023 Controller-Processor', 'GDPR Art. 28 & SCCs', 'POPIA Operator Agreement', 'US FERPA'],
    sections: [
      {
        heading: '5.1 Institutional Controller & Processor Responsibilities',
        body: 'When a School, School Network, NGO, or Government Ministry ("Institutional Controller") onboards cohorts onto SparkTrack ("Data Processor" / "Operator"):',
        bullets: [
          'SparkTrack processes institutional learner data solely on documented instructions from the School/Organisation and within the bounds of verified parental consent.',
          'PostgreSQL Row-Level Security (RLS) isolates access so School Administrators and Mentors can only access learners enrolled in their authorised cohorts or institution (core.fn_can_access_learner).',
        ],
      },
      {
        heading: '5.2 Technical & Organisational Security Measures (TOMs)',
        body: 'SparkTrack maintains enterprise-grade security across its stack:',
        bullets: [
          'Encryption: TLS 1.3 encryption in transit and AES-256 encryption at rest across database and object storage.',
          'Cryptographic Integrity: Append-only SHA-256 hash chain (evidence.cryptographic_ledger) audited continuously via GET /api/health.',
          'Access Control: JWT verification (JWKS / HS256), role-based endpoint guards (@Roles), and object-level RLS.',
        ],
      },
      {
        heading: '5.3 Authorised Sub-Processors & 72-Hour Breach Notification',
        body: 'SparkTrack uses vetted enterprise infrastructure sub-processors: Supabase/AWS (PostgreSQL 17 & Auth), Cloudflare R2 (Artifact Object Storage), Termii (Transactional SMS OTP), and Paystack/Stripe (PCI-DSS Level 1 Billing). In the event of a confirmed personal data breach, SparkTrack notifies the Institutional Controller and relevant Data Protection Authority (e.g., NDPC Nigeria) within 72 hours.',
      },
    ],
  },
  {
    id: 'ledger-governance',
    shortLabel: '6. Ledger & Erasure',
    title: 'Cryptographic Ledger Governance & Right-to-Erasure Protocol',
    subtitle:
      'How SparkTrack reconciles immutable SHA-256 evidence proofs with NDPA Section 34 and GDPR Article 17 Right to Erasure.',
    effectiveDate: 'October 25, 2026',
    jurisdictions: ['NDPA Sec. 34 (Right to Erasure)', 'GDPR Art. 17', 'ISO/IEC 27701 Privacy Engineering'],
    sections: [
      {
        heading: '6.1 The Immutability vs. Erasure Engineering Challenge',
        body: 'SparkTrack seals every student project into an append-only PostgreSQL ledger (evidence.cryptographic_ledger) where UPDATE, DELETE, and TRUNCATE operations are blocked by database triggers to prevent credential forgery. At the same time, data protection laws (NDPA Section 34; GDPR Article 17; POPIA Section 24) grant parents and learners the legal right to request deletion of their personal data.',
      },
      {
        heading: '6.2 Cryptographic Pseudonymization & PII Separation',
        body: 'SparkTrack resolves this through strict architectural separation between Identity Tables and the Cryptographic Ledger:',
        bullets: [
          'Zero PII in the Ledger: evidence.cryptographic_ledger stores only artifact_id (UUID), learner_id (UUID), payload_canonical_hash (one-way SHA-256 hex), previous_ledger_hash, and row_signature_hash. No names, emails, phone numbers, or raw project files ever enter the ledger table.',
          'De-Identification on Erasure Request: When a verified parent/guardian submits an Erasure Request to our DPO, SparkTrack scrubs all personal identifiers in core.users and core.learner_profiles and purges media objects from Cloudflare R2.',
          'Chain Continuity Preserved: Because the remaining ledger row contains only an unlinked UUID and irreversible SHA-256 hash, it is legally and mathematically anonymized while preserving chain verification (ledgerQueries.verifyChain) for all other learners.',
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
                <span>Enterprise Legal, Privacy &amp; Child-Safety Trust Center</span>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">
                Built for Nigeria, Africa, and Global Compliance.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-blue-100/85">
                Transparent governance across the <strong>Nigeria Data Protection Act (NDPA) 2023</strong>,{' '}
                <strong>Child’s Rights Act 2003</strong>, <strong>AU / South Africa POPIA / Kenya DPA</strong>,{' '}
                <strong>EU/UK GDPR</strong>, <strong>US COPPA/FERPA</strong>, and <strong>UNESCO Child AI Ethics</strong>.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row lg:flex-col">
              <Link href="/contact?category=PRIVACY_DPO_REQUEST">
                <Button className="w-full bg-cyan-300 text-[#0e1b38] hover:bg-cyan-200">
                  <ShieldCheck className="mr-1.5 h-4 w-4" /> Contact Data Protection Officer
                </Button>
              </Link>
              <Link href="/parent/consent">
                <Button
                  variant="outline"
                  className="w-full border-white/25 bg-white/10 text-white hover:bg-white/20"
                >
                  <HeartHandshake className="mr-1.5 h-4 w-4" /> Guardian SMS Consent Portal
                </Button>
              </Link>
            </div>
          </div>

          {/* Regional Jurisdiction Pill Strip */}
          <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5 text-xs font-semibold text-blue-100">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5">
              <Globe className="h-3.5 w-3.5 text-emerald-300" /> Nigeria: NDPA 2023 &amp; CRA 2003
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5">
              <Globe className="h-3.5 w-3.5 text-cyan-300" /> Africa: AU Malabo • POPIA • Kenya DPA • Ghana Act 843
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5">
              <Lock className="h-3.5 w-3.5 text-amber-300" /> Global: EU/UK GDPR • US COPPA &amp; FERPA • UNESCO AI
            </span>
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

