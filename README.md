# FraudShield — Pre-Shipment Shipping Fraud Detection & Forensic Intelligence Platform

> **FraudShield doesn't just detect fraud — it explains, prevents, documents, reconstructs, and preserves evidence of fraud.**

FraudShield is a production-grade, enterprise pre-shipment risk screening, forensic intelligence, and regulatory compliance platform. It evaluates consignments before carrier dispatch to detect account takeover, cargo weight anomalies, privilege abuse, suspicious hardware infrastructure, and customs violations.

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

---

## Quickstart

### Prerequisites
- Node.js 20+
- Python 3.10+ (for test suite and utility scripts)

### Installation & Run
```bash
# 1. Install dependencies
npm install

# 2. Run one-command platform start
npm run dev
# Or: python3 run.py
```
Open **http://localhost:3000** in your browser.

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
