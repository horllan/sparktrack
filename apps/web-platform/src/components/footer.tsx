import Link from 'next/link';
import { Compass, HeartHandshake, Scale, ShieldCheck, Sparkles, UsersRound } from '@sparktrack/ui';

export function Footer() {
  return (
    <footer className="border-t border-slate-200/80 bg-[#0d172f] text-slate-300">
      <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1fr_1.15fr]">
          {/* Brand & Mission */}
          <div className="space-y-4">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-spark-500 text-white shadow-sm">
                <Sparkles size={19} strokeWidth={2.4} aria-hidden="true" />
              </span>
              <span className="text-lg font-extrabold tracking-tight text-white">sparktrack</span>
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-slate-400">
              Helping young people and adult learners turn real projects into verified skills, mentor feedback, and
              clear next steps.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-xs font-medium text-cyan-300">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Child Privacy Protected
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1">
                <Compass className="h-3.5 w-3.5" /> Real Work Over Labels
              </span>
            </div>
          </div>

          {/* Account & Registration */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white">Get Started</h3>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed">
              <li>
                <Link href="/auth?mode=signup&role=PARENT" className="transition hover:text-white">
                  Parent Registration
                </Link>
              </li>
              <li>
                <Link href="/auth?mode=signup&role=SCHOOL_ADMIN" className="transition hover:text-white">
                  School Registration
                </Link>
              </li>
              <li>
                <Link href="/auth?mode=signup&role=MENTOR" className="transition hover:text-white">
                  Join as a Mentor
                </Link>
              </li>
              <li>
                <Link href="/auth?mode=signin" className="transition hover:text-white">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/student/onboarding" className="transition hover:text-white">
                  Learner Onboarding
                </Link>
              </li>
            </ul>
          </div>

          {/* Role Workspaces */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white">Workspaces</h3>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed">
              <li>
                <Link href="/demo" className="transition hover:text-white">
                  Interactive Demo
                </Link>
              </li>
              <li>
                <Link href="/parent/dashboard" className="transition hover:text-white">
                  Family Hub
                </Link>
              </li>
              <li>
                <Link href="/student/dashboard" className="transition hover:text-white">
                  Student Workspace
                </Link>
              </li>
              <li>
                <Link href="/mentor/dashboard" className="transition hover:text-white">
                  Mentor Workspace
                </Link>
              </li>
              <li>
                <Link href="/school/dashboard" className="transition hover:text-white">
                  School Overview
                </Link>
              </li>
            </ul>
          </div>

          {/* Support & Partnerships */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white">Support</h3>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed">
              <li>
                <Link href="/contact" className="transition hover:text-white">
                  Contact Support
                </Link>
              </li>
              <li>
                <Link href="/contact?category=SCHOOL_PARTNERSHIP" className="transition hover:text-white">
                  School Partnerships
                </Link>
              </li>
              <li>
                <Link href="/contact?category=SCHOLARSHIP_SPONSORSHIP" className="transition hover:text-white">
                  Sponsor a Cohort
                </Link>
              </li>
              <li>
                <Link href="/contact?category=PRIVACY_DPO_REQUEST" className="transition hover:text-white">
                  Privacy Inquiries
                </Link>
              </li>
              <li>
                <Link href="/student/portfolio" className="transition hover:text-white">
                  Verify a Portfolio
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal, Privacy & Compliance */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white">Legal &amp; Privacy</h3>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed">
              <li>
                <Link href="/legal?doc=privacy" className="transition hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/legal?doc=terms" className="transition hover:text-white">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/legal?doc=child-safety" className="transition hover:text-white">
                  Child Safety Policy
                </Link>
              </li>
              <li>
                <Link href="/legal?doc=ai-charter" className="transition hover:text-white">
                  Guidance Principles
                </Link>
              </li>
              <li>
                <Link href="/legal?doc=dpa" className="transition hover:text-white">
                  School Data Agreement
                </Link>
              </li>
              <li>
                <Link href="/legal?doc=ledger-governance" className="transition hover:text-white">
                  Data Deletion &amp; Records
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 text-xs text-slate-400 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} SparkTrack. Built with privacy and child-safety safeguards.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/legal" className="inline-flex items-center gap-1 hover:text-white">
              <Scale className="h-3.5 w-3.5 text-cyan-400" /> Privacy &amp; Terms
            </Link>
            <Link href="/contact" className="inline-flex items-center gap-1 hover:text-white">
              <HeartHandshake className="h-3.5 w-3.5 text-coral-500" /> Contact Us
            </Link>
            <Link href="/parent/consent" className="inline-flex items-center gap-1 hover:text-white">
              <UsersRound className="h-3.5 w-3.5 text-emerald-400" /> Parent SMS Code
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
