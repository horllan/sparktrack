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
            <p className="max-w-sm text-sm leading-6 text-slate-400">
              Longitudinal Youth Capability &amp; Future Pathways Intelligence. Built in Nigeria for Africa and the
              world—helping Junior and Senior Secondary learners turn real projects into verified skills.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-xs font-medium text-cyan-300">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1">
                <ShieldCheck className="h-3.5 w-3.5" /> NDPA 2023 • POPIA • GDPR
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

          {/* Support & Partnerships */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white">Support &amp; Contact</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/contact" className="transition hover:text-white">
                  Contact Us &amp; Support Desk
                </Link>
              </li>
              <li>
                <Link href="/contact?category=SCHOOL_PARTNERSHIP" className="transition hover:text-white">
                  School &amp; Ministry Partnerships
                </Link>
              </li>
              <li>
                <Link href="/contact?category=SCHOLARSHIP_SPONSORSHIP" className="transition hover:text-white">
                  Sponsor Youth Scholarships
                </Link>
              </li>
              <li>
                <Link href="/contact?category=PRIVACY_DPO_REQUEST" className="transition hover:text-white">
                  Data Protection Officer (DPO)
                </Link>
              </li>
              <li>
                <Link href="/#tour" className="transition hover:text-white">
                  Interactive Platform Tour
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal, Privacy & Compliance */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white">Legal &amp; Compliance</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/legal?doc=privacy" className="transition hover:text-white">
                  Privacy Policy (NDPA / POPIA / GDPR)
                </Link>
              </li>
              <li>
                <Link href="/legal?doc=terms" className="transition hover:text-white">
                  Terms of Service &amp; Acceptable Use
                </Link>
              </li>
              <li>
                <Link href="/legal?doc=child-safety" className="transition hover:text-white">
                  Child Safety &amp; Consent Charter
                </Link>
              </li>
              <li>
                <Link href="/legal?doc=ai-charter" className="transition hover:text-white">
                  AI Ethics &amp; Non-Deterministic Policy
                </Link>
              </li>
              <li>
                <Link href="/legal?doc=dpa" className="transition hover:text-white">
                  School Institutional DPA
                </Link>
              </li>
              <li>
                <Link href="/legal?doc=ledger-governance" className="transition hover:text-white">
                  SHA-256 Ledger &amp; Right to Erasure
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 text-xs text-slate-400 sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} SparkTrack Intelligence Platform. Compliant with Nigeria NDPA 2023, Child’s
            Rights Act 2003, AU/POPIA, GDPR &amp; COPPA.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/legal" className="inline-flex items-center gap-1 hover:text-white">
              <Scale className="h-3.5 w-3.5 text-cyan-400" /> Legal Center
            </Link>
            <Link href="/contact" className="inline-flex items-center gap-1 hover:text-white">
              <HeartHandshake className="h-3.5 w-3.5 text-coral-500" /> Contact Support
            </Link>
            <Link href="/parent/consent" className="inline-flex items-center gap-1 hover:text-white">
              <UsersRound className="h-3.5 w-3.5 text-emerald-400" /> SMS Consent Portal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
