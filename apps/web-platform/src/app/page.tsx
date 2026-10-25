'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Compass,
  FolderKanban,
  HeartHandshake,
  Pause,
  Play,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UsersRound,
  X,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@sparktrack/ui';

const HERO_VIDEO_URL = process.env.NEXT_PUBLIC_HERO_VIDEO_URL ?? '';

const EXPLAINER_CHAPTERS = [
  {
    id: 'register',
    time: '0:00',
    step: 'Scene 01',
    title: 'Parent or School Registers the Learner',
    subtitle: 'Built for Junior & Senior Secondary (JSS1–SS3)',
    narration:
      'A parent, guardian, or school creates a verified account first, adds their JSS/SSS student, selects initial curiosity areas, and sets NDPA 2023 privacy rules.',
    highlight: 'NDPA 2023 Child-Safe Onboarding',
    metrics: ['Guardian Consent Verified', 'Student ID: SPK-11111111', 'Default: Private Profile'],
    accent: 'from-coral-500/25 via-spark-500/20 to-cyan-400/20',
  },
  {
    id: 'capture',
    time: '0:22',
    step: 'Scene 02',
    title: 'Learners Build & Capture Real Projects',
    subtitle: 'Works online and offline across school labs',
    narration:
      'Instead of relying only on exam scores, students log robotics builds, Python scripts, design prototypes, or business pitches—sealed into a tamper-evident SHA-256 ledger.',
    highlight: 'Offline-First Evidence Capture',
    metrics: ['Solar Irrigation Controller', 'Skills: Robotics & Python', 'SHA-256 Block #14 Sealed'],
    accent: 'from-cyan-400/25 via-spark-500/20 to-indigo-500/20',
  },
  {
    id: 'mentor',
    time: '0:48',
    step: 'Scene 03',
    title: 'Mentors Verify Quality & Behavioural Signals',
    subtitle: 'Educators & coaches observe how learners solve problems',
    narration:
      'Assigned mentors review student artifacts, score rubric quality, and log 1–4 behavioural signals like Analytical Problem Solving, Creative Framing, and Initiative.',
    highlight: '1.35× Mentor-Verified Skill Weight',
    metrics: ['Quality Score: 90%', 'Signal: Analytical (4 · Standout)', 'Mentor Agreement: Verified'],
    accent: 'from-emerald-400/25 via-cyan-500/20 to-spark-500/20',
  },
  {
    id: 'pathways',
    time: '1:12',
    step: 'Scene 04',
    title: '13-Part Development & Future Pathways Report',
    subtitle: 'Exploration over fixed labels',
    narration:
      'Parents and schools unlock a 13-part longitudinal report showing declared vs. observed strengths, bitemporal skill momentum, and career/entrepreneurship pathways to explore next.',
    highlight: 'Guardrail-Safe AI Synthesis',
    metrics: ['Top Pathway: Embedded Systems', 'Divergence Insight Detected', 'Non-Deterministic Guidance'],
    accent: 'from-violet-500/25 via-spark-500/20 to-cyan-400/20',
  },
];

const TOUR_STEPS = [
  {
    id: 'parent-setup',
    badge: 'Step 1 • Family & School Onboarding',
    title: 'Parents or Schools Register Junior & Secondary Students',
    description:
      'Young learners in JSS1–SS3 do not need a personal email to begin. A parent, guardian, or school administrator registers first and adds the student in under 60 seconds.',
    bullets: [
      'Parent or School creates their verified account at /auth',
      'Adds student name, date of birth, education stage (e.g. JSS2, SS1), and curiosity areas',
      'Parent controls public portfolio & partner talent discovery toggles at any time',
    ],
    ctaLabel: 'Register as Parent or School',
    ctaHref: '/auth?mode=signup&role=PARENT',
    previewTitle: 'Parent Child-Registration Card',
    previewItems: [
      { label: 'Student Name', value: 'Tobi Adeyemi (JSS3 • Age 13)' },
      { label: 'Curiosity Areas', value: 'Robotics, Coding & Programming, AI' },
      { label: 'NDPA Consent Status', value: 'VERIFIED_ACTIVE (Parent Managed)' },
      { label: 'Student Access Code', value: 'SPK-11111111' },
    ],
  },
  {
    id: 'student-capture',
    badge: 'Step 2 • Learner Project Log',
    title: 'Students Log Real Projects—Even Without Internet',
    description:
      'Whether in a weekend robotics camp or a school computer lab with unstable Wi-Fi, learners record what they built, attach links/media, and tag the skills they practiced.',
    bullets: [
      'Saves to local IndexedDB automatically when offline and syncs when back online',
      'Every synced project is cryptographically sealed in the append-only SHA-256 ledger',
      'Friendly skill progress bars show Beginners becoming Developing, Competent, and Advanced',
    ],
    ctaLabel: 'Explore Student Learning Hub',
    ctaHref: '/student/dashboard',
    previewTitle: 'Learner Project Evidence Entry',
    previewItems: [
      { label: 'Project Title', value: 'Arduino Smart Classroom Attendance Sensor' },
      { label: 'Artifact Type', value: 'PROJECT_SUBMISSION' },
      { label: 'Skills Practiced', value: 'Robotics & Hardware, Python Programming' },
      { label: 'Sync & Ledger State', value: 'Synced & Sealed • Block #12' },
    ],
  },
  {
    id: 'mentor-review',
    badge: 'Step 3 • Mentor Verification Studio',
    title: 'Mentors Score Work & Observe Behavioural Signals',
    description:
      'Teachers and coaches use a 2-column review workspace to verify student submissions and record 1–4 behavioural signal observations that reveal hidden talent.',
    bullets: [
      'One-click rubric quality presets (70%, 80%, 90%, 95%)',
      'Behavioural signals: Analytical Problem Solving, Creative Framing, Persistence, Collaboration',
      'Immediately triggers bitemporal skill recomputation across the capability graph',
    ],
    ctaLabel: 'Open Mentor Studio',
    ctaHref: '/mentor/dashboard',
    previewTitle: 'Mentor Verification & Signal Rubric',
    previewItems: [
      { label: 'Reviewed Submission', value: 'Arduino Smart Classroom Attendance Sensor' },
      { label: 'Rubric Quality Score', value: '90% (Mentor Verified — 1.35× weight)' },
      { label: 'Observed Signal', value: 'ANALYTICAL_PROBLEM_SOLVING • 4 (Standout)' },
      { label: 'Engine Action', value: 'Bitemporal Skill State Updated' },
    ],
  },
  {
    id: 'report-pathways',
    badge: 'Step 4 • 13-Part Development Report',
    title: 'Discover Emerging Strengths & Future Pathways',
    description:
      'Parents and schools view a structured 13-part report that compares what a student says they like with what their real project evidence shows—opening doors to new career and entrepreneurship pathways.',
    bullets: [
      'Detects hidden strengths (e.g., declared Graphic Design, but excels in Systems Engineering)',
      'Recommends non-deterministic Career & Entrepreneurship pathways to explore next',
      'Verified by a dual-layer AI Guardrail so no child is ever boxed into a fixed label',
    ],
    ctaLabel: 'View Sample 13-Part Report',
    ctaHref: '/parent/dashboard',
    previewTitle: '13-Part Longitudinal Report Snapshot',
    previewItems: [
      { label: 'Strongest Observed Skills', value: 'Robotics (Competent • 78%), Python (Developing • 64%)' },
      { label: 'Declared vs Observed Insight', value: 'Strong emerging systems-building signal detected' },
      { label: 'Pathways to Explore', value: 'Embedded Systems & Robotics, Agritech Founder' },
      { label: 'AI Guardrail Check', value: 'Passed (100% Exploratory Framing)' },
    ],
  },
];

const SPACES = [
  {
    title: 'For Parents & Guardians',
    description:
      'Register your JSS/SSS child, control NDPA privacy settings, and read their 13-part development report.',
    href: '/auth?mode=signup&role=PARENT',
    dashboardHref: '/parent/dashboard',
    icon: HeartHandshake,
    tone: 'bg-coral-50 text-coral-600',
    label: 'Register as Parent',
  },
  {
    title: 'For Schools & Organisations',
    description: 'Onboard your school or youth programme, register students, and track cohort capability growth.',
    href: '/auth?mode=signup&role=SCHOOL_ADMIN',
    dashboardHref: '/school/dashboard',
    icon: Building2,
    tone: 'bg-violet-50 text-violet-800',
    label: 'Register Institution',
  },
  {
    title: 'For Mentors & Educators',
    description: 'Review student projects, give structured rubric feedback, and turn effort into verified evidence.',
    href: '/auth?mode=signup&role=MENTOR',
    dashboardHref: '/mentor/dashboard',
    icon: UsersRound,
    tone: 'bg-emerald-50 text-emerald-800',
    label: 'Join as Mentor',
  },
  {
    title: 'For Learners',
    description: 'Log projects, build practical skills, and watch your capability portfolio grow over time.',
    href: '/student/dashboard',
    dashboardHref: '/student/portfolio',
    icon: Compass,
    tone: 'bg-spark-50 text-spark-800',
    label: 'Open Learner Space',
  },
];

export default function HomePage() {
  const [activeChapter, setActiveChapter] = useState(0);
  const [isPlayingStoryboard, setIsPlayingStoryboard] = useState(true);
  const [cinemaModalOpen, setCinemaModalOpen] = useState(false);
  const [activeTourIndex, setActiveTourIndex] = useState(0);

  useEffect(() => {
    if (!isPlayingStoryboard || cinemaModalOpen) return;
    const timer = setInterval(() => {
      setActiveChapter((prev) => (prev + 1) % EXPLAINER_CHAPTERS.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [isPlayingStoryboard, cinemaModalOpen]);

  const currentScene = EXPLAINER_CHAPTERS[activeChapter] ?? EXPLAINER_CHAPTERS[0]!;
  const currentTour = TOUR_STEPS[activeTourIndex] ?? TOUR_STEPS[0]!;

  return (
    <main className="min-h-screen px-4 pb-20 pt-6 sm:px-6 sm:pt-10 lg:px-10">
      <div className="mx-auto max-w-[1280px] space-y-20">
        {/* HERO SECTION WITH INTERACTIVE EXPLAINER STORYBOARD / VIDEO */}
        <section
          id="explainer"
          className="spark-enter relative isolate overflow-hidden rounded-[2.25rem] bg-[#0e1b38] px-6 py-12 text-white shadow-[0_24px_80px_rgba(17,28,52,0.22)] sm:px-10 sm:py-16 lg:px-14 lg:py-18"
        >
          <div className="absolute -right-20 -top-36 -z-10 h-[30rem] w-[30rem] rounded-full bg-blue-500/25 blur-3xl" />
          <div className="absolute -bottom-40 left-[35%] -z-10 h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" />

          <div className="grid items-center gap-10 lg:grid-cols-[1.02fr_0.98fr]">
            {/* Left Hero Copy & Role CTAs */}
            <div className="max-w-2xl">
              <Badge className="border border-white/15 bg-white/10 text-cyan-200">
                <Sparkles size={13} className="mr-1.5" aria-hidden="true" />
                Parent, School &amp; Youth Capability Intelligence
              </Badge>

              <h1 className="mt-5 text-4xl font-extrabold leading-[1.07] tracking-[-0.04em] text-white sm:text-5xl lg:text-[3.45rem]">
                Your child’s future isn’t one exam score.{' '}
                <span className="text-cyan-300">Discover what they can build.</span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-blue-100/85 sm:text-lg">
                SparkTrack helps parents, secondary schools, and mentors turn a young person’s curiosity and real
                projects into verified skills and future career pathways—from <strong>JSS1 to SS3</strong>.
              </p>

              {/* Primary CTAs */}
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/auth?mode=signup&role=PARENT">
                  <span className="inline-flex h-12 items-center justify-center rounded-xl bg-cyan-300 px-6 text-sm font-extrabold text-[#0e1b38] shadow-lg shadow-cyan-950/25 transition-all hover:-translate-y-0.5 hover:bg-cyan-200">
                    <UserPlus size={17} className="mr-2" aria-hidden="true" />
                    Register as Parent or School
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={() => setCinemaModalOpen(true)}
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/15"
                >
                  <PlayCircle size={18} className="mr-2 text-cyan-300" aria-hidden="true" />
                  Watch How SparkTrack Works
                </button>
              </div>

              {/* Secondary Quick Links */}
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-blue-100/80">
                <Link href="/auth?mode=signin" className="underline decoration-cyan-400/60 underline-offset-4 hover:text-white">
                  Already have an account? Sign in →
                </Link>
                <a href="#tour" className="inline-flex items-center gap-1.5 text-cyan-300 hover:underline">
                  <Compass size={14} /> Take the 60-second interactive tour
                </a>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-5 text-xs font-medium text-blue-100/75">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck size={15} className="text-emerald-300" aria-hidden="true" /> NDPA 2023 Parent-First
                  Privacy
                </span>
                <span className="inline-flex items-center gap-2">
                  <Sparkles size={15} className="text-cyan-300" aria-hidden="true" /> SHA-256 Verified Project Evidence
                </span>
              </div>
            </div>

            {/* Right Column: Interactive Explainer Video / Animated Storyboard Player */}
            <div className="relative mx-auto w-full max-w-xl">
              <div
                className={`absolute -inset-3 rounded-[2rem] bg-gradient-to-br ${currentScene.accent} blur-xl transition-all duration-700`}
              />
              <div className="relative overflow-hidden rounded-[1.75rem] border border-white/20 bg-slate-950/90 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
                {/* Top Player Bar */}
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsPlayingStoryboard((p) => !p)}
                      aria-label={isPlayingStoryboard ? 'Pause explainer chapters' : 'Play explainer chapters'}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/20 text-cyan-300 transition hover:bg-cyan-400/30"
                    >
                      {isPlayingStoryboard ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-300">
                        Interactive Explainer • {currentScene.step} ({currentScene.time})
                      </p>
                      <p className="text-xs text-slate-300">{currentScene.subtitle}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCinemaModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
                  >
                    <PlayCircle size={14} className="text-cyan-300" />
                    <span>Theater Mode</span>
                  </button>
                </div>

                {/* Active Scene Stage */}
                <div className="mt-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400/15 px-3 py-1 text-xs font-bold text-cyan-300">
                      <Sparkles size={12} /> {currentScene.highlight}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      Chapter {activeChapter + 1} of {EXPLAINER_CHAPTERS.length}
                    </span>
                  </div>

                  <h2 className="text-xl font-extrabold text-white sm:text-2xl">{currentScene.title}</h2>
                  <p className="text-sm leading-6 text-slate-300">{currentScene.narration}</p>

                  {/* Live Telemetry Chips for the Scene */}
                  <div className="grid gap-2 pt-1 sm:grid-cols-3">
                    {currentScene.metrics.map((metric) => (
                      <div
                        key={metric}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-semibold text-blue-100"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        <span className="truncate">{metric}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chapter Timeline Selector Pills */}
                <div className="mt-6 grid grid-cols-4 gap-2 border-t border-white/10 pt-4">
                  {EXPLAINER_CHAPTERS.map((chap, idx) => {
                    const active = idx === activeChapter;
                    return (
                      <button
                        key={chap.id}
                        type="button"
                        onClick={() => {
                          setActiveChapter(idx);
                          setIsPlayingStoryboard(false);
                        }}
                        className={`rounded-xl p-2 text-left transition ${
                          active
                            ? 'border border-cyan-400/50 bg-cyan-400/15 text-white'
                            : 'border border-transparent bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase">
                          <span>0{idx + 1}</span>
                          <span>{chap.time}</span>
                        </div>
                        <p className="mt-1 truncate text-xs font-semibold">{chap.title.split(' ')[0]}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW REGISTRATION & ONBOARDING WORKS FOR JSS / SSS LEARNERS */}
        <section id="how-it-works" className="scroll-mt-24 space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-spark-700">
                How Registration Works (JSS1 – SS3)
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Parents &amp; Schools lead registration. Students lead discovery.
              </h2>
            </div>
            <Link href="/auth?mode=signup&role=PARENT">
              <Button variant="outline">
                Open Registration Hub <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                step: 'Step 01',
                title: 'Parent or School Creates an Account',
                description:
                  'Because Junior and Secondary students are minors, a Parent/Guardian or School Administrator signs up first at /auth to establish a trusted account.',
                badge: 'Parent / School First',
                href: '/auth?mode=signup&role=PARENT',
                cta: 'Register as Parent or School',
              },
              {
                step: 'Step 02',
                title: 'Add Your Student & Set Privacy',
                description:
                  'Inside the Parent or School dashboard, click "Add Child / Student" to enter their stage (e.g. JSS2, SS1), curiosity areas, and NDPA 2023 consent preferences.',
                badge: 'Instant Student Profile',
                href: '/parent/dashboard',
                cta: 'See Parent Child Setup',
              },
              {
                step: 'Step 03',
                title: 'Projects, Mentor Review & 13-Part Report',
                description:
                  'Students log projects (online or offline), mentors verify quality and behavioural signals, and families unlock the 13-part longitudinal pathways report.',
                badge: 'Longitudinal Growth',
                href: '/student/dashboard',
                cta: 'Preview Learner Hub',
              },
            ].map((item) => (
              <Card key={item.step} className="flex flex-col justify-between border-slate-200/90">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-spark-600">{item.step}</span>
                    <Badge variant="outline">{item.badge}</Badge>
                  </div>
                  <CardTitle className="mt-3 text-lg">{item.title}</CardTitle>
                  <CardDescription className="mt-1 leading-6">{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link
                    href={item.href}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-spark-700 hover:text-spark-900"
                  >
                    <span>{item.cta}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* INTERACTIVE PLATFORM TOUR SECTION */}
        <section
          id="tour"
          className="scroll-mt-24 rounded-[2rem] border border-slate-200/90 bg-white p-6 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.2)] sm:p-10"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-spark-50 px-3 py-1 text-xs font-bold text-spark-700">
                <Compass className="h-3.5 w-3.5" />
                <span>Interactive Guided Tour</span>
              </div>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Walk through the SparkTrack experience in 4 steps.
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {TOUR_STEPS.map((step, idx) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveTourIndex(idx)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    activeTourIndex === idx
                      ? 'bg-spark-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  0{idx + 1}. {step.id.replace('-', ' ').toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              <Badge variant="default">{currentTour.badge}</Badge>
              <h3 className="text-2xl font-extrabold text-slate-900">{currentTour.title}</h3>
              <p className="text-sm leading-6 text-slate-600">{currentTour.description}</p>

              <ul className="space-y-2.5 pt-2">
                {currentTour.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-3 pt-4">
                <Link href={currentTour.ctaHref}>
                  <Button>
                    {currentTour.ctaLabel} <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={() => setActiveTourIndex((prev) => (prev + 1) % TOUR_STEPS.length)}
                >
                  Next Tour Step →
                </Button>
              </div>
            </div>

            {/* Simulated Live Preview Card */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {currentTour.previewTitle}
                </span>
                <Badge variant="success">Live Platform Preview</Badge>
              </div>
              <div className="mt-4 space-y-3">
                {currentTour.previewItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col justify-between gap-1 rounded-xl border border-slate-200/80 bg-white p-3.5 text-sm sm:flex-row sm:items-center"
                  >
                    <span className="text-xs font-semibold text-slate-500">{item.label}</span>
                    <span className="font-bold text-slate-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* WORKSPACE CARDS FOR EACH ROLE */}
        <section>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-spark-700">
                One platform, the right space for you
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Built around the people who help potential grow.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-600">
              Parents and schools register and safeguard learners. Mentors verify real projects. Learners build a
              portfolio of capability.
            </p>
          </div>
          <div className="spark-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {SPACES.map((space) => (
              <Card key={space.title} className="group flex h-full flex-col overflow-hidden">
                <CardHeader className="pb-3">
                  <span className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${space.tone}`}>
                    <space.icon size={22} aria-hidden="true" />
                  </span>
                  <CardTitle className="text-lg">{space.title}</CardTitle>
                  <CardDescription className="min-h-[3.5rem]">{space.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4">
                  <Link
                    href={space.href}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-spark-700 transition-colors group-hover:text-spark-900"
                  >
                    {space.label}
                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Link
                    href={space.dashboardHref}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Preview →
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* TRUST, PRIVACY & NON-DETERMINISTIC GUARDRAIL BANNER */}
        <section
          id="trust"
          className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8"
        >
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-coral-50 text-coral-600">
              <ShieldCheck size={21} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-bold text-slate-900">Growth should feel safe, supported, and personal.</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                SparkTrack focuses on development—never fixed career labels. Every minor profile defaults to private
                under NDPA 2023 until a verified parent or guardian grants consent.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2.5">
            <Link href="/parent/consent">
              <span className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50">
                SMS Consent Portal <ArrowUpRight size={16} className="ml-1.5" aria-hidden="true" />
              </span>
            </Link>
            <Link href="/student/portfolio">
              <span className="inline-flex h-11 items-center justify-center rounded-xl bg-spark-600 px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-spark-700">
                Verify a Portfolio <FolderKanban size={16} className="ml-1.5" aria-hidden="true" />
              </span>
            </Link>
          </div>
        </section>
      </div>

      {/* FULLSCREEN CINEMA EXPLAINER MODAL (Supports Gemini MP4/WebM Video + Interactive Chapters) */}
      {cinemaModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="SparkTrack Explainer Video Theater"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
        >
          <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-white/15 bg-[#0d172f] text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <PlayCircle className="h-5 w-5 text-cyan-300" />
                <span className="text-sm font-bold">SparkTrack Explainer — How Potential Grows</span>
              </div>
              <button
                type="button"
                onClick={() => setCinemaModalOpen(false)}
                className="rounded-xl bg-white/10 p-2 text-slate-300 hover:bg-white/20 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6">
              {HERO_VIDEO_URL ? (
                <div className="overflow-hidden rounded-2xl border border-white/15 bg-black">
                  <video
                    src={HERO_VIDEO_URL}
                    controls
                    autoPlay
                    className="aspect-video w-full"
                    poster="/manifest.json"
                  >
                    Your browser does not support embedded videos.
                  </video>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/15 bg-slate-900/90 p-6 sm:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge className="bg-cyan-400/20 text-cyan-300">
                      {currentScene.step} • {currentScene.time}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      Gemini Explainer Video Slot Ready (set <code>NEXT_PUBLIC_HERO_VIDEO_URL</code> when rendered)
                    </span>
                  </div>
                  <h3 className="mt-4 text-2xl font-extrabold text-white sm:text-3xl">{currentScene.title}</h3>
                  <p className="mt-3 text-base leading-7 text-slate-300">{currentScene.narration}</p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {currentScene.metrics.map((m) => (
                      <div
                        key={m}
                        className="rounded-xl border border-white/10 bg-white/5 p-3.5 text-xs font-semibold text-cyan-200"
                      >
                        {m}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chapter Selection Bar inside Modal */}
              <div className="mt-5 grid gap-2 sm:grid-cols-4">
                {EXPLAINER_CHAPTERS.map((chap, idx) => (
                  <button
                    key={chap.id}
                    type="button"
                    onClick={() => setActiveChapter(idx)}
                    className={`rounded-xl border p-3 text-left transition ${
                      idx === activeChapter
                        ? 'border-cyan-400 bg-cyan-400/15 text-white'
                        : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <p className="text-[11px] font-bold text-cyan-300">
                      {chap.step} ({chap.time})
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs font-semibold">{chap.title}</p>
                  </button>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                <p className="text-xs text-slate-400">
                  Ready to register a Junior or Senior Secondary learner? Start with a Parent or School account.
                </p>
                <div className="flex gap-2.5">
                  <Link href="/auth?mode=signup&role=PARENT" onClick={() => setCinemaModalOpen(false)}>
                    <Button size="sm">Register as Parent / School</Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
