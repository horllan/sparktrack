'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@sparktrack/ui';
import { createClient } from '../../../../lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

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

export default function AdminDashboardPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<'SCHOOL' | 'NGO' | 'TRAINING_PROVIDER' | 'EMPLOYER' | 'GOVERNMENT'>('SCHOOL');

  const [cohortTitle, setCohortTitle] = useState('');
  const [programmeType, setProgrammeType] = useState<'HOLIDAY_CAMP' | 'SCHOOL_TERM_COCURRICULAR' | 'WEEKEND_WORKSHOP' | 'ONLINE_COHORT'>('HOLIDAY_CAMP');
  const [startDate, setStartDate] = useState('2026-11-01');
  const [endDate, setEndDate] = useState('2026-12-15');
  const [maxCapacity, setMaxCapacity] = useState('30');
  const [priceNgn, setPriceNgn] = useState('0');

  const [enrolLearnerId, setEnrolLearnerId] = useState('');
  const [enrolCohortId, setEnrolCohortId] = useState('');
  const [paymentProvider, setPaymentProvider] = useState<'FREE_PILOT' | 'SCHOLARSHIP' | 'PAYSTACK' | 'STRIPE'>('FREE_PILOT');

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

  useEffect(() => {
    void loadCohorts();
  }, [loadCohorts]);

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
          paymentReference: paymentProvider === 'PAYSTACK' || paymentProvider === 'STRIPE' ? `ref_${Date.now()}` : null,
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

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SparkTrack Operations, Cohort &amp; Billing Admin</h1>
          <p className="text-sm text-slate-600">
            Manage holiday camps, school term cohorts, scholarships, Paystack/Stripe enrolments, and mentor assignments.
          </p>
        </div>

        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Launch Programme Cohort</CardTitle>
              <CardDescription>Create a Holiday Camp, School Term Co-Curricular, or Weekend Workshop.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={cohortTitle}
                onChange={(e) => setCohortTitle(e.target.value)}
                placeholder="Cohort Title (e.g., Lagos Robotics & AI Explorer Camp)"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={programmeType}
                  onChange={(e) => setProgrammeType(e.target.value as typeof programmeType)}
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
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
              <div className="grid grid-cols-3 gap-2">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                <Input
                  type="number"
                  value={priceNgn}
                  onChange={(e) => setPriceNgn(e.target.value)}
                  placeholder="Price (kobo)"
                />
              </div>
              <Button disabled={busy || cohortTitle.trim().length < 3} onClick={() => void createCohort()}>
                Create Programme Cohort
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. Enrol Learner &amp; Assign Mentor</CardTitle>
              <CardDescription>Activate Scholarship / Free Pilot seats or initiate Paystack/Stripe billing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 border-b border-slate-100 pb-3">
                <div className="grid grid-cols-2 gap-2">
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
                </div>
                <div className="flex gap-2">
                  <select
                    value={paymentProvider}
                    onChange={(e) => setPaymentProvider(e.target.value as typeof paymentProvider)}
                    className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="FREE_PILOT">Free Pilot (Immediate Activation)</option>
                    <option value="SCHOLARSHIP">Sponsored Scholarship (Immediate Activation)</option>
                    <option value="PAYSTACK">Paystack (Pending Webhook Confirmation)</option>
                    <option value="STRIPE">Stripe (Pending Webhook Confirmation)</option>
                  </select>
                  <Button disabled={busy || !enrolLearnerId || !enrolCohortId} onClick={() => void enrolLearner()}>
                    Enrol Learner
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
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
                </div>
                <Button
                  variant="outline"
                  disabled={busy || !assignMentorId || !assignCohortId}
                  onClick={() => void assignMentor()}
                >
                  Assign Mentor to Cohort
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Register Partner School, NGO, or Sponsor</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Input
              className="max-w-sm"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Organisation Name (e.g., Queen's College Lagos)"
            />
            <select
              value={orgType}
              onChange={(e) => setOrgType(e.target.value as typeof orgType)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active &amp; Upcoming Programme Cohorts ({cohorts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {cohorts.length === 0 ? (
              <p className="text-sm text-slate-500">No cohorts created yet.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {cohorts.map((c) => (
                  <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{c.title}</span>
                      <Badge variant={c.isActive ? 'success' : 'outline'}>
                        {c.currentEnrolmentCount}/{c.maxCapacity} enrolled
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {c.programmeType} • {c.startDate} → {c.endDate} • ID: <code>{c.id}</code>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
