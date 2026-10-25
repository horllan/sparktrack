import Link from 'next/link';
import { Compass, HeartHandshake, ShieldCheck, Sparkles, UsersRound } from '@sparktrack/ui';

export function Footer() {
  return (
    <footer className="border-t border-slate-200/80 bg-[#0d172f] text-slate-300">
      <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr_1fr_1fr_1fr]">
          {/* Brand & Mission */}
          <div className="space-y-4">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-spark-500 text-white shadow-sm">
                <Sparkles size={19} strokeWidth={2.4} aria-hidden="true" />
              </span>
              <span className="text-lg font-extrabold tracking-tight text-white">sparktrack</span>
            </Link>
            <p className="max-w-sm text-sm leading-6 text-slate-400">
              Longitudinal Youth Capability &amp; Future Pathways Intelligence. Helping Junior and Senior Secondary
              learners turn curiosity and real projects into verified skills—guided by parents, mentors, and schools.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-xs font-medium text-cyan-300">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1">
                <ShieldCheck className="h-3.5 w-3.5" /> NDPA 2023 Child-Safe
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1">
                <Compass className="h-3.5 w-3.5" /> Evidence Over Labels
              </span>
            </div>
          </div>

          {/* Account & Registration */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white">Get Started</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/auth?mode=signup&role=PARENT" className="transition hover:text-white">
                  Parent / Guardian Registration
                </Link>
              </li>
              <li>
                <Link href="/auth?mode=signup&role=SCHOOL_ADMIN" className="transition hover:text-white">
                  School &amp; Partner Registration
                </Link>
              </li>
              <li>
                <Link href="/auth?mode=signup&role=MENTOR" className="transition hover:text-white">
                  Mentor &amp; Educator Sign Up
                </Link>
              </li>
              <li>
                <Link href="/auth?mode=signin" className="transition hover:text-white">
                  Student / Learner Sign In
                </Link>
              </li>
              <li>
                <Link href="/student/onboarding" className="transition hover:text-white">
                  Teen Self-Onboarding (16+)
                </Link>
              </li>
            </ul>
          </div>

          {/* Role Workspaces */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white">Workspaces</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/parent/dashboard" className="transition hover:text-white">
                  Parent &amp; Family Hub
                </Link>
              </li>
              <li>
                <Link href="/student/dashboard" className="transition hover:text-white">
                  Student Learning Hub
                </Link>
              </li>
              <li>
                <Link href="/mentor/dashboard" className="transition hover:text-white">
                  Mentor Verification Studio
                </Link>
              </li>
              <li>
                <Link href="/school/dashboard" className="transition hover:text-white">
                  School &amp; Partner Insights
                </Link>
              </li>
              <li>
                <Link href="/student/portfolio" className="transition hover:text-white">
                  Public Portfolio Verifier
                </Link>
              </li>
            </ul>
          </div>

          {/* Platform & Tour */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white">How It Works</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/#explainer" className="transition hover:text-white">
                  Watch Explainer Story
                </Link>
              </li>
              <li>
                <Link href="/#tour" className="transition hover:text-white">
                  Interactive Platform Tour
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="transition hover:text-white">
                  Parent &amp; School Onboarding Flow
                </Link>
              </li>
              <li>
                <Link href="/parent/dashboard" className="transition hover:text-white">
                  13-Part Development Report
                </Link>
              </li>
              <li>
                <Link href="/student/dashboard" className="transition hover:text-white">
                  Offline-First PWA Capture
                </Link>
              </li>
            </ul>
          </div>

          {/* Trust, Safety & Compliance */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white">Trust &amp; Privacy</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/parent/consent" className="transition hover:text-white">
                  Guardian SMS OTP Verification
                </Link>
              </li>
              <li>
                <Link href="/parent/dashboard" className="transition hover:text-white">
                  NDPA 2023 Privacy Controls
                </Link>
              </li>
              <li>
                <Link href="/student/portfolio" className="transition hover:text-white">
                  SHA-256 Cryptographic Ledger
                </Link>
              </li>
              <li>
                <Link href="/#trust" className="transition hover:text-white">
                  Non-Deterministic AI Guardrails
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 text-xs text-slate-400 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} SparkTrack Intelligence Platform. Built for youth capability exploration.</p>
          <div className="flex flex-wrap items-center gap-5">
            <span className="inline-flex items-center gap-1.5">
              <HeartHandshake className="h-3.5 w-3.5 text-coral-500" /> Parent &amp; School First
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UsersRound className="h-3.5 w-3.5 text-cyan-400" /> Mentor Verified Evidence
            </span>
            <Link href="/parent/consent" className="underline decoration-slate-600 underline-offset-4 hover:text-white">
              Guardian Consent Portal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

