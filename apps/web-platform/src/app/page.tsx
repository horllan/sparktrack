import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Compass, FolderKanban, HeartHandshake, ShieldCheck, Sparkles, UsersRound, Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@sparktrack/ui';

const SPACES = [
  {
    title: 'For learners',
    description: 'Try new things, build real projects, and see your skills take shape over time.',
    href: '/student/onboarding',
    icon: Compass,
    tone: 'bg-spark-50 text-spark-800',
    label: 'Start exploring',
  },
  {
    title: 'For families',
    description: 'Support a young person’s development with clear, evidence-led progress and privacy controls.',
    href: '/parent/dashboard',
    icon: HeartHandshake,
    tone: 'bg-coral-50 text-coral-600',
    label: 'Family space',
  },
  {
    title: 'For mentors',
    description: 'Recognize effort, give useful feedback, and help turn experience into evidence.',
    href: '/mentor/dashboard',
    icon: UsersRound,
    tone: 'bg-emerald-50 text-emerald-800',
    label: 'Mentor space',
  },
  {
    title: 'For schools & teams',
    description: 'Understand cohort progress and make learning experiences easier to support.',
    href: '/school/dashboard',
    icon: FolderKanban,
    tone: 'bg-violet-50 text-violet-800',
    label: 'View insights',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen px-4 pb-20 pt-8 sm:px-6 sm:pt-12 lg:px-10">
      <div className="mx-auto max-w-[1240px]">
        <section className="spark-enter relative isolate overflow-hidden rounded-[2rem] bg-[#101d3a] px-6 py-12 text-white shadow-[0_24px_80px_rgba(17,28,52,0.16)] sm:px-10 sm:py-16 lg:px-16 lg:py-20">
          <div className="absolute -right-20 -top-36 -z-10 h-[30rem] w-[30rem] rounded-full bg-blue-500/25 blur-3xl" />
          <div className="absolute -bottom-40 left-[38%] -z-10 h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="max-w-2xl">
              <Badge className="border border-white/15 bg-white/10 text-blue-100">
                <Sparkles size={13} className="mr-1.5" aria-hidden="true" />
                A brighter way to grow
              </Badge>
              <h1 className="mt-6 max-w-xl text-4xl font-extrabold leading-[1.08] tracking-[-0.045em] text-white sm:text-5xl lg:text-[3.7rem]">
                Your future isn’t one thing. <span className="text-cyan-300">Explore what you can do.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-blue-100/85 sm:text-lg">
                Discover interests, build practical skills, and collect the evidence of your growth—one experience at a time.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/student/onboarding">
                  <span className="inline-flex h-12 items-center justify-center rounded-xl bg-cyan-300 px-7 text-sm font-bold text-[#102344] shadow-lg shadow-cyan-950/20 transition-all hover:-translate-y-0.5 hover:bg-cyan-200">
                    Start your journey <ArrowRight size={17} className="ml-2" aria-hidden="true" />
                  </span>
                </Link>
                <Link href="/student/dashboard">
                  <span className="inline-flex h-12 items-center justify-center rounded-xl border border-white/25 bg-white/5 px-7 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                    Explore the learner space
                  </span>
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-blue-100/75">
                <span className="inline-flex items-center gap-2"><ShieldCheck size={15} aria-hidden="true" /> Privacy-minded by design</span>
                <span className="inline-flex items-center gap-2"><Sparkles size={15} aria-hidden="true" /> Evidence over labels</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md">
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-cyan-300/20 to-violet-400/20 blur-xl" />
              <Card className="relative rotate-1 border-white/70 bg-white/95 p-1 shadow-2xl shadow-black/20">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-500">The SparkTrack loop</p>
                      <CardTitle className="mt-2 text-2xl">Small steps. Real momentum.</CardTitle>
                    </div>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-800">
                      <Compass size={22} aria-hidden="true" />
                    </span>
                  </div>
                  <CardDescription>Grow through experiences you can point to.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { number: '01', title: 'Explore', detail: 'Find something that sparks curiosity', icon: Compass, tint: 'bg-blue-50 text-blue-700' },
                    { number: '02', title: 'Create', detail: 'Make, test, practice, and try again', icon: Sparkles, tint: 'bg-cyan-50 text-cyan-800' },
                    { number: '03', title: 'Show your growth', detail: 'Keep useful evidence of what you learn', icon: FolderKanban, tint: 'bg-violet-50 text-violet-800' },
                  ].map((item) => (
                    <div key={item.number} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.tint}`}>
                        <item.icon size={18} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900">{item.title}</p>
                        <p className="mt-0.5 text-xs leading-5 text-slate-600">{item.detail}</p>
                      </div>
                      <span className="text-xs font-bold tabular-nums text-slate-400">{item.number}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between rounded-2xl bg-spark-50 px-4 py-3">
                    <span className="text-sm font-semibold text-spark-900">Your journey, your pace</span>
                    <ArrowUpRight size={17} className="text-spark-700" aria-hidden="true" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="mt-14 sm:mt-20">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-spark-700">One platform, the right space for you</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Built around the people who help potential grow.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-600">Learners lead the journey. Families, mentors, and learning partners each have a clear way to support it.</p>
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
                <CardContent className="mt-auto">
                  <Link href={space.href} className="inline-flex items-center gap-2 text-sm font-bold text-spark-700 transition-colors group-hover:text-spark-900">
                    {space.label} <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-14 flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-coral-50 text-coral-600">
              <ShieldCheck size={21} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-bold text-slate-900">Growth should feel safe, supported, and personal.</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">SparkTrack focuses on development—not fixed labels. Guardian consent and privacy choices are part of the journey.</p>
            </div>
          </div>
          <Link href="/parent/consent" className="shrink-0">
            <span className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50">
              Family &amp; privacy <ArrowUpRight size={16} className="ml-2" aria-hidden="true" />
            </span>
          </Link>
        </section>
      </div>
    </main>
  );
}
