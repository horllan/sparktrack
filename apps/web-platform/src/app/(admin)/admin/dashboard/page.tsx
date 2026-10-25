'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  CalendarRange,
  MessageSquare,
  Network,
  Sparkles,
  UserPlus,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@sparktrack/ui';
import { createClient } from '../../../../lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const DEMO_LEARNER_ID = '11111111-1111-4111-8111-111111111113';
const DEMO_MENTOR_ID = '11111111-1111-4111-8111-000000000020';

interface Cohort {
  id: string;
  organisationId: string | null;
  organisationName: string | null;
  title: string;
  description: string | null;
  programmeType: string;
  startDate: string;
  endDate: string;
  maxCapacity: number;
  currentEnrolmentCount: number;
  priceNgn: number | null;
  priceUsd: number | null;
  isActive: boolean;
}

interface GraphTopology {
  nodes: Array<{
    id: string;
    nodeType: string;
    code: string;
    name: string;
    category: string | null;
    description: string;
  }>;
  edges: Array<{
    sourceId: string;
    sourceCode: string;
    sourceName: string;
    sourceType: string;
    targetId: string;
    targetCode: string;
    targetName: string;
    targetType: string;
    relationshipType: string;
    contributionWeight: number;
    isRequired: boolean;
  }>;
}

interface SupportTicket {
  id: string;
  ticketReference: string;
  category: string;
  priority: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'ESCALATED_DPO' | 'RESOLVED';
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string | null;
  requesterRole: string;
  organisationName: string | null;
  countryCode: string;
  subject: string;
  message: string;
  staffResolutionNotes: string | null;
  createdAt: string;
}

type AdminTab = 'cohorts' | 'enrolment' | 'partners' | 'graph' | 'tickets';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('cohorts');
  const [nodeFilter, setNodeFilter] = useState<string>('ALL');

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [topology, setTopology] = useState<GraphTopology | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, string>>({});
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<'SCHOOL' | 'NGO' | 'TRAINING_PROVIDER' | 'EMPLOYER' | 'GOVERNMENT'>('SCHOOL');

  const [cohortTitle, setCohortTitle] = useState('');
  const [programmeType, setProgrammeType] = useState<
    'HOLIDAY_CAMP' | 'SCHOOL_TERM_COCURRICULAR' | 'WEEKEND_WORKSHOP' | 'ONLINE_COHORT'
  >('HOLIDAY_CAMP');
  const [startDate, setStartDate] = useState('2026-11-01');
  const [endDate, setEndDate] = useState('2026-12-15');
  const [maxCapacity, setMaxCapacity] = useState('30');
  const [priceNgn, setPriceNgn] = useState('0');

  const [enrolLearnerId, setEnrolLearnerId] = useState('');
  const [enrolCohortId, setEnrolCohortId] = useState('');
  const [paymentProvider, setPaymentProvider] = useState<'FREE_PILOT' | 'SCHOLARSHIP' | 'PAYSTACK' | 'STRIPE'>(
    'FREE_PILOT',
  );

  const [assignMentorId, setAssignMentorId] = useState('');
  const [assignCohortId, setAssignCohortId] = useState('');

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const getToken = async () => {
    const { data } = await createClient().auth.getSession();
    return data.session?.access_token ?? null;
  };

  const loadCohorts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/v1/billing/cohorts`);
      if (res.ok) {
        const list = (await res.json()) as Cohort[];
        setCohorts(list);
        if (list[0] && !enrolCohortId) {
          setEnrolCohortId(list[0].id);
          setAssignCohortId(list[0].id);
        }
      }
    } catch {
      // Non-fatal on initial load
    }
  }, [enrolCohortId]);

  const loadTickets = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/v1/support/tickets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setTickets((await res.json()) as SupportTicket[]);
      }
    } catch {
      // Optional when browsing unauthenticated
    }
  }, []);

  useEffect(() => {
    void loadCohorts();
    void loadTickets();
    fetch(`${API_URL}/v1/graph/topology`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setTopology(data as GraphTopology);
      })
      .catch(() => null);
  }, [loadCohorts, loadTickets]);

  async function updateTicketStatus(
    ticketId: string,
    status: 'OPEN' | 'IN_PROGRESS' | 'ESCALATED_DPO' | 'RESOLVED',
  ) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in with an Operations or School Admin account to update tickets.');
      const res = await fetch(`${API_URL}/v1/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          status,
          ...(resolutionDrafts[ticketId] ? { staffResolutionNotes: resolutionDrafts[ticketId] } : {}),
        }),
      });
      const body = (await res.json()) as { ticketReference?: string; status?: string; message?: string };
      if (!res.ok) throw new Error(body.message ?? 'Could not update ticket.');
      setNotice(`Updated ticket ${body.ticketReference} to ${body.status}.`);
      await loadTickets();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update support ticket.');
    } finally {
      setBusy(false);
    }
  }

  async function createOrganisation() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in first to register an organisation.');
      const res = await fetch(`${API_URL}/v1/learning/institutions/organisations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: orgName.trim(), orgType }),
      });
      const body = (await res.json()) as { organisationId?: string; message?: string };
      if (!res.ok) throw new Error(body.message ?? 'Failed to create organisation.');
      setNotice(`Registered partner organisation (${body.organisationId}).`);
      setOrgName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create organisation.');
    } finally {
      setBusy(false);
    }
  }

  async function createCohort() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in first to create a cohort.');
      const res = await fetch(`${API_URL}/v1/billing/cohorts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: cohortTitle.trim(),
          programmeType,
          startDate,
          endDate,
          maxCapacity: Number(maxCapacity) || 30,
          priceNgn: Number(priceNgn) || 0,
        }),
      });
      const body = (await res.json()) as { cohortId?: string; message?: string };
      if (!res.ok) throw new Error(body.message ?? 'Failed to create cohort.');
      setNotice(`Created programme cohort (${body.cohortId}).`);
      setCohortTitle('');
      await loadCohorts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create cohort.');
    } finally {
      setBusy(false);
    }
  }

  async function enrolLearner() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in first to enrol a learner.');
      const res = await fetch(`${API_URL}/v1/billing/enrolments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          learnerId: enrolLearnerId.trim(),
          cohortId: enrolCohortId.trim(),
          paymentProvider,
          paymentReference:
            paymentProvider === 'PAYSTACK' || paymentProvider === 'STRIPE' ? `ref_${Date.now()}` : null,
        }),
      });
      const body = (await res.json()) as { enrolmentId?: string; enrolmentStatus?: string; message?: string };
      if (!res.ok) throw new Error(body.message ?? 'Failed to enrol learner.');
      setNotice(`Enrolment ${body.enrolmentId} status: ${body.enrolmentStatus}.`);
      await loadCohorts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not enrol learner.');
    } finally {
      setBusy(false);
    }
  }

  async function assignMentor() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in first to assign a mentor.');
      const res = await fetch(`${API_URL}/v1/mentorship/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mentorId: assignMentorId.trim(),
          cohortId: assignCohortId.trim(),
        }),
      });
      const body = (await res.json()) as { assignmentId?: string; message?: string };
      if (!res.ok) throw new Error(body.message ?? 'Failed to assign mentor.');
      setNotice(`Assigned mentor to cohort (${body.assignmentId}).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not assign mentor.');
    } finally {
      setBusy(false);
    }
  }

  const filteredNodes = topology
    ? nodeFilter === 'ALL'
      ? topology.nodes
      : topology.nodes.filter((n) => n.nodeType === nodeFilter)
    : [];

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-7">
        {/* Hero Header */}
        <div className="spark-enter flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.28)] backdrop-blur sm:p-8">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-spark-200 bg-spark-50 px-3 py-1 text-xs font-semibold text-spark-700">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Operations Workspace</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Run learning programmes with clarity.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Launch cohorts, coordinate scholarships or billing, assign mentors, and inspect the multi-hop capability
              graph.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">{cohorts.length} Active Cohorts</Badge>
            {topology && <Badge variant="outline">{topology.nodes.length} Graph Nodes</Badge>}
          </div>
        </div>

        {/* Segmented Workflow Switcher */}
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white/80 p-1.5 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('cohorts')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === 'cohorts'
                ? 'bg-spark-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <CalendarRange className="h-4 w-4" />
            <span>1. Cohorts &amp; Launch ({cohorts.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('enrolment')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === 'enrolment'
                ? 'bg-spark-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <UserPlus className="h-4 w-4" />
            <span>2. Enrolment &amp; Mentors</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('partners')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === 'partners'
                ? 'bg-spark-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>3. Partner Organisations</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('graph')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === 'graph'
                ? 'bg-spark-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Network className="h-4 w-4" />
            <span>4. Capability Graph ({topology?.nodes.length ?? 0})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('tickets');
              void loadTickets();
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === 'tickets'
                ? 'bg-spark-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>5. Support &amp; DPO Desk ({tickets.length})</span>
          </button>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-800"
          >
            {notice}
          </p>
        )}

        {/* TAB 1: COHORTS & LAUNCH */}
        {activeTab === 'cohorts' && (
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Launch Programme Cohort</CardTitle>
                <CardDescription>
                  Create a Holiday Camp, School Term Co-Curricular, Weekend Workshop, or Online Cohort.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5">
                <Input
                  value={cohortTitle}
                  onChange={(e) => setCohortTitle(e.target.value)}
                  placeholder="Cohort Title (e.g., Lagos Robotics & AI Explorer Camp)"
                />
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <select
                    value={programmeType}
                    onChange={(e) => setProgrammeType(e.target.value as typeof programmeType)}
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900"
                  >
                    <option value="HOLIDAY_CAMP">Holiday Camp</option>
                    <option value="SCHOOL_TERM_COCURRICULAR">School Term Co-Curricular</option>
                    <option value="WEEKEND_WORKSHOP">Weekend Workshop</option>
                    <option value="ONLINE_COHORT">Online Cohort</option>
                  </select>
                  <Input
                    type="number"
                    value={maxCapacity}
                    onChange={(e) => setMaxCapacity(e.target.value)}
                    placeholder="Max Capacity"
                  />
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  <Input
                    type="number"
                    value={priceNgn}
                    onChange={(e) => setPriceNgn(e.target.value)}
                    placeholder="Price (kobo)"
                  />
                </div>
                <Button className="w-full sm:w-auto" disabled={busy || cohortTitle.trim().length < 3} onClick={() => void createCohort()}>
                  Create Programme Cohort
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active &amp; Upcoming Programme Cohorts ({cohorts.length})</CardTitle>
                <CardDescription>Click a cohort card to pre-fill its ID for enrolment and mentor assignment.</CardDescription>
              </CardHeader>
              <CardContent>
                {cohorts.length === 0 ? (
                  <p className="text-sm text-slate-500">No cohorts created yet.</p>
                ) : (
                  <div className="space-y-3">
                    {cohorts.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setEnrolCohortId(c.id);
                          setAssignCohortId(c.id);
                        }}
                        className="cursor-pointer rounded-2xl border border-slate-200/90 bg-white p-4 text-sm transition hover:border-spark-300 hover:shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">{c.title}</span>
                          <Badge variant={c.isActive ? 'success' : 'outline'}>
                            {c.currentEnrolmentCount}/{c.maxCapacity} enrolled
                          </Badge>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-500">
                          {c.programmeType.replace(/_/g, ' ')} • {c.startDate} → {c.endDate} • ID:{' '}
                          <code className="font-mono">{c.id}</code>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 2: ENROLMENT & MENTORS */}
        {activeTab === 'enrolment' && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Enrol Learner into Cohort</CardTitle>
                    <CardDescription>
                      Activate Scholarship / Free Pilot seats or initiate Paystack/Stripe billing.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEnrolLearnerId(DEMO_LEARNER_ID)}
                  >
                    Use Demo Explorer ID
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3.5">
                <Input
                  value={enrolLearnerId}
                  onChange={(e) => setEnrolLearnerId(e.target.value)}
                  placeholder="Learner UUID"
                />
                <Input
                  value={enrolCohortId}
                  onChange={(e) => setEnrolCohortId(e.target.value)}
                  placeholder="Cohort UUID"
                />
                <select
                  value={paymentProvider}
                  onChange={(e) => setPaymentProvider(e.target.value as typeof paymentProvider)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900"
                >
                  <option value="FREE_PILOT">Free Pilot (Immediate Activation)</option>
                  <option value="SCHOLARSHIP">Sponsored Scholarship (Immediate Activation)</option>
                  <option value="PAYSTACK">Paystack (Pending Webhook Confirmation)</option>
                  <option value="STRIPE">Stripe (Pending Webhook Confirmation)</option>
                </select>
                <Button disabled={busy || !enrolLearnerId || !enrolCohortId} onClick={() => void enrolLearner()}>
                  Enrol Learner
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Assign Mentor to Cohort</CardTitle>
                    <CardDescription>
                      Grant a verified educator or industry mentor review permissions for a cohort.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAssignMentorId(DEMO_MENTOR_ID)}
                  >
                    Use Demo Mentor ID
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3.5">
                <Input
                  value={assignMentorId}
                  onChange={(e) => setAssignMentorId(e.target.value)}
                  placeholder="Mentor UUID"
                />
                <Input
                  value={assignCohortId}
                  onChange={(e) => setAssignCohortId(e.target.value)}
                  placeholder="Cohort UUID"
                />
                <Button
                  variant="outline"
                  disabled={busy || !assignMentorId || !assignCohortId}
                  onClick={() => void assignMentor()}
                >
                  Assign Mentor to Cohort
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 3: PARTNER ORGANISATIONS */}
        {activeTab === 'partners' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Register Partner School, NGO, or Sponsor</CardTitle>
              <CardDescription>
                Onboard institutional partners so cohorts and scholarship seats can be linked to their organisation.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Input
                className="max-w-md"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Organisation Name (e.g., Queen's College Lagos)"
              />
              <select
                value={orgType}
                onChange={(e) => setOrgType(e.target.value as typeof orgType)}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900"
              >
                <option value="SCHOOL">School</option>
                <option value="NGO">NGO / Foundation</option>
                <option value="TRAINING_PROVIDER">Training Provider</option>
                <option value="EMPLOYER">Employer / Industry Partner</option>
                <option value="GOVERNMENT">Government Agency</option>
              </select>
              <Button disabled={busy || orgName.trim().length < 2} onClick={() => void createOrganisation()}>
                Register Organisation
              </Button>
            </CardContent>
          </Card>
        )}

        {/* TAB 4: CAPABILITY GRAPH TOPOLOGY INSPECTOR */}
        {activeTab === 'graph' && topology && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">
                    Capability Graph Topology Inspector ({topology.nodes.length} Nodes • {topology.edges.length}{' '}
                    Weighted Edges)
                  </CardTitle>
                  <CardDescription>
                    Multi-hop DAG mapping Activities → Skills → Capabilities → Career &amp; Entrepreneurship Pathways.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['ALL', 'SKILL', 'CAPABILITY', 'CAREER_PATHWAY', 'ENTREPRENEURSHIP_PATHWAY', 'ACTIVITY'].map(
                    (type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNodeFilter(type)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                          nodeFilter === type
                            ? 'bg-spark-500 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {type.replace(/_/g, ' ')}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredNodes.map((node) => (
                  <div
                    key={node.id}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-sm transition hover:bg-white"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{node.name}</span>
                      <Badge variant="outline">{node.nodeType}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{node.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* TAB 5: EMPLOYEE SUPPORT, PARTNERSHIPS & DPO COMPLIANCE DESK */}
        {activeTab === 'tickets' && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">
                    Employee Support, School Partnerships &amp; DPO Triage Queue ({tickets.length})
                  </CardTitle>
                  <CardDescription>
                    Inquiries submitted via /contact are routed here for SparkTrack staff and Data Protection Officers.
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void loadTickets()}>
                  Refresh Queue
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {tickets.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-sm text-slate-500">
                  No open support or DPO tickets in the queue (sign in with your Operations / Admin account to view live
                  staff tickets).
                </div>
              ) : (
                tickets.map((t) => (
                  <div
                    key={t.id}
                    className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-4 text-sm shadow-2xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-800">
                          {t.ticketReference}
                        </code>
                        <span className="font-extrabold text-slate-900">{t.subject}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">{t.category.replace(/_/g, ' ')}</Badge>
                        <Badge variant={t.priority === 'URGENT_COMPLIANCE' ? 'warning' : 'default'}>
                          {t.priority}
                        </Badge>
                        <Badge variant={t.status === 'RESOLVED' ? 'success' : 'outline'}>{t.status}</Badge>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500">
                      From: <strong>{t.requesterName}</strong> ({t.requesterRole} • {t.requesterEmail}
                      {t.requesterPhone ? ` • ${t.requesterPhone}` : ''})
                      {t.organisationName ? ` • Org: ${t.organisationName}` : ''} • Country: {t.countryCode}
                    </p>

                    <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-700">{t.message}</p>

                    <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-center">
                      <Input
                        value={resolutionDrafts[t.id] ?? t.staffResolutionNotes ?? ''}
                        onChange={(e) =>
                          setResolutionDrafts((prev) => ({
                            ...prev,
                            [t.id]: e.target.value,
                          }))
                        }
                        placeholder="Add staff resolution notes or DPO audit comment…"
                        className="flex-1 text-xs"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void updateTicketStatus(t.id, 'IN_PROGRESS')}
                        >
                          In Progress
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void updateTicketStatus(t.id, 'ESCALATED_DPO')}
                        >
                          Escalate DPO
                        </Button>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => void updateTicketStatus(t.id, 'RESOLVED')}
                        >
                          Mark Resolved
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
