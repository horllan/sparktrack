'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Badge,
  Building2,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Compass,
  FolderKanban,
  Input,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UsersRound,
} from '@sparktrack/ui';
import { createClient } from '../../../../lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const EDUCATION_STAGES = [
  'JSS1',
  'JSS2',
  'JSS3',
  'SS1',
  'SS2',
  'SS3',
  'University / College',
  'Vocational / Apprenticeship',
  'Self-taught / no formal education',
  'Other',
];

const STUDENT_INTERESTS = [
  'Coding & Programming',
  'Robotics',
  'Graphic Design',
  'AI & Data Science',
  'Business & Entrepreneurship',
  'Cybersecurity',
  'Video Production',
  'Web Development',
];

interface InstitutionAnalytics {
  totals: {
    totalLearners: number;
    verifiedConsentLearners: number;
    sealedArtifacts: number;
    activeCohorts: number;
  };
  ledgerAudit: {
    totalEntries: number;
    allValid: boolean;
  };
  skillDistribution: Array<{
    code: string;
    name: string;
    category: string | null;
    learnerCount: number;
    averageScore: number;
  }>;
  optedInLearnerCount: number;
  organisations: Array<{
    id: string;
    name: string;
    orgType: string;
    countryCode: string;
    subscriptionTier: string;
  }>;
}

interface TalentPoolEntry {
  learnerId: string;
  displayName: string;
  educationStage: string;
  schoolName: string | null;
  declaredInterests: string[];
  allowPublicPortfolio: boolean;
  artifactCount: number;
}

interface ManagedStudent {
  learnerId: string;
  fullName: string;
  educationStage: string;
  dateOfBirth: string;
  consentStatus: string;
  declaredInterests: string[];
  schoolName: string | null;
  accessCode: string;
}

export default function SchoolDashboardPage() {
  const [data, setData] = useState<InstitutionAnalytics | null>(null);
  const [students, setStudents] = useState<ManagedStudent[]>([]);
  const [talentPool, setTalentPool] = useState<TalentPoolEntry[]>([]);
  const [showAddStudent, setShowAddStudent] = useState(false);

  // Add Student Form State (for School Admin / Organisation)
  const [studentName, setStudentName] = useState('');
  const [studentDob, setStudentDob] = useState('2012-09-10');
  const [studentStage, setStudentStage] = useState('JSS3');
  const [studentSchoolName, setStudentSchoolName] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [studentInterests, setStudentInterests] = useState<string[]>(['Robotics', 'Coding & Programming']);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadAnalytics = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const { data: sessionData } = await createClient().auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`${API_URL}/v1/learning/institutions/analytics`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error('Unable to load institutional analytics');
      const body = (await res.json()) as InstitutionAnalytics;
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load analytics.');
    } finally {
      setBusy(false);
    }
  }, []);

  const loadManagedStudents = useCallback(async () => {
    try {
      const { data: sessionData } = await createClient().auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const [childrenRes, talentRes] = await Promise.all([
        fetch(`${API_URL}/v1/auth/children`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/v1/learning/institutions/talent-pool`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (childrenRes.ok) {
        setStudents((await childrenRes.json()) as ManagedStudent[]);
      }
      if (talentRes.ok) {
        setTalentPool((await talentRes.json()) as TalentPoolEntry[]);
      }
    } catch {
      // Optional when browsing unauthenticated
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();
    void loadManagedStudents();
    if (typeof window !== 'undefined' && window.location.search.includes('welcome=add-student')) {
      setShowAddStudent(true);
    }
  }, [loadAnalytics, loadManagedStudents]);

  const toggleStudentInterest = (interest: string) => {
    setStudentInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest],
    );
  };

  async function handleRegisterStudent() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data: sessionData } = await createClient().auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Please sign in with your School or Organisation account at /auth first.');

      const res = await fetch(`${API_URL}/v1/auth/children`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: studentName.trim(),
          dateOfBirth: studentDob,
          educationStage: studentStage,
          ...(studentSchoolName.trim() ? { schoolName: studentSchoolName.trim() } : {}),
          declaredInterests: studentInterests,
          guardianName: guardianName.trim(),
          guardianPhone: guardianPhone.trim(),
          ...(guardianEmail.trim() ? { guardianEmail: guardianEmail.trim() } : {}),
        }),
      });
      const body = (await res.json()) as {
        learnerId?: string;
        fullName?: string;
        accessCode?: string;
        message?: string;
      };
      if (!res.ok) throw new Error(body.message ?? 'Could not register student.');

      setNotice(
        `Registered student ${body.fullName}! Student Access Code: ${body.accessCode} (Pending Guardian NDPA Consent).`,
      );
      setStudentName('');
      setGuardianName('');
      setGuardianPhone('');
      setGuardianEmail('');
      setShowAddStudent(false);
      await Promise.all([loadAnalytics(), loadManagedStudents()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not register student.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-7">
        {/* Modern School Insights Hero Header */}
        <div className="spark-enter flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.28)] backdrop-blur sm:p-8">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-spark-200 bg-spark-50 px-3 py-1 text-xs font-semibold text-spark-700">
              <Compass className="h-3.5 w-3.5" />
              <span>School &amp; Partner Insights</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              See how your learners are growing.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Register under-18 learners from JSS1 onwards, including learners outside formal education, link guardian
              contacts for NDPA compliance, and track cohort capability progression across your institution.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link href="/demo?role=school">
              <Button variant="outline">
                <PlayCircle className="mr-1.5 h-4 w-4" />
                Interactive School Demo
              </Button>
            </Link>
            <Button onClick={() => setShowAddStudent((v) => !v)}>
              <UserPlus className="mr-1.5 h-4 w-4" />
              {showAddStudent ? 'Close Student Form' : 'Register Student'}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void loadAnalytics()}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
              {busy ? 'Refreshing…' : 'Refresh Data'}
            </Button>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-900"
          >
            {notice}
          </p>
        )}

        {/* SCHOOL STUDENT REGISTRATION DRAWER */}
        {showAddStudent && (
          <Card className="border-spark-300 shadow-lg">
            <div className="h-1.5 bg-gradient-to-r from-violet-600 via-spark-600 to-cyan-500" />
            <CardHeader>
              <CardTitle className="text-lg">Register an Under-18 Learner &amp; Link Parent/Guardian</CardTitle>
              <CardDescription>
                Schools and partner organisations can onboard students directly. Guardian contact details are required
                so the parent retains NDPA 2023 consent control.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Student Full Name</label>
                  <Input
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="e.g. Chidinma Okafor"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Date of Birth</label>
                  <Input type="date" value={studentDob} onChange={(e) => setStudentDob(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Class / Education Stage</label>
                  <select
                    value={studentStage}
                    onChange={(e) => setStudentStage(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-900"
                  >
                    {EDUCATION_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">School / Campus Name</label>
                  <Input
                    value={studentSchoolName}
                    onChange={(e) => setStudentSchoolName(e.target.value)}
                    placeholder="e.g. Queen's College Lagos"
                  />
                </div>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Parent / Guardian Full Name</label>
                  <Input
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    placeholder="e.g. Mr. Emeka Okafor"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Guardian Phone (+234…)</label>
                  <Input
                    type="tel"
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(e.target.value)}
                    placeholder="+2348012345678"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Guardian Email (optional)</label>
                  <Input
                    type="email"
                    value={guardianEmail}
                    onChange={(e) => setGuardianEmail(e.target.value)}
                    placeholder="parent@example.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700">Initial Curiosity &amp; Co-Curricular Areas:</p>
                <div className="flex flex-wrap gap-2">
                  {STUDENT_INTERESTS.map((interest) => {
                    const active = studentInterests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => toggleStudentInterest(interest)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                          active
                            ? 'border-spark-500 bg-spark-50 text-spark-900'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2.5">
                <Button variant="outline" onClick={() => setShowAddStudent(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={
                    busy ||
                    studentName.trim().length < 2 ||
                    guardianName.trim().length < 2 ||
                    guardianPhone.trim().length < 7 ||
                    studentInterests.length === 0
                  }
                  onClick={() => void handleRegisterStudent()}
                >
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  {busy ? 'Registering Student…' : 'Register Student & Generate Access ID'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* REGISTERED SCHOOL STUDENTS ROSTER */}
        {students.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Institution Student Roster ({students.length})</CardTitle>
              <CardDescription>
                Students registered under your school or organisation along with their unique Learner Access Code.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {students.map((st) => (
                  <div
                    key={st.learnerId}
                    className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-sm"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {st.fullName} <span className="text-xs font-medium text-slate-500">({st.educationStage})</span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        ID: <code className="font-mono">{st.accessCode}</code>
                      </p>
                    </div>
                    <Badge variant={st.consentStatus === 'VERIFIED_ACTIVE' ? 'success' : 'warning'}>
                      {st.consentStatus === 'VERIFIED_ACTIVE' ? 'Consent Active' : 'Pending Parent'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            {/* KPI Metric Strip */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardDescription>Onboarded Learners</CardDescription>
                    <span className="rounded-lg bg-spark-50 p-2 text-spark-600">
                      <UsersRound className="h-4 w-4" />
                    </span>
                  </div>
                  <CardTitle className="text-3xl font-extrabold text-slate-900">{data.totals.totalLearners}</CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardDescription>Guardian Consent Active</CardDescription>
                    <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                      <ShieldCheck className="h-4 w-4" />
                    </span>
                  </div>
                  <CardTitle className="text-3xl font-extrabold text-emerald-700">
                    {data.totals.verifiedConsentLearners}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardDescription>Verified Projects</CardDescription>
                    <span className="rounded-lg bg-cyan-50 p-2 text-cyan-600">
                      <FolderKanban className="h-4 w-4" />
                    </span>
                  </div>
                  <CardTitle className="text-3xl font-extrabold text-slate-900">
                    {data.totals.sealedArtifacts}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardDescription>Active Cohorts</CardDescription>
                    <span className="rounded-lg bg-amber-50 p-2 text-amber-600">
                      <Sparkles className="h-4 w-4" />
                    </span>
                  </div>
                  <CardTitle className="text-3xl font-extrabold text-slate-900">{data.totals.activeCohorts}</CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardDescription>Evidence Chain Audit</CardDescription>
                    <span className="rounded-lg bg-slate-100 p-2 text-slate-700">
                      <Activity className="h-4 w-4" />
                    </span>
                  </div>
                  <CardTitle className="pt-1 text-base">
                    <Badge variant={data.ledgerAudit.allValid ? 'success' : 'warning'}>
                      {data.ledgerAudit.allValid
                        ? `Verified (${data.ledgerAudit.totalEntries} records)`
                        : 'Integrity Alert'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Aggregate cohort metrics */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cohort Capability &amp; Skill Progression</CardTitle>
                  <CardDescription>
                    Active skill momentum across verified learners and mentor-reviewed evidence.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3.5">
                  {data.skillDistribution.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-sm text-slate-500">
                      No active skill states recorded yet.
                    </div>
                  ) : (
                    data.skillDistribution.map((skill) => {
                      const pct = Math.min(100, Math.round(skill.averageScore * 100));
                      return (
                        <div
                          key={skill.code}
                          className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 transition hover:bg-white"
                        >
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <div>
                              <span className="font-semibold text-slate-900">{skill.name}</span>
                              {skill.category && (
                                <span className="ml-2 text-xs font-medium text-slate-400">• {skill.category}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">
                                {skill.learnerCount} {skill.learnerCount === 1 ? 'learner' : 'learners'}
                              </span>
                              <Badge variant="outline">{pct}% avg</Badge>
                            </div>
                          </div>
                          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-spark-600 to-cyan-400 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Shared Student Portfolios</CardTitle>
                  <CardDescription>
                    Learners whose parents have approved sharing their portfolios with partner schools and programmes ({data.optedInLearnerCount} opted in).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
                    <p className="text-3xl font-extrabold text-slate-900">{data.optedInLearnerCount}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Learners with parent approval for partner discovery
                    </p>
                  </div>

                  {talentPool.length > 0 && (
                    <div className="space-y-2.5 pt-1">
                      {talentPool.map((learner) => (
                        <div
                          key={learner.learnerId}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white p-3 text-xs"
                        >
                          <div>
                            <p className="font-bold text-slate-900">{learner.displayName}</p>
                            <p className="text-slate-500">
                              {learner.schoolName ?? 'Independent Learner'} • {learner.artifactCount} verified projects
                            </p>
                            {learner.declaredInterests.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {learner.declaredInterests.slice(0, 3).map((interest) => (
                                  <Badge key={interest} variant="outline">
                                    {interest}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          {learner.allowPublicPortfolio && (
                            <Link
                              href={`/student/portfolio?learnerId=${encodeURIComponent(learner.learnerId)}`}
                              className="rounded-lg border border-spark-200 bg-spark-50 px-2.5 py-1.5 font-semibold text-spark-700 hover:bg-spark-100"
                            >
                              View Portfolio →
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Registered Partner Organisations */}
            {data.organisations.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-spark-600" />
                    <CardTitle className="text-base">
                      Registered Partner Schools &amp; Sponsors ({data.organisations.length})
                    </CardTitle>
                  </div>
                  <CardDescription>
                    Institutions and youth development partners collaborating on SparkTrack cohorts.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {data.organisations.map((org) => (
                      <div
                        key={org.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-sm"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{org.name}</p>
                          <p className="text-xs text-slate-500">
                            {org.orgType.replace(/_/g, ' ')} • {org.countryCode}
                          </p>
                        </div>
                        <Badge variant="outline">{org.subscriptionTier}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </main>
  );
}
