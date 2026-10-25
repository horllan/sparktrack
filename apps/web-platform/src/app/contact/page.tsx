'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  Globe,
  Mail,
  Phone,
  Scale,
  Send,
  ShieldCheck,
  Sparkles,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@sparktrack/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

type TicketCategory =
  | 'SCHOOL_PARTNERSHIP'
  | 'PARENT_CONSENT_HELP'
  | 'SCHOLARSHIP_SPONSORSHIP'
  | 'PRIVACY_DPO_REQUEST'
  | 'GENERAL_SUPPORT'
  | 'TECHNICAL_ISSUE';

const CATEGORIES: Array<{
  id: TicketCategory;
  label: string;
  subtitle: string;
  sla: string;
}> = [
  {
    id: 'SCHOOL_PARTNERSHIP',
    label: 'School & Institutional Partnership',
    subtitle: 'Onboard a secondary school, school network, or government youth programme',
    sla: '24h Partnership SLA',
  },
  {
    id: 'PARENT_CONSENT_HELP',
    label: 'Parent & Family Assistance',
    subtitle: 'Help registering a JSS/SSS child, SMS OTP verification, or report questions',
    sla: 'Same-Day Family Desk',
  },
  {
    id: 'SCHOLARSHIP_SPONSORSHIP',
    label: 'Sponsor Youth Scholarships (CSR / NGO)',
    subtitle: 'Fund cohorts for underserved learners across Nigeria and Africa',
    sla: 'Executive Desk',
  },
  {
    id: 'PRIVACY_DPO_REQUEST',
    label: 'Data Protection Officer (NDPA / GDPR / POPIA)',
    subtitle: 'Data Subject Rights, Right to Erasure, or Institutional DPA signing',
    sla: 'Priority Compliance Queue',
  },
  {
    id: 'GENERAL_SUPPORT',
    label: 'General Platform Inquiry',
    subtitle: 'Questions from mentors, educators, researchers, or media',
    sla: '24–48h Response',
  },
  {
    id: 'TECHNICAL_ISSUE',
    label: 'Technical & Offline Sync Support',
    subtitle: 'Help with PWA offline sync, cohort billing webhooks, or account access',
    sla: 'Engineering Support',
  },
];

function ContactPageContent() {
  const searchParams = useSearchParams();
  const [category, setCategory] = useState<TicketCategory>('SCHOOL_PARTNERSHIP');
  const [requesterName, setRequesterName] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [requesterPhone, setRequesterPhone] = useState('');
  const [requesterRole, setRequesterRole] = useState('PARENT');
  const [organisationName, setOrganisationName] = useState('');
  const [countryCode, setCountryCode] = useState('NG');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ticketReceipt, setTicketReceipt] = useState<{
    ticketReference: string;
    status: string;
    priority: string;
  } | null>(null);

  useEffect(() => {
    const catParam = searchParams.get('category') as TicketCategory | null;
    if (catParam && CATEGORIES.some((c) => c.id === catParam)) {
      setCategory(catParam);
    }
  }, [searchParams]);

  async function submitTicket() {
    setBusy(true);
    setError('');
    setTicketReceipt(null);
    try {
      const res = await fetch(`${API_URL}/v1/support/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          requesterName: requesterName.trim(),
          requesterEmail: requesterEmail.trim(),
          ...(requesterPhone.trim() ? { requesterPhone: requesterPhone.trim() } : {}),
          requesterRole,
          ...(organisationName.trim() ? { organisationName: organisationName.trim() } : {}),
          countryCode,
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      const body = (await res.json()) as {
        ticketReference?: string;
        status?: string;
        priority?: string;
        message?: string;
      };
      if (!res.ok || !body.ticketReference) {
        throw new Error(body.message ?? 'Could not submit inquiry ticket.');
      }
      setTicketReceipt({
        ticketReference: body.ticketReference,
        status: body.status ?? 'OPEN',
        priority: body.priority ?? 'NORMAL',
      });
      setSubject('');
      setMessage('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to submit inquiry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Hero Header */}
        <div className="spark-enter rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-spark-200 bg-spark-50 px-3 py-1 text-xs font-bold text-spark-700">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Global Support, Partnerships &amp; DPO Desk</span>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Connect with the SparkTrack team.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600">
                Every inquiry is routed directly to our Operations, Institutional Partnerships, or Data Protection
                Officer (DPO) team with a tracked reference number.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/legal">
                <Button variant="outline">
                  <Scale className="mr-1.5 h-4 w-4" /> Legal &amp; Privacy Center
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[0.92fr_1.08fr]">
          {/* Left Column: Category Selection & Regional Desks */}
          <div className="space-y-5">
            <div className="space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                1. Choose Inquiry Department
              </p>
              <div className="grid gap-2.5">
                {CATEGORIES.map((cat) => {
                  const active = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        active
                          ? 'border-spark-500 bg-white shadow-md ring-2 ring-spark-500/15'
                          : 'border-slate-200/90 bg-white/80 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-extrabold text-slate-900">{cat.label}</span>
                        <Badge variant={active ? 'default' : 'outline'}>{cat.sla}</Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{cat.subtitle}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Regional Offices & Direct Contact Channels */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Regional &amp; Enterprise Channels</CardTitle>
                <CardDescription>Nigeria HQ • Pan-Africa • International</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-slate-700">
                <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                  <Globe className="mt-0.5 h-4 w-4 shrink-0 text-spark-600" />
                  <div>
                    <p className="font-bold text-slate-900">Nigeria &amp; West Africa Desk (Lagos / Abuja)</p>
                    <p className="mt-0.5 text-slate-600">
                      Secondary School pilots, Termii SMS consent, Paystack cohorts &amp; NDPA 2023 compliance.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-spark-600" />
                  <div>
                    <p className="font-bold text-slate-900">Direct Department Emails</p>
                    <p className="mt-0.5 text-slate-600">
                      Support: <code>support@sparktrack.org</code> • Partnerships: <code>schools@sparktrack.org</code> •
                      DPO: <code>dpo@sparktrack.org</code>
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-spark-600" />
                  <div>
                    <p className="font-bold text-slate-900">Employee Operations Queue</p>
                    <p className="mt-0.5 text-slate-600">
                      All tickets submitted here appear live in the SparkTrack Operations Console for staff triage.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Ticket Submission Form */}
          <Card className="overflow-hidden border-slate-200/90 shadow-xl">
            <div className="h-1.5 bg-gradient-to-r from-spark-600 via-cyan-500 to-coral-500" />
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant="default">{CATEGORIES.find((c) => c.id === category)?.label}</Badge>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" /> Employee-Monitored Queue
                </span>
              </div>
              <CardTitle className="mt-2 text-xl">Submit an Official Request or Inquiry</CardTitle>
              <CardDescription>
                Fill in your details below. You will receive an immediate ticket reference number.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {error && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </p>
              )}

              {ticketReceipt ? (
                <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-5 text-sm text-emerald-950">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    <div>
                      <p className="text-base font-extrabold">Inquiry Logged with SparkTrack Operations</p>
                      <p className="text-xs text-emerald-800">
                        Reference Number:{' '}
                        <code className="rounded bg-white px-2 py-0.5 font-mono font-bold">
                          {ticketReceipt.ticketReference}
                        </code>
                      </p>
                    </div>
                  </div>
                  <p className="text-xs leading-5 text-emerald-900">
                    Our team has received your ticket (Priority: <strong>{ticketReceipt.priority}</strong>, Status:{' '}
                    <strong>{ticketReceipt.status}</strong>) and will respond to <strong>{requesterEmail}</strong>.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setTicketReceipt(null)}>
                    Submit Another Inquiry
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Your Full Name *</label>
                      <Input
                        value={requesterName}
                        onChange={(e) => setRequesterName(e.target.value)}
                        placeholder="e.g. Dr. Ibrahim Musa"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Email Address *</label>
                      <Input
                        type="email"
                        value={requesterEmail}
                        onChange={(e) => setRequesterEmail(e.target.value)}
                        placeholder="you@school.edu.ng"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3.5 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Phone Number</label>
                      <Input
                        type="tel"
                        value={requesterPhone}
                        onChange={(e) => setRequesterPhone(e.target.value)}
                        placeholder="+2348012345678"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Your Role</label>
                      <select
                        value={requesterRole}
                        onChange={(e) => setRequesterRole(e.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-900"
                      >
                        <option value="PARENT">Parent / Guardian</option>
                        <option value="SCHOOL_ADMIN">School Principal / Admin</option>
                        <option value="NGO_SPONSOR">NGO / CSR Sponsor</option>
                        <option value="MENTOR">Mentor / Educator</option>
                        <option value="GOVERNMENT">Ministry / Regulator</option>
                        <option value="LEARNER">Student / Learner</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Region / Country</label>
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-900"
                      >
                        <option value="NG">Nigeria (NG)</option>
                        <option value="GH">Ghana (GH)</option>
                        <option value="KE">Kenya (KE)</option>
                        <option value="ZA">South Africa (ZA)</option>
                        <option value="RW">Rwanda (RW)</option>
                        <option value="GB">United Kingdom (GB)</option>
                        <option value="US">United States (US)</option>
                        <option value="INTL">Other International</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        School / Organisation Name (optional)
                      </label>
                      <Input
                        value={organisationName}
                        onChange={(e) => setOrganisationName(e.target.value)}
                        placeholder="e.g. Lagos State Model College"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Subject *</label>
                      <Input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="e.g. JSS1–SS3 Cohort Onboarding for 250 Students"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">How can our team help you? *</label>
                    <textarea
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe your inquiry, school partnership goals, or NDPA/GDPR request in detail…"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-sm text-slate-900 focus:border-spark-500 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <p className="text-[11px] leading-5 text-slate-500">
                    By submitting this form, you acknowledge our{' '}
                    <Link href="/legal?doc=privacy" className="font-semibold text-spark-700 underline">
                      Privacy Policy (NDPA 2023 / POPIA / GDPR)
                    </Link>
                    .
                  </p>

                  <Button
                    className="w-full"
                    disabled={
                      busy ||
                      requesterName.trim().length < 2 ||
                      !requesterEmail.includes('@') ||
                      subject.trim().length < 3 ||
                      message.trim().length < 10
                    }
                    onClick={() => void submitTicket()}
                  >
                    <Send className="mr-1.5 h-4 w-4" />
                    {busy ? 'Routing Inquiry to Team…' : 'Submit Official Inquiry Ticket'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Loading Support &amp; Partnerships Desk…</div>}>
      <ContactPageContent />
    </Suspense>
  );
}

