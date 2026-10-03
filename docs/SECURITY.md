# FraudShield Security & DevSecOps Architecture

## 1. Authentication & Role-Based Access Control (RBAC)
- **Token Mechanism**: Standard JSON Web Tokens (JWT) signed with HMAC-SHA256, expiring after 24 hours.
- **Passwords**: One-way cryptographic hashing using `bcrypt` (work factor 8+).
- **Roles**:
  - `ADMIN`: Full configuration, weight calibration, user management, and manual override capabilities.
  - `FRAUD_ANALYST`: Incident investigation, attack path tracing, and disposition updates.
  - `COMPLIANCE_ANALYST`: Regulatory verification and compliance report generation.
  - `AUDITOR`: Read-only verification of evidence hash chains and append-only audit trails.
  - `VIEWER`: Read-only access to operational overview.

## 2. Cryptographic Evidence Chain of Custody
- Every critical forensic event (Authentication, Hardware Detection, Payment Assignment, Risk Calculation, Block Decision) creates an append-only evidence record.
- **Hash Formula**:
  $$H_n = \text{SHA-256}(H_{n-1} \mathbin{\Vert} \text{CanonicalJSON}(D_n))$$
- Genesis anchor uses a 64-zero initial digest.
- Verification endpoint `/api/v1/evidence/:id/verify` recalculates the digest dynamically from payload data to detect tampering or broken chain continuity.

## 3. Off-Chain Blockchain Anchoring
- Sensitive shipment cargo manifests, consignor KYC identities, and commercial prices are preserved **strictly off-chain**.
- Only the cryptographic SHA-256 evidence digests and Merkle roots are anchored.
- In `SIMULATED` mode, verifiable local cryptographic proofs with block numbers and transaction hashes are generated, explicitly labeled to prevent false claims.

## 4. Safe AI/ML Integration & Deterministic Fallbacks
- The Generative AI layer (`@google/genai`) is **strictly an explainability engine for pre-computed evidence**.
- It does **not** decide whether a consignment is blocked or allowed.
- If the AI API is unavailable, the system transparently utilizes the deterministic rule synthesis engine without disruption.
- If the ML Anomaly Detection engine is disabled or has insufficient historical data, the system automatically transitions to **LEVEL 2 — RULE-BASED FALLBACK**.
- The platform **never fails open**.
