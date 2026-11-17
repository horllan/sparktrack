'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { BehaviouralSignal } from '@sparktrack/contracts';
import {
  ArrowRight,
  Badge,
  Building2,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Check,
  Compass,
  FolderKanban,
  HeartHandshake,
  Input,
  LogIn,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from '@sparktrack/ui';
import {
  DEMO_ACCOUNTS,
  DEMO_CASE_STUDIES,
  computeDemoState,
  type DemoCaseStudy,
  type DemoProjectArtifact,
  type DemoTrainingMilestone,
} from '../../lib/demo-case-studies';
import { createClient } from '../../lib/supabase/client';
import { PortfolioQrBadge } from '../../components/portfolio-qr-badge';
import {
  AnimatedTelemetryBars,
  CapabilityRadarChart,
  GrowthTrajectoryAreaChart,
  SignalDonutChart,
} from '../../components/charts/capability-charts';

type DemoPersona = 'student' | 'parent' | 'mentor' | 'school' | 'verifier';

const PERSONA_TABS: Array<{
  id: DemoPersona;
  stepNum: number;
  label: string;
  roleBadge: string;
  headline: string;
  talkingPoint: string;
  icon: typeof Compass;
}> = [
  {
    id: 'student',
    stepNum: 1,
    label: 'Student View',
    roleBadge: 'Step 1 · Student',
    headline: 'Multi-Year Journey, Trainings & Projects',
    talkingPoint:
      'Students choose their start year and log the trainings and projects they have completed, building a live 5-part skill profile.',
    icon: Compass,
  },
  {
    id: 'mentor',
    stepNum: 2,
    label: 'Mentor View',
    roleBadge: 'Step 2 · Mentor',
    headline: 'Quick Project Review & Skill Feedback',
    talkingPoint:
      'Teachers and mentors review student work in under three minutes—scoring quality, noting work habits, and adding feedback.',
    icon: UsersRound,
  },
  {
    id: 'parent',
    stepNum: 3,
    label: 'Parent View',
    roleBadge: 'Step 3 · Parent & Guardian',
    headline: '13-Part Progress Report & Privacy Settings',
    talkingPoint:
      'Parents manage child privacy settings and read an automatic 13-part report comparing initial interests with real project strengths.',
    icon: HeartHandshake,
  },
  {
    id: 'school',
    stepNum: 4,
    label: 'School View',
    roleBadge: 'Step 4 · School & Partner',
    headline: 'Student Roster, Year Filter & Talent Overview',
    talkingPoint:
      'School leaders and programme sponsors track progress across JSS1–SS3, vocational, and graduate tracks.',
    icon: Building2,
  },
  {
    id: 'verifier',
    stepNum: 5,
    label: 'Public Portfolio',
    roleBadge: 'Step 5 · Public Portfolio',
    headline: 'Verified Public Portfolio for Scholarships & Jobs',
    talkingPoint:
      'Scholarship boards and employers can verify completed trainings, project history, and mentor endorsements on one clean page.',
    icon: FolderKanban,
  },
];

const REPORT_SECTION_KEYS = [
  'executiveSummary',
  'participationHistory',
  'declaredVsObserved',
  'technicalSkills',
  'creativeSkills',
  'businessSkills',
  'behaviouralSignals',
  'capabilityMaturity',
  'careerPathways',
  'entrepreneurshipPathways',
  'longitudinalProgress',
  'recommendedNextSteps',
  'mentorInsights',
] as const;

type ReportTab = 'overview' | 'skills' | 'pathways' | 'next' | 'all';

const REPORT_TABS: Array<{
  id: ReportTab;
  label: string;
  keys: ReadonlyArray<(typeof REPORT_SECTION_KEYS)[number]>;
}> = [
  {
    id: 'overview',
    label: 'Overview & Trainings',
    keys: ['executiveSummary', 'participationHistory', 'declaredVsObserved'],
  },
  {
    id: 'skills',
    label: 'Skills & 5D Rubric',
    keys: ['technicalSkills', 'creativeSkills', 'businessSkills', 'behaviouralSignals', 'capabilityMaturity'],
  },
  {
    id: 'pathways',
    label: 'Career & Stream Pathways',
    keys: ['careerPathways', 'entrepreneurshipPathways'],
  },
  {
    id: 'next',
    label: 'Multi-Year Growth & Mentor Notes',
    keys: ['longitudinalProgress', 'recommendedNextSteps', 'mentorInsights'],
  },
  { id: 'all', label: 'All 13 Report Sections', keys: REPORT_SECTION_KEYS },
];

const MENTOR_SIGNALS: Array<{ key: BehaviouralSignal; label: string; hint: string }> = [
  { key: 'analytical_thinking', label: 'Analytical Thinking', hint: 'Breaks down problems step by step' },
  { key: 'persistence', label: 'Persistence & Grit', hint: 'Keeps iterating when something fails' },
  { key: 'problem_solving', label: 'Problem Solving', hint: 'Finds practical ways around obstacles' },
  { key: 'creativity', label: 'Creativity & Originality', hint: 'Tries original ideas or designs' },
  { key: 'initiative', label: 'Initiative & Ownership', hint: 'Takes ownership without waiting to be asked' },
];

function InteractiveDemoCenterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activePersona, setActivePersona] = useState<DemoPersona>('student');
  const [selectedCaseStudy, setSelectedCaseStudy] = useState<DemoCaseStudy>(DEMO_CASE_STUDIES[0]!);
  const [onboardingYear, setOnboardingYear] = useState<number>(DEMO_CASE_STUDIES[0]!.defaultOnboardingYear);
  const [selectedTrainingIds, setSelectedTrainingIds] = useState<string[]>(
    DEMO_CASE_STUDIES[0]!.trainings.map((t) => t.id),
  );
  const [extraTrainings, setExtraTrainings] = useState<DemoTrainingMilestone[]>([]);
  const [extraProjects, setExtraProjects] = useState<DemoProjectArtifact[]>([]);
  const [reportTab, setReportTab] = useState<ReportTab>('overview');

  // Guardian Privacy & Time-Travel Simulation State
  const [allowPublicPortfolio, setAllowPublicPortfolio] = useState(true);
  const [allowTalentDiscovery, setAllowTalentDiscovery] = useState(true);
  const [comparisonYear, setComparisonYear] = useState<number>(2024);

  // Mentor Interactive Rubric Simulation State
  const [mentorScore, setMentorScore] = useState('0.95');
  const [mentorComment, setMentorComment] = useState(
    'Exceptional systems thinking and clean execution—ready for advanced capstone showcase.',
  );
  const [mentorSignals, setMentorSignals] = useState<Record<string, number>>({
    analytical_thinking: 4,
    persistence: 4,
    problem_solving: 3,
  });

  // School Cohort Filter State
  const [schoolYearFilter, setSchoolYearFilter] = useState<'ALL' | 2023 | 2024 | 2025 | 2026>('ALL');

  // Live Auth Sandbox Drawer State
  const [showLiveLoginDrawer, setShowLiveLoginDrawer] = useState(false);
  const [signingInRole, setSigningInRole] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const handleSelectCaseStudy = useCallback((cs: DemoCaseStudy) => {
    setSelectedCaseStudy(cs);
    setOnboardingYear(cs.defaultOnboardingYear);
    setSelectedTrainingIds(cs.trainings.map((t) => t.id));
    setExtraTrainings([]);
    setExtraProjects([]);
    setAllowPublicPortfolio(cs.allowPublicPortfolio);
    setAllowTalentDiscovery(cs.allowPartnerTalentDiscovery);
    setNotice(
      `Now viewing ${cs.fullName} (${cs.badgeLabel}) with ${cs.trainings.length} trainings and ${cs.projects.length} projects.`,
    );
  }, []);

  useEffect(() => {
    const caseParam = searchParams.get('case');
    const roleParam = searchParams.get('role') as DemoPersona | null;
    if (caseParam) {
      const found = DEMO_CASE_STUDIES.find((c) => c.id === caseParam || c.learnerId === caseParam);
      if (found) handleSelectCaseStudy(found);
    }
    if (roleParam && PERSONA_TABS.some((p) => p.id === roleParam)) {
      setActivePersona(roleParam);
    }
  }, [searchParams, handleSelectCaseStudy]);

  const demoState = useMemo(
    () =>
      computeDemoState(
        selectedCaseStudy,
        onboardingYear,
        selectedTrainingIds,
        extraTrainings,
        extraProjects,
      ),
    [selectedCaseStudy, onboardingYear, selectedTrainingIds, extraTrainings, extraProjects],
  );

  const historicalComparisonState = useMemo(() => {
    const pastIds = selectedCaseStudy.trainings
      .filter((t) => t.year <= comparisonYear)
      .map((t) => t.id);
    return computeDemoState(
      selectedCaseStudy,
      selectedCaseStudy.defaultOnboardingYear,
      pastIds.length > 0 ? pastIds : [selectedCaseStudy.trainings[0]!.id],
    );
  }, [selectedCaseStudy, comparisonYear]);

  const allAvailableTrainings = useMemo(
    () => [...selectedCaseStudy.trainings, ...extraTrainings],
    [selectedCaseStudy, extraTrainings],
  );

  function handleOnboardingYearChange(year: number) {
    setOnboardingYear(year);
    const eligible = allAvailableTrainings.filter((t) => t.year >= year).map((t) => t.id);
    setSelectedTrainingIds(eligible);
    setNotice(
      `Start year set to ${year} (${2026 - year + 1}-year record). Skills, timeline, and the 13-part report have been updated.`,
    );
  }

  function toggleTraining(trainingId: string) {
    setSelectedTrainingIds((prev) =>
      prev.includes(trainingId) ? prev.filter((id) => id !== trainingId) : [...prev, trainingId],
    );
  }

  function handleSimulateNewAchievement() {
    const templates = selectedCaseStudy.autoGenerateTemplates;
    const template = templates[extraTrainings.length % templates.length]!;
    const idx = extraTrainings.length + 1;
    const newTrainingId = `trn-sim-${selectedCaseStudy.id}-${idx}`;
    const newTraining: DemoTrainingMilestone = {
      id: newTrainingId,
      year: 2026,
      title: idx > 1 ? `${template.trainingTitle} (Part ${idx})` : template.trainingTitle,
      programmeType: template.programmeType,
      provider: template.provider,
      durationHours: template.durationHours,
      certificateHash: `CERT-${Date.now().toString(16).slice(-8).toUpperCase()}`,
      skillsGained: template.skillCodes,
      summary: `Completed training milestone for ${selectedCaseStudy.fullName}.`,
    };
    const newProject: DemoProjectArtifact = {
      id: `proj-sim-${selectedCaseStudy.id}-${idx}`,
      trainingId: newTrainingId,
      year: 2026,
      capturedOfflineAt: new Date().toISOString(),
      artifactType: template.artifactType,
      title: idx > 1 ? `${template.projectTitle} v${idx}.0` : template.projectTitle,
      description: template.projectDescription,
      skillCodes: template.skillCodes,
      qualityScore: template.qualityScore,
      mentorVerified: true,
      mentorName: selectedCaseStudy.mentorName,
      mentorFeedback: template.mentorFeedback,
      ledgerSeq: 79 + idx,
      rowSignatureHash: `${Date.now().toString(16)}9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e`,
    };
    setExtraTrainings((prev) => [...prev, newTraining]);
    setExtraProjects((prev) => [newProject, ...prev]);
    setSelectedTrainingIds((prev) => [...prev, newTrainingId]);
    setNotice(
      `Added "${newTraining.title}" and "${newProject.title}". All 13 report sections have been updated.`,
    );
  }

  function handleMentorVerifySimulation() {
    const idx = extraProjects.length + 1;
    const targetTraining =
      demoState.activeTrainings[demoState.activeTrainings.length - 1] ?? selectedCaseStudy.trainings[0]!;
    const signalSummary = Object.entries(mentorSignals)
      .map(([k, v]) => `${k.replace(/_/g, ' ')} (${v}/4)`)
      .join(', ');
    const newProject: DemoProjectArtifact = {
      id: `proj-mentor-${Date.now()}`,
      trainingId: targetTraining.id,
      year: 2026,
      capturedOfflineAt: new Date().toISOString(),
      artifactType: 'PROJECT_SUBMISSION',
      title: `${selectedCaseStudy.fullName.split(' ')[0]}’s Reviewed Project #${idx}`,
      description: `Reviewed by mentor with strong ratings in: ${signalSummary}.`,
      skillCodes: targetTraining.skillsGained,
      qualityScore: Number(mentorScore),
      mentorVerified: true,
      mentorName: selectedCaseStudy.mentorName,
      mentorFeedback: mentorComment,
      ledgerSeq: 84 + idx,
      rowSignatureHash: `${Date.now().toString(16)}7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b`,
    };
    setExtraProjects((prev) => [newProject, ...prev]);
    setNotice(
      `Saved mentor review (${Math.round(Number(mentorScore) * 100)}%). Open the Parent View tab to see it in Section 13 of the report.`,
    );
  }

  async function handleLiveAccountSignIn(account: (typeof DEMO_ACCOUNTS)[number]) {
    setSigningInRole(account.role);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      });
      if (error) {
        setNotice('Live workspace accounts are not active right now. You can explore every feature right here in the interactive demo.');
      } else {
        router.push(account.href);
      }
    } finally {
      setSigningInRole(null);
    }
  }

  const activePersonaMeta = PERSONA_TABS.find((p) => p.id === activePersona) ?? PERSONA_TABS[0]!;
  const currentStepIndex = PERSONA_TABS.findIndex((p) => p.id === activePersona);
  const visibleReportKeys = REPORT_TABS.find((t) => t.id === reportTab)?.keys ?? REPORT_SECTION_KEYS;

  const filteredSchoolCases = useMemo(() => {
    if (schoolYearFilter === 'ALL') return DEMO_CASE_STUDIES;
    return DEMO_CASE_STUDIES.filter((cs) => cs.trainings.some((t) => t.year === schoolYearFilter));
  }, [schoolYearFilter]);

  return (
    <main className="min-h-screen bg-slate-50/60 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-[1440px] space-y-6">
        {/* INTERACTIVE DEMO HEADER */}
        <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-spark-950 p-6 text-white shadow-2xl sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3.5 py-1 text-xs font-extrabold uppercase tracking-[0.14em] text-emerald-300">
                <PlayCircle size={14} />
                <span>Interactive Product Demo</span>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
                Explore SparkTrack Across Every Role
              </h1>
              <p className="max-w-3xl text-sm leading-relaxed text-slate-300">
                Choose a student profile below, adjust their <strong>Start Year (2023–2026)</strong> and{' '}
                <strong>Completed Trainings</strong>, and switch between the student, mentor, parent, school, and public
                portfolio views to see how reports update automatically.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                size="sm"
                onClick={handleSimulateNewAchievement}
                className="bg-emerald-600 text-xs font-extrabold text-white hover:bg-emerald-500"
              >
                <Sparkles size={14} className="mr-1.5" />
                + Add Sample Training &amp; Project
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowLiveLoginDrawer((v) => !v)}
                className="border-slate-700 bg-slate-800/90 text-xs font-bold text-white hover:bg-slate-700"
              >
                <LogIn size={14} className="mr-1.5" />
                {showLiveLoginDrawer ? 'Hide Role Workspaces' : 'Open Role Workspaces'}
              </Button>
            </div>
          </div>

          {/* 1-Click Role Workspace Switcher */}
          {showLiveLoginDrawer && (
            <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-900/95 p-4">
              <div className="mb-3">
                <p className="text-xs font-bold text-white">Open Full Role Dashboards</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                  Switch directly into the full workspace for any role below:
                </p>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
                {DEMO_ACCOUNTS.map((acc) => (
                  <div
                    key={acc.role}
                    className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-spark-300">{acc.label}</span>
                      <p className="mt-1 font-bold text-white">{acc.name}</p>
                    </div>
                    <Button
                      size="sm"
                      disabled={signingInRole === acc.role}
                      onClick={() => void handleLiveAccountSignIn(acc)}
                      className="mt-3 w-full bg-spark-600 text-xs font-bold text-white hover:bg-spark-500"
                    >
                      {signingInRole === acc.role ? 'Opening…' : 'Open Workspace'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CASE STUDY SELECTOR DECK */}
          <div className="mt-6 border-t border-slate-800 pt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-spark-300">
                1. Choose a Student or Graduate Profile:
              </span>
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                <ShieldCheck size={13} className="mr-1" /> Live 13-Part Report
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {DEMO_CASE_STUDIES.map((cs) => {
                const selected = cs.id === selectedCaseStudy.id;
                return (
                  <button
                    key={cs.id}
                    type="button"
                    onClick={() => handleSelectCaseStudy(cs)}
                    className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition-all ${
                      selected
                        ? 'border-emerald-400 bg-emerald-950/60 text-white shadow-lg ring-2 ring-emerald-400/40'
                        : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800/90'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                          {cs.badgeLabel}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-extrabold text-white">
                        {cs.fullName} ({cs.age} yrs)
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold text-spark-200">{cs.organisationName}</p>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-300">{cs.caseStudySubtitle}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-1 border-t border-slate-800 pt-2.5 text-[11px] font-semibold text-slate-300">
                      <span>Started {cs.defaultOnboardingYear}</span>
                      <span>• {cs.trainings.length} Trainings</span>
                      <span>• {cs.projects.length} Projects</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* GUIDED TOUR ROLE PERSPECTIVE STEPPER (1 to 5) */}
          <div className="mt-6 border-t border-slate-800 pt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-spark-300">
                2. Choose a Role View (Step {currentStepIndex + 1} of 5):
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentStepIndex === 0}
                  onClick={() => setActivePersona(PERSONA_TABS[currentStepIndex - 1]!.id)}
                  className="h-8 border-slate-700 bg-slate-800 px-3 text-xs text-white hover:bg-slate-700"
                >
                  ← Previous
                </Button>
                <Button
                  size="sm"
                  disabled={currentStepIndex === PERSONA_TABS.length - 1}
                  onClick={() => setActivePersona(PERSONA_TABS[currentStepIndex + 1]!.id)}
                  className="h-8 bg-spark-600 px-3 text-xs font-bold text-white hover:bg-spark-500"
                >
                  Next →
                </Button>
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              {PERSONA_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activePersona === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActivePersona(tab.id)}
                    className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                      active
                        ? 'border-spark-400 bg-spark-600/35 text-white shadow-md ring-2 ring-spark-400/40'
                        : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        active ? 'bg-spark-500 text-white' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      <Icon size={17} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-spark-300">
                        Step {tab.stepNum}
                      </p>
                      <p className="truncate text-xs font-extrabold text-white">{tab.label}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Role Summary Bar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-spark-500/30 bg-spark-950/60 px-4 py-3 text-xs text-spark-100">
              <div className="flex items-center gap-2.5">
                <Badge variant="competent">{activePersonaMeta.roleBadge}</Badge>
                <span className="font-medium leading-relaxed">{activePersonaMeta.talkingPoint}</span>
              </div>
            </div>
          </div>
        </section>

        {notice && (
          <p
            role="status"
            className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950 shadow-2xs"
          >
            {notice}
          </p>
        )}

        {/* GLOBAL PARAMETER SIMULATOR BAR (Start Year & Trainings Completed) */}
        <Card className="border-spark-200/90 bg-white shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-[0.34fr_0.66fr]">
              {/* Left: Start Year Selector & Summary */}
              <div className="space-y-3 border-b border-slate-100 pb-4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                    Start Year
                  </span>
                  <Badge variant="competent">{demoState.yearsActive}-Year Record</Badge>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[2023, 2024, 2025, 2026].map((yr) => {
                    const active = onboardingYear === yr;
                    return (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => handleOnboardingYearChange(yr)}
                        className={`rounded-xl border py-2.5 text-center text-sm font-extrabold transition-all ${
                          active
                            ? 'border-spark-600 bg-spark-600 text-white shadow-sm'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-spark-300 hover:bg-white'
                        }`}
                      >
                        {yr}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs leading-relaxed text-slate-600">
                  <strong>{selectedCaseStudy.fullName}</strong> started in <strong>{onboardingYear}</strong> with{' '}
                  <strong>{demoState.activeTrainings.length} trainings</strong> ({demoState.totalHoursTrained} hrs) and{' '}
                  <strong>{demoState.activeProjects.length} projects</strong>.
                </p>
              </div>

              {/* Right: Trainings & Bootcamps Completed */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                    Completed Trainings &amp; Courses (Click to Include or Exclude)
                  </span>
                  <Button size="sm" variant="outline" onClick={handleSimulateNewAchievement}>
                    <Sparkles size={13} className="mr-1" />+ Add Sample Training &amp; Project
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {allAvailableTrainings.map((trn) => {
                    const eligible = trn.year >= onboardingYear;
                    const checked = eligible && selectedTrainingIds.includes(trn.id);
                    return (
                      <button
                        key={trn.id}
                        type="button"
                        disabled={!eligible}
                        onClick={() => toggleTraining(trn.id)}
                        className={`flex items-start justify-between gap-2 rounded-xl border p-3 text-left text-xs transition-all ${
                          !eligible
                            ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-40'
                            : checked
                              ? 'border-emerald-400 bg-emerald-50/70 text-slate-900 shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            readOnly
                            className="mt-0.5 pointer-events-none"
                          />
                          <div>
                            <p className="font-bold text-slate-900">
                              {trn.title}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {trn.provider} • {trn.durationHours} hrs
                            </p>
                          </div>
                        </div>
                        <Badge variant={checked ? 'competent' : 'outline'}>{trn.year}</Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* =====================================================================
            VIEW 1: STUDENT / EXPLORER WORKSPACE SIMULATION
           ===================================================================== */}
        {activePersona === 'student' && (
          <div className="space-y-6">
            {/* Student Profile & Longitudinal Growth Strip */}
            <div className="grid gap-6 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge variant="competent">{selectedCaseStudy.educationStage}</Badge>
                    <Badge variant="outline">ID: {selectedCaseStudy.accessCode}</Badge>
                  </div>
                  <CardTitle className="mt-2 text-lg">{selectedCaseStudy.fullName}</CardTitle>
                  <CardDescription>
                    {selectedCaseStudy.educationLevel} • {selectedCaseStudy.organisationName}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5 text-xs">
                  <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2">
                    <span className="text-slate-500">Current Role</span>
                    <span className="font-bold text-slate-900">{selectedCaseStudy.currentRole}</span>
                  </div>
                  <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2">
                    <span className="text-slate-500">Target Pathway</span>
                    <span className="font-bold text-spark-700">{selectedCaseStudy.targetRole}</span>
                  </div>
                  <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2">
                    <span className="text-slate-500">Initial Declared Interest</span>
                    <span className="font-bold text-slate-800">{selectedCaseStudy.declaredInterests.join(', ')}</span>
                  </div>
                  <div className="flex justify-between rounded-xl bg-emerald-50 px-3 py-2">
                    <span className="text-emerald-800">Observed Top Strength</span>
                    <span className="font-bold text-emerald-950">{selectedCaseStudy.observedTopDomains[0]}</span>
                  </div>
                </CardContent>
              </Card>

              {/* 5-Dimension Mastery Rubric */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">5-Dimension Rubric Mastery</CardTitle>
                    <Badge variant="advanced">Auto-Computed</Badge>
                  </div>
                  <CardDescription>
                    Synthesized from {demoState.activeProjects.length} projects and mentor signal observations.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: 'Execution & Craft', val: demoState.rubric.execution },
                    { label: 'Problem Solving & Logic', val: demoState.rubric.problemSolving },
                    { label: 'Creativity & Originality', val: demoState.rubric.creativity },
                    { label: 'Iteration & Grit', val: demoState.rubric.iteration },
                    { label: 'Independence', val: demoState.rubric.independence },
                  ].map((dim) => (
                    <div key={dim.label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-700">{dim.label}</span>
                        <span className="font-extrabold text-spark-700">{dim.val}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-spark-600 to-emerald-500 transition-all duration-300"
                          style={{ width: `${dim.val}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Evolving Skill Signals */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Verified Skill Signals</CardTitle>
                    <Badge variant="secondary">{demoState.skillScores.length} Skills</Badge>
                  </div>
                  <CardDescription>Domain skills unlocked across {onboardingYear}–2026 trainings.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {demoState.skillScores.map((s) => (
                    <div key={s.code} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate pr-2 font-semibold text-slate-800">{s.name}</span>
                        <Badge
                          variant={
                            s.progression.toLowerCase() as 'beginner' | 'developing' | 'competent' | 'advanced'
                          }
                        >
                          {s.progression} ({Math.round(s.score * 100)}%)
                        </Badge>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-spark-600 transition-all"
                          style={{ width: `${Math.round(s.score * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Interactive Charts Strip (Matches Production Student View) */}
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Your Skill Shape</CardTitle>
                  <CardDescription>
                    Interactive view of {selectedCaseStudy.fullName.split(' ')[0]}’s strongest skills across {onboardingYear}–2026.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CapabilityRadarChart
                    items={demoState.skillScores.map((s) => ({
                      label: s.name,
                      value: Math.round(s.score * 100),
                      meta: s.progression,
                      detail: `${s.evidenceCount} ${s.evidenceCount === 1 ? 'project' : 'projects'}`,
                    }))}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Project Mix &amp; Momentum</CardTitle>
                  <CardDescription>
                    Mentor verification status and growth across {onboardingYear}–2026.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <SignalDonutChart
                    centerLabel={String(demoState.activeProjects.length)}
                    centerSublabel="Confirmed Projects"
                    segments={[
                      {
                        label: 'Mentor Verified',
                        value: demoState.activeProjects.filter((a) => a.mentorVerified).length,
                        color: '#059669',
                      },
                      {
                        label: 'Awaiting Review',
                        value: demoState.activeProjects.filter((a) => !a.mentorVerified).length,
                        color: '#2563eb',
                      },
                    ]}
                  />
                  <GrowthTrajectoryAreaChart
                    points={demoState.timeline.map((pt) => ({
                      label: String(pt.year),
                      value: pt.compositeMasteryPct,
                      detail: `${pt.projectsVerified} verified projects`,
                    }))}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Year-by-Year Growth Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Year-by-Year Skill Growth ({onboardingYear} → 2026)
                </CardTitle>
                <CardDescription>
                  How {selectedCaseStudy.fullName.split(' ')[0]} progressed each year from their first training to
                  advanced projects.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {demoState.timeline.map((pt) => (
                  <div key={pt.year} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-slate-900">{pt.year}</span>
                      <Badge variant="competent">{pt.compositeMasteryPct}% Mastery</Badge>
                    </div>
                    <p className="mt-1 font-bold text-spark-700">{pt.stageLabel}</p>
                    <p className="mt-1 text-slate-600">
                      {pt.trainingsCompleted} training(s) • {pt.projectsVerified} verified project(s)
                    </p>
                    <p className="mt-2 rounded-lg bg-white p-2 text-[11px] font-medium leading-relaxed text-slate-700">
                      ★ {pt.highlight}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Student's Completed Projects & Recommended Paths */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Completed Projects ({demoState.activeProjects.length})
                  </CardTitle>
                  <CardDescription>
                    Projects built during {onboardingYear}–2026 trainings with mentor feedback.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {demoState.activeProjects.map((art) => (
                    <div key={art.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {art.title} ({art.year})
                        </span>
                        <Badge variant={art.mentorVerified ? 'competent' : 'developing'}>
                          {art.mentorVerified
                            ? `Reviewed (${art.qualityScore !== null ? `${Math.round(art.qualityScore * 100)}%` : '✓'})`
                            : 'Awaiting Review'}
                        </Badge>
                      </div>
                      <p className="leading-relaxed text-slate-600">{art.description}</p>
                      <p className="rounded-xl bg-slate-50 px-3 py-2 italic leading-relaxed text-slate-700">
                        “{art.mentorFeedback}” — <strong>{art.mentorName}</strong>
                      </p>
                      <p className="font-mono text-[10px] text-slate-400">
                        Record #{art.ledgerSeq} • Verification ID: {art.rowSignatureHash.slice(0, 16).toUpperCase()}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recommended Study &amp; Career Paths</CardTitle>
                  <CardDescription>
                    Career, subject stream, and venture matches based on completed projects.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedCaseStudy.pathways.map((p) => (
                    <div key={p.pathwayCode} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900">{p.pathwayName}</span>
                        <Badge variant="competent">{Math.round(p.affinityScore * 100)}% Match</Badge>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-600">{p.rationale}</p>
                      {p.isDivergentFromDeclared && (
                        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-relaxed text-amber-900">
                          ★ New Strength Discovered: Uncovered through hands-on project work beyond initial interests.
                        </p>
                      )}
                    </div>
                  ))}
                  <div className="pt-2">
                    <Button className="w-full" onClick={() => setActivePersona('parent')}>
                      View Full 13-Part Progress Report (Parent View) <ArrowRight size={15} className="ml-1.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* =====================================================================
            VIEW 2: MENTOR REVIEW STUDIO
           ===================================================================== */}
        {activePersona === 'mentor' && (
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Projects Reviewed by {selectedCaseStudy.mentorName}
                </CardTitle>
                <CardDescription>
                  Mentors review student work in under three minutes, turning completed projects into verified skill records.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {demoState.activeProjects.map((proj) => (
                  <div key={proj.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {proj.title} ({proj.year})
                      </span>
                      <Badge variant={proj.mentorVerified ? 'competent' : 'warning'}>
                        {proj.mentorVerified
                          ? `Verified (${proj.qualityScore ? `${Math.round(proj.qualityScore * 100)}%` : '✓'})`
                          : 'Awaiting Review'}
                      </Badge>
                    </div>
                    <p className="mt-1.5 leading-relaxed text-slate-600">{proj.description}</p>
                    <p className="mt-2 font-mono text-[10px] text-slate-400">
                      Student: {selectedCaseStudy.fullName} ({selectedCaseStudy.accessCode}) • Record #{proj.ledgerSeq}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-spark-300">
              <CardHeader>
                <CardTitle className="text-base">
                  Quick Mentor Review ({selectedCaseStudy.fullName})
                </CardTitle>
                <CardDescription>
                  Adjust the project quality score and work habits below, then click Save Review to add a new verified
                  project and update {selectedCaseStudy.fullName.split(' ')[0]}’s 13-part report.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                  <div className="flex justify-between text-sm font-bold">
                    <span>Project Quality Score</span>
                    <span className="text-spark-700">{Math.round(Number(mentorScore) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.60"
                    max="1.00"
                    step="0.01"
                    value={mentorScore}
                    onChange={(e) => setMentorScore(e.target.value)}
                    className="w-full accent-spark-600"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Observed Work Habits (1–4 Scale)
                  </p>
                  {MENTOR_SIGNALS.map((sig) => {
                    const active = sig.key in mentorSignals;
                    const lvl = mentorSignals[sig.key] ?? 3;
                    return (
                      <div key={sig.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            setMentorSignals((prev) => {
                              const next = { ...prev };
                              if (sig.key in next) delete next[sig.key];
                              else next[sig.key] = 4;
                              return next;
                            })
                          }
                          className="flex items-center gap-2 font-bold text-slate-900"
                        >
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded border ${
                              active ? 'border-spark-600 bg-spark-600 text-white' : 'border-slate-300'
                            }`}
                          >
                            {active && <Check size={11} />}
                          </span>
                          <span>{sig.label}</span>
                        </button>
                        {active && (
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setMentorSignals((prev) => ({ ...prev, [sig.key]: n }))}
                                className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${
                                  lvl === n
                                    ? 'border-spark-600 bg-spark-600 text-white'
                                    : 'border-slate-200 bg-slate-50 text-slate-700'
                                }`}
                              >
                                {n}/4
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <label className="block space-y-1 text-xs font-bold text-slate-700">
                  Mentor Feedback Note (Included in Section 13 of Report)
                  <Input value={mentorComment} onChange={(e) => setMentorComment(e.target.value)} />
                </label>

                <Button className="w-full" size="lg" onClick={handleMentorVerifySimulation}>
                  <Sparkles size={16} className="mr-2" />
                  Save Mentor Review &amp; Update Report
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Live Observation Signal Preview</CardTitle>
                <CardDescription>
                  Updates dynamically as you adjust the work-habit ratings above—identical to the live Mentor Studio.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-2">
                <CapabilityRadarChart
                  items={MENTOR_SIGNALS.map((sig) => ({
                    label: sig.label,
                    value: ((mentorSignals[sig.key] ?? 0) / 4) * 100,
                    meta: mentorSignals[sig.key] ? `${mentorSignals[sig.key]}/4 rating` : 'Not selected',
                    detail: 'Behavioural growth indicator',
                  }))}
                />
                <SignalDonutChart
                  centerLabel={String(demoState.activeProjects.length)}
                  centerSublabel="Student Projects"
                  segments={[
                    {
                      label: 'Verified by Mentor',
                      value: demoState.activeProjects.filter((p) => p.mentorVerified).length,
                      color: '#059669',
                    },
                    {
                      label: 'Awaiting Review',
                      value: demoState.activeProjects.filter((p) => !p.mentorVerified).length,
                      color: '#2563eb',
                    },
                  ]}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* =====================================================================
            VIEW 3: PARENT & GUARDIAN 13-SECTION REPORT & PRIVACY CONTROLS
           ===================================================================== */}
        {activePersona === 'parent' && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Family Privacy &amp; Sharing Settings</CardTitle>
                    <Badge variant="success">Verified</Badge>
                  </div>
                  <CardDescription>
                    Guardian: <strong>{selectedCaseStudy.guardianName ?? 'Adult Learner (18+)'}</strong> •{' '}
                    {selectedCaseStudy.consentMethod === 'SMS_OTP' ? 'Phone Code Verified' : 'Self-Verified'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex flex-wrap gap-6 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowPublicPortfolio}
                        onChange={(e) => setAllowPublicPortfolio(e.target.checked)}
                      />
                      <span>Allow Public Portfolio Link</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowTalentDiscovery}
                        onChange={(e) => setAllowTalentDiscovery(e.target.checked)}
                      />
                      <span>Allow Scholarship &amp; Employer Matching</span>
                    </label>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Compare Progress Over Time</CardTitle>
                    <Badge variant="outline">Past Year vs. 2026</Badge>
                  </div>
                  <CardDescription>
                    Compare {selectedCaseStudy.fullName.split(' ')[0]}’s skills in an earlier year with where they are today.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700">Compare Year:</span>
                    {[2023, 2024, 2025].map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => setComparisonYear(yr)}
                        className={`rounded-lg border px-2.5 py-1 font-bold ${
                          comparisonYear === yr
                            ? 'border-spark-600 bg-spark-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-50 p-3">
                    {historicalComparisonState.skillScores.map((s) => (
                      <Badge key={s.code} variant="competent">
                        {s.name}: {Math.round(Math.max(0.5, s.score - 0.14) * 100)}% in {comparisonYear} →{' '}
                        {Math.round(s.score * 100)}% in 2026
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Auto-Generated 13-Section Progress Report */}
            <Card className="border-emerald-300 shadow-md">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Badge variant="competent">13-Part Progress Report</Badge>
                      <Badge variant="outline">{demoState.report.parametersSummary}</Badge>
                      <Badge variant="success">Reviewed &amp; Child-Safe</Badge>
                    </div>
                    <CardTitle className="text-xl">
                      {selectedCaseStudy.fullName} — Student Progress Report (Edition v{demoState.report.version})
                    </CardTitle>
                    <CardDescription>
                      Generated from Start Year ({onboardingYear}), {demoState.activeTrainings.length} Trainings (
                      {demoState.totalHoursTrained} hrs), and {demoState.activeProjects.length} Verified Projects.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="no-print"
                    onClick={() => window.print()}
                  >
                    Print / Save PDF
                  </Button>
                </div>

                <div className="no-print mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  {REPORT_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setReportTab(tab.id)}
                      className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                        reportTab === tab.id
                          ? 'bg-spark-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-5 lg:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2">
                    <p className="mb-1 text-sm font-bold text-slate-900">Observed Skill Shape</p>
                    <p className="mb-3 text-xs text-slate-500">
                      Interactive view of the skills demonstrated across verified projects.
                    </p>
                    <CapabilityRadarChart
                      items={demoState.skillScores.map((s) => ({
                        label: s.name,
                        value: Math.round(s.score * 100),
                        meta: s.progression,
                        detail: `${s.evidenceCount} ${s.evidenceCount === 1 ? 'project' : 'projects'}`,
                      }))}
                    />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="mb-1 text-sm font-bold text-slate-900">Skill Maturity Mix</p>
                    <p className="mb-3 text-xs text-slate-500">
                      How skills are distributed across learning stages.
                    </p>
                    <SignalDonutChart
                      centerLabel={String(demoState.skillScores.length)}
                      centerSublabel="Active Skills"
                      segments={[
                        {
                          label: 'Advanced',
                          value: demoState.skillScores.filter((s) => s.progression === 'ADVANCED').length,
                          color: '#059669',
                        },
                        {
                          label: 'Competent',
                          value: demoState.skillScores.filter((s) => s.progression === 'COMPETENT').length,
                          color: '#2563eb',
                        },
                        {
                          label: 'Developing',
                          value: demoState.skillScores.filter((s) => s.progression === 'DEVELOPING').length,
                          color: '#0891b2',
                        },
                        {
                          label: 'Beginner',
                          value: demoState.skillScores.filter((s) => s.progression === 'BEGINNER').length,
                          color: '#d97706',
                        },
                      ]}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="mb-1 text-sm font-bold text-slate-900">
                    Career &amp; Entrepreneurship Pathways Worth Exploring
                  </p>
                  <p className="mb-3 text-xs text-slate-500">
                    Match strength based on current project evidence—options to try, not fixed predictions.
                  </p>
                  <AnimatedTelemetryBars
                    items={selectedCaseStudy.pathways.map((p) => ({
                      label: p.pathwayName,
                      value: Math.round(p.affinityScore * 100),
                      badge: p.isDivergentFromDeclared ? 'New strength' : p.pathwayType.replace(/_/g, ' '),
                      subtitle: p.rationale,
                    }))}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                {visibleReportKeys.map((key) => {
                  const sec = demoState.report[key];
                  const idx = REPORT_SECTION_KEYS.indexOf(key);
                  const wide =
                    key === 'executiveSummary' ||
                    key === 'participationHistory' ||
                    key === 'declaredVsObserved' ||
                    key === 'longitudinalProgress';
                  return (
                    <div
                      key={key}
                      className={`rounded-2xl border border-slate-200 bg-slate-50/70 p-5 ${
                        wide ? 'md:col-span-2' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-extrabold text-slate-900">
                          {idx + 1}. {sec.title}
                        </h3>
                        {key === 'declaredVsObserved' && (
                          <Badge variant="developing">Interests vs. Demonstrated Strengths</Badge>
                        )}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-700">{sec.narrative}</p>
                    </div>
                  );
                })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* =====================================================================
            VIEW 4: SCHOOL & PARTNER OVERVIEW
           ===================================================================== */}
        {activePersona === 'school' && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Featured Student Profiles</CardDescription>
                  <CardTitle className="text-3xl font-extrabold text-slate-900">{DEMO_CASE_STUDIES.length}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Total Supervised Training Hours</CardDescription>
                  <CardTitle className="text-3xl font-extrabold text-spark-700">659 hrs</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Mentor-Reviewed Projects</CardDescription>
                  <CardTitle className="text-3xl font-extrabold text-emerald-700">
                    {DEMO_CASE_STUDIES.reduce((a, b) => a + b.projects.length, 0) + extraProjects.length}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Record Verification Status</CardDescription>
                  <CardTitle className="pt-1 text-base">
                    <Badge variant="success">100% Verified</Badge>
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Institution Skill Profile ({selectedCaseStudy.organisationName})</CardTitle>
                  <CardDescription>
                    Aggregated capability shape across the selected learner cohort.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CapabilityRadarChart
                    items={demoState.skillScores.map((s) => ({
                      label: s.name,
                      value: Math.round(s.score * 100),
                      meta: s.progression,
                      detail: `${s.evidenceCount} projects`,
                    }))}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Learner Track Distribution</CardTitle>
                  <CardDescription>
                    Breakdown across secondary, university, vocational, and independent tracks.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SignalDonutChart
                    centerLabel={String(DEMO_CASE_STUDIES.length)}
                    centerSublabel="Tracks Active"
                    segments={DEMO_CASE_STUDIES.map((cs, i) => ({
                      label: cs.educationStage,
                      value: cs.projects.length,
                      color: ['#2563eb', '#059669', '#0891b2', '#7c3aed'][i % 4],
                    }))}
                  />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      Student &amp; Graduate Roster ({filteredSchoolCases.length})
                    </CardTitle>
                    <CardDescription>
                      Filter across secondary school, vocational, and graduate tracks by training year.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(['ALL', 2023, 2024, 2025, 2026] as const).map((yr) => (
                      <button
                        key={String(yr)}
                        type="button"
                        onClick={() => setSchoolYearFilter(yr)}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${
                          schoolYearFilter === yr
                            ? 'border-spark-600 bg-spark-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        {yr === 'ALL' ? 'All Years (2023–26)' : yr}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {filteredSchoolCases.map((cs) => (
                  <div
                    key={cs.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-extrabold text-slate-900">
                          {cs.fullName} ({cs.age} yrs · {cs.educationStage})
                        </span>
                        <Badge variant="success">{cs.accessCode}</Badge>
                      </div>
                      <p className="mt-1.5 leading-relaxed text-slate-600">
                        <strong>Organisation:</strong> {cs.organisationName} • <strong>Started:</strong>{' '}
                        {cs.defaultOnboardingYear}
                      </p>
                      <p className="mt-1 leading-relaxed text-slate-600">
                        <strong>Goal:</strong> {cs.targetRole}
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {cs.observedTopDomains.map((d) => (
                          <Badge key={d} variant="secondary">
                            {d}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200/70 pt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          handleSelectCaseStudy(cs);
                          setActivePersona('parent');
                        }}
                      >
                        View 13-Part Report
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          handleSelectCaseStudy(cs);
                          setActivePersona('verifier');
                        }}
                      >
                        Open Public Portfolio
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* =====================================================================
            VIEW 5: PUBLIC PORTFOLIO
           ===================================================================== */}
        {activePersona === 'verifier' && (
          <Card className="border-emerald-300">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-xl">
                    Verified Public Portfolio — {selectedCaseStudy.fullName} ({selectedCaseStudy.accessCode})
                  </CardTitle>
                  <CardDescription>
                    {selectedCaseStudy.organisationName} • Started {onboardingYear} •{' '}
                    {demoState.activeTrainings.length} Completed Trainings ({demoState.totalHoursTrained} hrs)
                  </CardDescription>
                </div>
                <div className="no-print flex flex-wrap items-center gap-2">
                  <Badge variant="advanced">
                    <ShieldCheck size={14} className="mr-1" />
                    {allowPublicPortfolio
                      ? 'Guardian Approved • Public Sharing On'
                      : 'Private (Public Sharing Off)'}
                  </Badge>
                  {allowPublicPortfolio && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/p/${selectedCaseStudy.shareToken}`)}
                      >
                        Open Share Link (/p/{selectedCaseStudy.shareToken})
                      </Button>
                      <Button size="sm" onClick={() => window.print()}>
                        Print / Save PDF
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {!allowPublicPortfolio ? (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm leading-relaxed text-amber-950">
                  <strong>Portfolio Set to Private:</strong> Public sharing is currently turned off in Step 3. Turn on{' '}
                  &ldquo;Allow Public Portfolio Link&rdquo; in the Parent View tab to make this page visible.
                </div>
              ) : (
                <>
                  <PortfolioQrBadge
                    token={selectedCaseStudy.shareToken}
                    label="Verified Share Link & QR Seal"
                    subtitle="Included on printed and PDF capability portfolios for instant verification"
                  />
                  <div className="grid gap-5 lg:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2">
                      <p className="mb-1 text-sm font-bold text-slate-900">Verified Capability Profile</p>
                      <p className="mb-3 text-xs text-slate-500">
                        Hover or tap any axis to inspect verified mastery and supporting project counts.
                      </p>
                      <CapabilityRadarChart
                        items={demoState.skillScores.map((s) => ({
                          label: s.name,
                          value: Math.round(s.score * 100),
                          meta: s.progression,
                          detail: `${s.evidenceCount} ${s.evidenceCount === 1 ? 'project' : 'projects'}`,
                        }))}
                      />
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="mb-1 text-sm font-bold text-slate-900">Verification &amp; Growth</p>
                      <p className="mb-3 text-xs text-slate-500">
                        Longitudinal progression across {onboardingYear}–2026.
                      </p>
                      <GrowthTrajectoryAreaChart
                        points={demoState.timeline.map((pt) => ({
                          label: String(pt.year),
                          value: pt.compositeMasteryPct,
                          detail: `${pt.projectsVerified} verified projects`,
                        }))}
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-600">
                      Completed Trainings &amp; Certificates ({demoState.activeTrainings.length})
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {demoState.activeTrainings.map((trn) => (
                        <div key={trn.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
                          <div className="flex justify-between font-bold text-slate-900">
                            <span>
                              {trn.title} ({trn.year})
                            </span>
                            <span>{trn.durationHours}h</span>
                          </div>
                          <p className="mt-1 text-slate-600">{trn.provider}</p>
                          <p className="mt-1 font-mono text-[10px] text-emerald-700">
                            Certificate ID: {trn.certificateHash.replace(/^sha256:/, '').slice(0, 16).toUpperCase()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-600">
                      Verified Projects ({demoState.activeProjects.length})
                    </h3>
                    <div className="space-y-3">
                      {demoState.activeProjects.map((art) => (
                        <div key={art.id} className="rounded-xl border border-slate-200 bg-white p-4 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-bold text-slate-900">
                              {art.title} ({art.year})
                            </span>
                            <Badge variant="advanced">
                              Record #{art.ledgerSeq} •{' '}
                              {art.qualityScore ? `${Math.round(art.qualityScore * 100)}% Verified` : 'Verified'}
                            </Badge>
                          </div>
                          <p className="mt-1.5 leading-relaxed text-slate-600">{art.description}</p>
                          <p className="mt-2 break-all font-mono text-[10px] text-slate-400">
                            Verification ID: {art.rowSignatureHash.slice(0, 24).toUpperCase()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

export default function InteractiveDemoPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-slate-500">Loading interactive demo…</div>}>
      <InteractiveDemoCenterContent />
    </Suspense>
  );
}

