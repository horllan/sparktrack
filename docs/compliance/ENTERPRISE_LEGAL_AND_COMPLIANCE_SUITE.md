# SparkTrack Enterprise Legal, Privacy, Child Safeguarding & International Compliance Suite

**Document Version:** 2.0 (Enterprise Multi-Jurisdictional Edition)  
**Effective Date:** October 25, 2026  
**Scope:** Nigeria (Primary Launch Jurisdiction) • Pan-Africa (AU, South Africa, Kenya, Ghana, Rwanda) • International (EU/UK, United States, Global)

---

## 1. Executive Regulatory Matrix (Nigeria → Africa → Global)

SparkTrack is a **Longitudinal Youth Capability & Future Pathways Intelligence Platform** serving Junior and Senior Secondary learners (`Primary 5 – SS3`, ages 10–18), parents/guardians, schools, mentors, and youth development organisations. Because our core users include minors, SparkTrack enforces a **strictest-standard-wins** compliance architecture across all target jurisdictions:

| Jurisdiction | Governing Statutes & Frameworks | SparkTrack Technical & Legal Enforcement |
| :--- | :--- | :--- |
| **Nigeria (Launch Market)** | • **Nigeria Data Protection Act (NDPA) 2023** (Sections 24–38, Section 31 on Children, Sections 41–43 Cross-Border)<br>• **NDPC General Application & Implementation Directive (GAID)**<br>• **Child's Rights Act (CRA) 2003**<br>• **FCCPC Consumer Protection Act** | • Mandatory `PENDING_PARENTAL_CONSENT` lock on all minor profiles (`core.learner_profiles`).<br>• Verifiable 6-digit HMAC-SHA256 SMS OTP consent via Termii (`evidence.parental_consent_challenges`) or direct authenticated Parent Portal registration.<br>• Append-only `evidence.parental_consent_audit` trail.<br>• Default-false toggles for `allow_public_portfolio` and `allow_partner_talent_discovery`. |
| **Pan-Africa (Continental Expansion)** | • **AU Malabo Convention** (Cyber Security & Personal Data Protection)<br>• **South Africa POPIA** (Sections 34–35: Processing Personal Information of Children requires prior consent of a competent person)<br>• **Kenya Data Protection Act 2019** (Section 33)<br>• **Ghana Data Protection Act 2012 (Act 843)**<br>• **Rwanda Law No. 058/2021** | • Parent/Guardian ("Competent Person" under POPIA) or authorised School Administrator must provision JSS/SSS learners before any capability telemetry or project evidence is processed.<br>• Instant guardian revocation (`PATCH /v1/auth/consent/preferences/:learnerId`) sets status to `REVOKED` and immediately disables external visibility. |
| **European Union & United Kingdom** | • **EU/UK GDPR** (Article 6 Lawful Basis, Article 8 Child's Consent, Article 17 Right to Erasure, Article 20 Data Portability, Article 28 Processor DPA)<br>• **UK Age-Appropriate Design Code (Children's Code)**<br>• **EU AI Act** (Transparency & Human Oversight for Educational AI) | • High-privacy by default (Standard 7 of UK Children's Code): geolocation, camera, and microphone permissions disabled at HTTP header level (`Permissions-Policy: camera=(), microphone=(), geolocation=()`).<br>• Separation of PII (`core.users`) from pseudonymous ledger hashes (`evidence.cryptographic_ledger`) to honour Article 17 Right to Erasure without breaking SHA-256 chain integrity. |
| **United States & Global** | • **COPPA** (Children's Online Privacy Protection Act — 16 CFR Part 312)<br>• **FERPA** (Family Educational Rights and Privacy Act — 20 U.S.C. § 1232g)<br>• **UNESCO & UNICEF Policy Guidance on AI for Children** | • Direct parental notice and verifiable consent prior to collecting personal information from children.<br>• Schools act under institutional Data Processing Agreements (DPA) with strict prohibition on behavioural advertising or selling student data.<br>• Dual-layer **AI Guardrail** (`guardrail.spec.ts`) banning deterministic career/life labeling of minors. |

---

## 2. Privacy Policy & Multi-Jurisdictional Data Protection Notice

### 2.1 Data Controller vs. Data Processor Roles
1. **Family-Direct Accounts:** Where a Parent/Guardian registers directly on SparkTrack (`/auth?role=PARENT`), **SparkTrack Intelligence Ltd.** acts as the **Data Controller** (or "Responsible Party" under POPIA) under the lawful basis of **Verifiable Parental Consent** (NDPA Section 31; GDPR Article 8; POPIA Section 35; COPPA).
2. **School & Institutional Cohorts:** Where a School, Ministry of Education, or NGO registers learners (`/auth?role=SCHOOL_ADMIN`), the Institution acts as the **Data Controller** and SparkTrack acts as the **Data Processor** (or "School Official" under FERPA) governed by our **Institutional Data Processing Agreement (Section 6)**, while still enforcing Guardian NDPA Consent controls for public/partner sharing.

### 2.2 Categories of Data Collected & Purpose Limitation
SparkTrack collects **only** data strictly necessary for longitudinal skill development:
- **Identity & Guardian Linkage (`core.users`, `core.learner_profiles`):** Learner full name, date of birth, education stage (`Primary 5 – SS3`), school affiliation, and parent/guardian name, email, and phone number.
- **Learning Evidence (`evidence.artifacts`):** Project titles, descriptions, external project links, R2 media keys, self-tagged skill codes, and mentor rubric quality scores.
- **Behavioural Signal Observations (`evidence.mentor_signal_observations`):** Structured 1–4 intensity observations recorded by verified educators (e.g., *Analytical Problem Solving*, *Creative Framing*, *Persistence*).
- **Longitudinal Capability States (`intelligence.learner_capability_temporal`):** Bitemporal skill scores (`0.0000`–`1.0000`), progression levels (`BEGINNER`, `DEVELOPING`, `COMPETENT`, `ADVANCED`), and 13-part developmental reports.
- **Zero Behavioural Advertising:** SparkTrack **never** sells, rents, or uses student data for targeted advertising or commercial profiling.

### 2.3 Architectural Solution: Right to Erasure vs. SHA-256 Cryptographic Ledger Immutability
A core legal requirement under **NDPA Section 34(1)(c)** and **GDPR Article 17** is the **Right to Erasure ("Right to be Forgotten")**. Meanwhile, SparkTrack seals project evidence into an append-only SHA-256 hash chain (`evidence.cryptographic_ledger`).
- **How Both Are Satisfied Simultaneously:**
  - `evidence.cryptographic_ledger` stores **zero PII**—only `artifact_id` (UUID), `learner_id` (pseudonymous UUID), `payload_canonical_hash` (irreversible SHA-256 digest), `previous_ledger_hash`, and `row_signature_hash`.
  - All personally identifiable information resides exclusively in `core.users` and `core.learner_profiles`.
  - When a Parent/Guardian or Data Subject exercises their **Right to Erasure**, SparkTrack irreversibly scrubs and anonymizes the PII in `core.users` and `core.learner_profiles` and deletes media blobs in Cloudflare R2. Because the SHA-256 ledger contains only unlinked UUIDs and one-way cryptographic digests, the data is permanently de-identified in compliance with NDPA/GDPR while the mathematical hash chain remains valid for remaining users.

---

## 3. Terms of Service & Platform Acceptable Use Policy

### 3.1 Eligibility & Account Provisioning
- **Junior & Senior Secondary Students (`JSS1–SS3` / Under 18):** Must be registered by a Parent/Legal Guardian (`/auth?role=PARENT`) or an authorised School/Organisation (`/auth?role=SCHOOL_ADMIN`), or complete the Guardian SMS OTP Verification flow (`/parent/consent`) before evidence can be synced.
- **Parents & Guardians:** Must hold legal parental responsibility for any minor they register or grant consent for.
- **Mentors & Educators:** Must be vetted by a participating School, Partner Organisation, or SparkTrack Operations prior to being assigned to a cohort (`core.mentor_assignments`).

### 3.2 Intellectual Property Ownership of Student Work
- **Learners Retain 100% Ownership:** Every learner (and their family) retains full copyright and intellectual property ownership over all code, robotics designs, essays, videos, and business concepts submitted as `evidence.artifacts`.
- **Limited Platform License:** By uploading an artifact, the parent/learner grants SparkTrack a non-exclusive, revocable license solely to store, hash, display to authorised mentors/family members, and compute capability scores.

### 3.3 Programme Cohort Billing, Scholarships & Refund Policy
- **Payment Providers:** Paid cohorts are processed via **Paystack** (NGN / Africa) or **Stripe** (USD / International), verified via HMAC-SHA512 / webhook signatures (`BillingModule`).
- **Sponsored Scholarships & Free Pilots:** Learners enrolled under `SCHOLARSHIP` or `FREE_PILOT` receive full platform access at zero cost to the family.
- **Consumer Protection & Refunds (FCCPC Nigeria / International Standards):** Families may request a full refund within **14 days** of cohort payment prior to programme completion via `/contact`.

---

## 4. Child Protection, Safeguarding & Guardian Consent Policy

1. **Privacy by Default (Zero Public Exposure):** Every newly created learner profile is initialised with:
   - `consent_status = 'PENDING_PARENTAL_CONSENT'`
   - `allow_public_portfolio = FALSE`
   - `allow_partner_talent_discovery = FALSE`
2. **Granular Two-Tier Sharing Controls:**
   - Even after a parent verifies consent (`VERIFIED_ACTIVE`), the child's portfolio remains **internal-only** unless the parent explicitly checks `Allow Public Verifiable Portfolio` (`GET /v1/learning/portfolio/:learnerId` enforces this gate and strips last names to `FirstName (Stage)`).
   - External scholarship/talent discovery (`optInTalentPool`) requires the separate `Allow Partner Talent Discovery` toggle.
3. **Mentor Safeguarding Code of Conduct:**
   - Mentors interact with student work exclusively through structured rubric scores and curriculum-aligned cohort feedback (`evidence.mentor_signal_observations`). Direct unmonitored private messaging with minors is disabled by design.

---

## 5. AI Ethics, UNESCO/UNICEF Child AI & Non-Deterministic Guidance Charter

Aligned with the **UNESCO Recommendation on the Ethics of AI**, **UNICEF Policy Guidance on AI for Children**, and the **EU AI Act**:
1. **Exploration Over Predetermination:** SparkTrack's 6 intelligence engines and 13-Part Development Report are strictly designed to **expand** a young person's horizons—never to box a 10–17-year-old into a fixed career label.
2. **Automated Dual-Layer Guardrail Enforcement:**
   - Every generated report is scanned by `GuardrailService` (`apps/api-core/src/intelligence-core/recommendation-engine/guardrail.spec.ts`) before storage.
   - Deterministic phrases (`"must become"`, `"is destined for"`, `"only suited for"`, `"cannot succeed in"`, `"fixed talent"`, `"permanent career"`) are automatically rejected and replaced with exploratory framing (`"shows emerging affinity for"`, `"could explore"`, `"developing momentum in"`).
3. **Human-in-the-Loop Verification:** AI synthesis never grades raw student files in isolation; skill progression weights rely on human mentor rubric verification (`1.35×` verified weight) and transparent mathematical formulas.

---

## 6. Institutional Data Processing Agreement (DPA) for Schools, NGOs & Ministries

When a School, School District, NGO, or Ministry of Education uses SparkTrack:
1. **Security Controls:** Row-Level Security (RLS) enforced at the PostgreSQL 17 database layer (`0005_rls_and_security.sql` via `core.fn_can_access_learner`), TLS 1.3 in transit, AES-256 at rest, and strict HTTP security headers (`Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).
2. **Authorized Sub-Processors:**
   - **Supabase / AWS (`eu-west-1`):** Managed PostgreSQL 17 database & authentication.
   - **Cloudflare R2:** Encrypted object storage for project artifacts via presigned URLs.
   - **Termii:** Transactional SMS OTP delivery for Nigerian/African guardian verification.
   - **Paystack & Stripe:** PCI-DSS Level 1 compliant payment processing.
   - **Google Cloud Vertex / Gemini API:** Zero-data-retention narrative synthesis for the 13-part report (receives only structured skill scores and anonymized stage context—never student contact PII).
3. **Breach Notification SLA:** SparkTrack notifies institutional controllers and the Nigeria Data Protection Commission (NDPC) / relevant supervisory authority within **72 hours** of confirming any personal data breach (NDPA Section 40; GDPR Article 33).

---

## 7. Data Protection Officer (DPO) & Support Escalation Channels

- **Data Protection Officer (DPO):** `dpo@sparktrack.org`
- **School & Institutional Partnerships:** `partnerships@sparktrack.org`
- **Online Support & DPO Portal:** `/contact` (tracked in `core.support_tickets` and triaged by SparkTrack Operations in `/admin/dashboard`).

