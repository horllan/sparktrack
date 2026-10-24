# SPARKTRACK MASTER PRODUCT, SOLUTIONS ARCHITECTURE & IP BLUEPRINT (v2.0)

**Product:** SparkTrack  
**Core IP:** SparkTrack Intelligence  
**Author / Solutions Architect:** Funmibi Makanjuola  
**Target IDE:** VS Code with Google Antigravity Extension  
**Target Stack:** Turborepo TypeScript Monorepo | Next.js 15+ PWA | NestJS (Fastify) | PostgreSQL 17 (Supabase) | Drizzle + Kysely | LangGraph.js + Google Gemini | Cloudflare R2 | Upstash Redis | Paystack + Stripe

---

## MODULE 1: EXECUTIVE VISION, STRATEGIC PRODUCT CHARTER, MULTI-SIDED ECOSYSTEM & CORE IP FRAMEWORK

### 1.1 Executive Summary & Core Thesis
SparkTrack is an intelligence-driven early talent development ecosystem designed to help young people discover, develop, and demonstrate their practical capabilities before career decisions become expensive or irreversible. It replaces the broken linear model (`Education -> Degree -> Graduation -> "Now what?"`) with a continuous longitudinal loop:
`Exposure -> Exploration -> Skill Development -> Project Experience -> Evidence -> Intelligence -> Direction -> Advanced Development -> Opportunity`.

### 1.2 The 10 Governing Architectural & Product Values
1. **Early Exposure (Ages 10–17+)**
2. **Exploration Before Specialisation** (`Expose broadly -> identify interests -> deepen selectively`)
3. **Evidence Over Assumption** (*"What can you demonstrate after completing the experience?"*)
4. **Development Over Labelling** (*Career Exploration* rather than *Career Assignment*)
5. **Continuous Uncertainty Reduction**
6. **Human + Machine Intelligence** (3-minute structured mentor micro-rubrics combined with AI synthesis)
7. **Longitudinal Continuity** (Multi-holiday and multi-year progression)
8. **Multi-Pathway Inclusivity** (Career & Employment Pathways + Entrepreneurship & Business Pathways)
9. **African Realities & Hybrid Accessibility** (Offline-First PWA, low-bandwidth sync, Paystack local payments)
10. **Responsible Intelligence & Child Safety** (NDPA compliance, Verifiable Parental Consent, RLS tenant isolation)

### 1.3 Mathematical Specification of Progression (`ProgressEngine`)
A learner's skill score $S(u, k, t)$ for user $u$ on skill $k$ at time $t$ uses Time-Decayed Evidence Weighting with Mentor Verification Multipliers:
$$S(u, k, t) = \sum_{i=1}^{N} \left( Q_i \cdot W_{\text{type}(i)} \cdot M_{\text{verifier}(i)} \cdot C_{\text{complexity}(i)} \cdot e^{-\lambda (t - t_i)} \right)$$
mapping continuously to **`BEGINNER -> DEVELOPING -> COMPETENT -> ADVANCED`**.

---

## MODULE 2: THE "SQL AI DEVELOPER" DATABASE ENGINEERING SPECIFICATION
See executable SQL migrations in:
- `packages/db/migrations/0001_sparktrack_core_architecture.sql`
- `packages/db/migrations/0002_seed_capability_graph.sql`

### Key Specialized Database Objects Implemented:
1. **Cryptographic Append-Only Ledger (`evidence.cryptographic_ledger`):** SHA-256 hash chaining (`trg_seal_ledger_before_insert`) and strict immutability (`trg_immutable_ledger`).
2. **Bitemporal System-Versioned Progression (`intelligence.learner_capability_temporal`):** Uses `TSTZRANGE` and GiST exclusion constraints with `intelligence.fn_get_learner_profile_as_of(learner_id, timestamp)` for time-travel queries.
3. **Schema-Validated Polymorphic `JSONB` (`evidence.artifacts`):** Indexed with `GIN (payload jsonb_path_ops)` and idempotent `client_sync_id` for offline PWA sync.
4. **Hybrid Graph + `pgvector` HNSW (`intelligence.graph_nodes` & `graph_edges`):** Uses 16-bit quantized `halfvec(768)` embeddings with HNSW indexing alongside directed weighted graph edges.
5. **In-Memory & Materialized Performance Layer (`analytics`):** Uses `UNLOGGED` scratchpad tables, declarative yearly range partitioning on `learning_telemetry`, and `mv_learner_development_summary`.

---

## MODULE 3: SYSTEM, AI & HYBRID CLOUD ARCHITECTURE
- **Monorepo Layout:**
  - `apps/web-platform`: Next.js App Router PWA (Student, Parent, Mentor, School, Admin Portals)
  - `apps/api-core`: NestJS (Fastify adapter) split strictly into `src/platform-modules` and `src/intelligence-core`
  - `packages/db`: Drizzle ORM + Kysely Typed SQL + Raw PostgreSQL migrations
  - `packages/contracts`: Shared Zod schemas (including the 13-part SparkTrack Development Report schema)
  - `packages/offline-sync`: Dexie.js IndexedDB + Service Worker Background Sync
  - `packages/ui`: Tailwind CSS + Shadcn UI + TanStack Query/Table

---

## MODULE 4: MVP SCOPE, HOLIDAY PILOT, MONETIZATION & NDPA CHILD SAFETY
- **Phase 1 MVP Vertical Slice:** `Student -> Onboarding -> Learning Activity -> Project -> Assessment -> Evidence -> Skill Assessment -> Skill Profile -> Career / Development Insight`.
- **4 Revenue Streams:**
  1. **B2C:** SparkTrack Holiday Experience Tuition + Annual/Termly Longitudinal Profile Subscriptions (via Paystack).
  2. **B2B:** Partner Secondary School Co-Curricular SaaS & Analytics Portal (Paystack Split Payments / Institutional Invoicing).
  3. **B2B2C:** NGO, CSR Foundation & Government Sponsored Youth Cohorts.
  4. **Enterprise IP (Phase 4):** Licensing the headless **SparkTrack Intelligence API** via Stripe & Paystack.
