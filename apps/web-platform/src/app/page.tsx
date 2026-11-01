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
    step: 'Part 1',
    shortLabel: 'Start',
    title: 'Set up a profile in minutes',
    subtitle: 'For students, graduates, and adult learners',
    narration:
      'Start from secondary school (JSS1 and above), university, NYSC, work, or independent learning. Learners under 18 link a parent or guardian for approval; adults manage their own account.',
    highlight: 'Child-Safe by Default',
    metrics: ['Parent Consent Protected', 'Private by Default', 'Simple Setup'],
    accent: 'from-coral-500/25 via-spark-500/20 to-cyan-400/20',
  },
  {
    id: 'capture',
    time: '0:22',
    step: 'Part 2',
    shortLabel: 'Build',
    title: 'Record real projects, online or offline',
    subtitle: 'Built for school labs and workshops',
    narration:
      'Grades only tell part of the story. Learners save code, hardware builds, designs, or business ideas, even when the internet connection drops.',
    highlight: 'Works Offline',
    metrics: ['Solar Irrigation Project', 'Skills: Robotics & Python', 'Verified Record'],
    accent: 'from-cyan-400/25 via-spark-500/20 to-indigo-500/20',
  },
  {
    id: 'mentor',
    time: '0:48',
    step: 'Part 3',
    shortLabel: 'Review',
    title: 'Mentors review work and highlight strengths',
    subtitle: 'Quick, structured feedback from teachers and coaches',
    narration:
      'Mentors review each project in under three minutes, score the quality of work, and note practical habits like problem solving, creativity, and persistence.',
    highlight: 'Mentor Reviewed',
    metrics: ['Quality Score: 90%', 'Strength: Problem Solving', 'Mentor Feedback Added'],
    accent: 'from-emerald-400/25 via-cyan-500/20 to-spark-500/20',
  },
  {
    id: 'pathways',
    time: '1:12',
    step: 'Part 4',
    shortLabel: 'Grow',
    title: 'Clear progress reports and next steps',
    subtitle: 'Practical guidance based on real work',
    narration:
      'Parents, learners, and schools get a clear 13-part progress report that compares interests with actual project strengths and suggests practical career or study options.',
    highlight: 'Clear Progress Reports',
    metrics: ['Strength: Embedded Systems', 'New Talent Discovered', 'Actionable Next Steps'],
    accent: 'from-violet-500/25 via-spark-500/20 to-cyan-400/20',
  },
];

const TOUR_STEPS = [
  {
    id: 'parent-setup',
    tabLabel: '1. Onboarding',
    badge: 'Step 1 • Getting Started',
    title: 'Start from wherever you are today',
    description:
      'Adults can create their own profile right away. Learners under 18 can be added by a parent or school, with parent approval before any project work is shared.',
    bullets: [
      'Pick your current stage and what you want to achieve next',
      'School details are optional for adult and independent learners',
      'Profiles for learners under 18 stay private by default',
    ],
    ctaLabel: 'Create a learner profile',
    ctaHref: '/student/onboarding',
    previewTitle: 'Sample Learner Profile',
    previewItems: [
      { label: 'Learner', value: 'Tobi Adeyemi (JSS3, Age 13)' },
      { label: 'Starting Interests', value: 'Robotics, Coding, AI' },
      { label: 'Parent Approval', value: 'Active (Managed by Parent)' },
      { label: 'Profile Privacy', value: 'Private by Default' },
    ],
  },
  {
    id: 'student-capture',
    tabLabel: '2. Project Log',
    badge: 'Step 2 • Saving Work',
    title: 'Save projects even when the internet is down',
    description:
      'Whether in a school computer lab or a weekend workshop, learners can record what they built, attach files or links, and tag the skills they used.',
    bullets: [
      'Saves on your device when offline and syncs automatically when back online',
      'Each completed project is added to a tamper-proof portfolio record',
      'Clear progress bars show skills growing from Beginner to Advanced',
    ],
    ctaLabel: 'Open Student Workspace',
    ctaHref: '/student/dashboard',
    previewTitle: 'Sample Project Entry',
    previewItems: [
      { label: 'Project Title', value: 'Smart Classroom Attendance Sensor' },
      { label: 'Category', value: 'Hardware & Coding Project' },
      { label: 'Skills Used', value: 'Robotics, Python Programming' },
      { label: 'Status', value: 'Saved & Verified' },
    ],
  },
  {
    id: 'mentor-review',
    tabLabel: '3. Mentor Review',
    badge: 'Step 3 • Mentor Feedback',
    title: 'Mentors review projects in under three minutes',
    description:
      'Teachers and coaches review submitted work, score project quality, and note how the learner approached the problem.',
    bullets: [
      'Quick quality scoring with clear rubric presets',
      'Highlights strengths like problem solving, persistence, and teamwork',
      'Updates the learner’s skill profile and progress report right away',
    ],
    ctaLabel: 'Open Mentor Workspace',
    ctaHref: '/mentor/dashboard',
    previewTitle: 'Sample Mentor Review',
    previewItems: [
      { label: 'Project Reviewed', value: 'Smart Classroom Attendance Sensor' },
      { label: 'Quality Score', value: '90% (Verified by Mentor)' },
      { label: 'Key Strength', value: 'Problem Solving & Persistence' },
      { label: 'Mentor Note', value: 'Clean wiring and well-tested sensor logic' },
    ],
  },
  {
    id: 'report-pathways',
    tabLabel: '4. Progress Report',
    badge: 'Step 4 • Progress & Next Steps',
    title: 'Spot hidden strengths and practical future options',
    description:
      'Parents and schools view a clear 13-part report comparing what a learner initially picked with what their actual projects show.',
    bullets: [
      'Spots unexpected strengths that exams often miss',
      'Suggests practical study streams, careers, and project ideas to try next',
      'Written in plain, encouraging language without boxing learners into fixed labels',
    ],
    ctaLabel: 'Explore Interactive Demo',
    ctaHref: '/demo',
    previewTitle: 'Sample Progress Report Summary',
    previewItems: [
      { label: 'Top Verified Skills', value: 'Robotics (78%), Python (64%)' },
      { label: 'Key Insight', value: 'Strong talent in hardware and systems building' },
      { label: 'Suggested Options', value: 'Embedded Systems, Engineering Stream' },
      { label: 'Next Step', value: 'Build a solar sensor prototype' },
    ],
  },
];

const SPACES = [
  {
    title: 'For Parents & Guardians',
    description:
      'Support a learner at any stage, manage privacy settings, and follow evidence-backed growth over time.',
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
    description: 'Start from JSS1, university, NYSC, work, a career change, or independent learning. Build practical skills and proof over time.',
    href: '/student/onboarding',
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
                Lifelong Learning &amp; Capability Development
              </Badge>

              <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-[-0.035em] text-white sm:text-5xl lg:text-[3.35rem]">
                Your future isn’t decided by a single exam.{' '}
                <span className="text-cyan-300">Show what you can build.</span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-blue-100/90 sm:text-lg">
                SparkTrack helps learners build practical skills and a verified portfolio of real projects, from{' '}
                <strong>JSS1 onwards</strong> through university, NYSC, and career growth. Parents, schools, and mentors
                support every step.
              </p>

              {/* Primary CTAs */}
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/demo">
                  <span className="inline-flex h-12 items-center justify-center rounded-xl bg-cyan-300 px-6 text-sm font-extrabold text-[#0e1b38] shadow-lg shadow-cyan-950/25 transition-all hover:-translate-y-0.5 hover:bg-cyan-200">
                    <PlayCircle size={18} className="mr-2" aria-hidden="true" />
                    Explore Interactive Demo
                  </span>
                </Link>

                <Link href="/student/onboarding">
                  <span className="inline-flex h-12 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/15">
                    <UserPlus size={17} className="mr-2 text-cyan-300" aria-hidden="true" />
                    Start Your Profile
                  </span>
                </Link>
              </div>

              {/* Secondary Quick Links */}
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-blue-100/80">
                <Link href="/auth?mode=signin" className="underline decoration-cyan-400/60 underline-offset-4 hover:text-white">
                  Already have an account? Sign in →
                </Link>
                <button
                  type="button"
                  onClick={() => setCinemaModalOpen(true)}
                  className="inline-flex items-center gap-1.5 text-cyan-300 hover:underline"
                >
                  <Play size={13} /> Watch 4-part walkthrough
                </button>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-5 text-xs font-medium text-blue-100/75">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck size={15} className="text-emerald-300" aria-hidden="true" /> Private by default for under-18 learners
                </span>
                <span className="inline-flex items-center gap-2">
                  <Sparkles size={15} className="text-cyan-300" aria-hidden="true" /> Mentor-verified project portfolios
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
                        <p className="mt-1 truncate text-xs font-semibold">{chap.shortLabel}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Lifelong learner entry and supported learning journeys */}
        <section id="how-it-works" className="scroll-mt-24 space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-spark-700">
                One learning space. Every starting point.
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Your experience and goals shape what comes next.
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
                title: 'Choose your starting point',
                description:
                  'Start in JSS1 or later, at university, during NYSC, while employed, between careers, or without formal education. SparkTrack meets you where you are.',
                badge: 'Every learner welcome',
                href: '/student/onboarding',
                cta: 'Create a learner space',
              },
              {
                step: 'Step 02',
                title: 'Set a goal that matters to you',
                description:
                  'Explore interests, build practical skills, prepare for work, grow in your career, change direction, or start a business. Under-18 learners include a guardian.',
                badge: 'Built around your next step',
                href: '/student/onboarding',
                cta: 'Choose your goal',
              },
              {
                step: 'Step 03',
                title: 'Keep moving in familiar ways',
                description:
                  'Build and save work in SparkTrack. The learner journey is designed around familiar touchpoints such as WhatsApp for useful, opted-in reminders and quick returns, while progress and evidence stay in your learner space.',
                badge: 'Your work stays yours',
                href: '/student/dashboard',
                cta: 'Open learner space',
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
                  {step.tabLabel}
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
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
                SparkTrack focuses on practical skill growth rather than fixed labels. Every profile for a learner under
                18 stays private by default until a parent or guardian approves it.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2.5">
            <Link href="/parent/consent">
              <span className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50">
                Parent SMS Code <ArrowUpRight size={16} className="ml-1.5" aria-hidden="true" />
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

      {/* FULLSCREEN WALKTHROUGH MODAL */}
      {cinemaModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="SparkTrack Walkthrough"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
        >
          <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-white/15 bg-[#0d172f] text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <PlayCircle className="h-5 w-5 text-cyan-300" />
                <span className="text-sm font-bold">How SparkTrack Works</span>
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
                    <span className="text-xs text-slate-400">{currentScene.highlight}</span>
                  </div>
                  <h3 className="mt-4 text-2xl font-extrabold text-white sm:text-3xl">{currentScene.title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-slate-300">{currentScene.narration}</p>
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
                  Want to test the full experience with sample learners? Open the interactive demo.
                </p>
                <div className="flex gap-2.5">
                  <Link href="/demo" onClick={() => setCinemaModalOpen(false)}>
                    <Button size="sm">Open Interactive Demo</Button>
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
