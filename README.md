# F-Shield - Pre-Shipment Shipping Fraud Detection & Forensic Intelligence Platform

> **F-Shield doesn't just detect fraud - it explains, prevents, documents, reconstructs and preserves evidence of fraud.**

F-Shield is a production-grade, enterprise pre-shipment risk screening, forensic intelligence, and regulatory compliance platform. It evaluates consignments before carrier dispatch to detect account takeover, cargo weight anomalies, privilege abuse, suspicious hardware infrastructure, and customs violations.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Cytoscape.js |
| Backend | Node.js, Express, TypeScript (`tsx`), REST API, WebSocket (`ws`) |
| Data | Supabase Postgres JSONB snapshot when configured; local JSON cache/fallback (`data/fraudshield_store.json`) |
| AI | Groq Chat Completions with tool calling for record retrieval; Google GenAI SDK for screening explanations |
| Security | JWT sessions, bcrypt password hashes, encrypted TOTP secrets, Google Identity Services OAuth |
| Reports and evidence | jsPDF, Node.js cryptography, SHA-256 evidence hashes |
| Testing and utilities | Python 3.10+ scripts, TypeScript compiler |

---

## Key Capabilities

1. **Pre-Shipment Screening Pipeline (`/api/v1/bookings/screen`)**:
   - Identity & Permission Engine (authorized vs observed boundaries)
   - Dynamic Shipper Behavioral Baseline (e.g. 36.0x historical deviation detection)
   - Cold Start Detection (progressive trust without unfair penalties)
   - Payment Risk & Beneficiary Cardholder Mismatch
   - Device & Network Graph Linkage (Tor exit nodes, proxy clusters, reused sybil devices)
   - Multivariate ML Anomaly Scoring (Isolation Forest heuristic vector)
   - Normalized 0–100 Composite Risk Scoring with configurable weights
   - Three-Level Fallback Policy (Level 1: AI/ML &rarr; Level 2: Deterministic Rules & Heuristics &rarr; Level 3: Human Review)
   - Explainable AI Synthesis (Google GenAI SDK with deterministic fallback)
   - Digital Trust Index (0–100 separate trust evaluation)

2. **Interactive Relationship Topology (Cytoscape.js)**:
   - Hierarchical multi-layer layout: Shipper &rarr; Account/Device/Payment &rarr; Consignment &rarr; Fraud Engine &rarr; Decision &rarr; Evidence Chain &rarr; Blockchain Anchor
   - Dynamic Attack Path Reconstruction (`TRACE ATTACK PATH`)
   - Forensic Incident Replay (`PLAY`, `PAUSE`, `RESTART`, `NEXT EVENT`)
   - Interactive Node & Edge telemetry inspectors

3. **Tamper-Evident SHA-256 Forensic Evidence Ledger**:
   - Cryptographic sequential hash chaining (`H_n = SHA256(H_{n-1} : CanonicalContent)`)
   - Real-time cryptographic verification (`/api/v1/evidence/:id/verify`)
   - Live tamper simulation and mismatch detection

4. **Blockchain Anchor Adapter**:
   - Verified off-chain state anchoring
   - Explicitly labeled `SIMULATED` mode with verifiable proofs (block number, transaction hash, Merkle root)
   - Configurable for real public RPC providers

5. **Statutory Shipping & Customs Regulatory Compliance**:
   - Verified statutory knowledge base:
     - Customs Act, 1962 (Section 46/50/111)
     - Courier Imports and Exports (Clearance) Regulations, 1998 (Regulation 5(1)/12)
     - Merchant Shipping Act, 1958 (Section 334/335)
     - FEMA 1999 & PMLA Rules
   - Automated Compliance Verification Record generation
   - Explicit statutory distinction disclaimer: *"This is an automated compliance verification record and is not a government-issued approval."*

6. **Authentic PDF Dossiers (jsPDF)**:
   - Fraud Investigation Dossier PDF
   - Regulatory Compliance Verification Report PDF
   - Forensic Evidence Manifest PDF

7. **F-Shield Groq Chat**:
   - Multi-turn conversation using the Groq Chat Completions API
   - Read-only tool lookups for incidents, incident timelines/evidence, saved reports, shippers/bookings/accounts/devices/payments, and booking compliance checks
   - Matching saved reports appear as authenticated download buttons in chat
   - Greetings and general conversation do not receive an unrelated database summary

---

## Quickstart

### Prerequisites
- Node.js 20+
- Python 3.10+ (for test suite and utility scripts)

### Installation & Run
```bash
# 1. Install dependencies
npm install

# 2. Create local configuration from the template
cp .env.example .env

# 3. Configure GROQ_API_KEY in .env, then start the platform
npm run dev
# Or: python3 run.py
```
Open **http://localhost:3000** in your browser.

### Groq Chat Setup

- Set `GROQ_API_KEY` in the local `.env` file. The key is used by the server and is not sent to the browser.
- `GROQ_MODEL` defaults to `openai/gpt-oss-120b`; change it only to a model enabled for your Groq account.
- Restart `npm run dev` after changing `.env` so the server loads the new configuration.
- Ask in ordinary language, for example: “Show incident INC-2026-0042”, “What compliance checks were run for booking FS-BK-5255?”, or “Find the approval report for Apex Production Tools”. Follow-up questions use the same chat history.
- The assistant can search reports already in the archive and provide a download button. It does not generate new reports or modify records; use the Reports page to generate a report first.
- Groq rate limits can temporarily reject requests. Retry after the displayed error interval or reduce repeated requests.
- Carrier entries in the app are reference links, not live tracking data.

### Supabase Database Setup

- Create a Supabase project and open its SQL Editor.
- Run [`supabase/schema.sql`](supabase/schema.sql) once to create the private `f_shield_state` snapshot table with row-level security enabled.
- Copy the Supabase project URL and **service role key** into `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`. Keep the service role key server-side; never add it to a `VITE_` variable or browser code.
- Restart `npm run dev`. On first connection, F-Shield uploads the existing local store if the Supabase table is empty. If a snapshot exists, it becomes the startup state and refreshes the local JSON cache.
- Mutations continue saving locally and are mirrored to Supabase with a short debounce. If Supabase is unavailable or unconfigured, the app continues using local JSON storage; `/health` reports the active backend in `data_backend`.
- This first integration stores the current application state as one JSONB snapshot to preserve the synchronous store API. It is not yet a normalized relational schema; migrating each entity into PostgreSQL tables with foreign keys is a separate follow-up step.

### Account Sign-In and Authenticator Setup

- Copy `.env.example` to `.env` and set independent random `JWT_SECRET` and `TOTP_ENCRYPTION_KEY` values.
- To enable Google sign-in, create a Google OAuth 2.0 Web application client ID and set it as both `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`. Add your app origin (for local use, `http://localhost:3000`) to the authorized JavaScript origins.
- Create an account with a username, email, phone number, and password, or use a seeded demo account. Seeded accounts use the development password `fraudshield2026!`.
- On first sign-in, scan/import the displayed `otpauth://` setup link or manually enter the one-time secret into Google Authenticator. Enter the current six-digit code to activate enrollment. Subsequent sign-ins require a fresh code from the enrolled authenticator.
- Keep `.env` local and never commit API keys or authentication secrets. Rotate any key that has been exposed.
- Envia.com and Webshipx are shipping platforms, not identity providers. Their API connections need separate provider credentials and should be configured as shipping integrations rather than sign-in buttons.

### Run Automated Forensic Test Suite
```bash
python3 scripts/run_tests.py
```

### Reset Demo Scenarios
```bash
python3 scripts/seed.py
```

---

## Demonstration Scenarios (One-Click in UI)

- **Scenario A — Legitimate Domestic**: 6.2 kg shipment from Mumbai to Bengaluru. Conforms to historical baselines &rarr; `ALLOW`.
- **Scenario B — Account Takeover & Privilege Abuse**: 180.0 kg shipment (36.0x avg) to Frankfurt on Tor device and prepaid card &rarr; `BLOCK`, Incident created, Attack Path ready, Evidence sealed.
- **Scenario C — Cold Start Account**: Fresh account with verified KYC &rarr; Progressive trust &rarr; `ALLOW / COLD START`.
- **Scenario D — Reused Suspicious Terminal**: Device previously linked to blocked account &rarr; Graph relationship alert &rarr; `HOLD/BLOCK`.
- **Scenario E — AI/ML Failure / Level 2 Fallback**: Disable AI/ML in Settings &rarr; System operates under `LEVEL 2 — RULE-BASED FALLBACK`.
- **Scenario F — Statutory Customs Clearance**: Consignment exceeding courier thresholds &rarr; Triggers formal Shipping Bill clearance checks.
