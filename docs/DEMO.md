# FraudShield — Operational Demonstration Walkthrough

Follow this 10-step interactive demonstration walkthrough in the FraudShield platform:

---

### Step 1: Login & Status Inspection
1. Open the FraudShield dashboard at `http://localhost:3000`.
2. Notice the top status bar:
   - AI: `ONLINE`
   - ML: `ENABLED`
   - Fallback Policy: `LEVEL 1 AI/ML`
   - Blockchain Mode: `SIMULATED`
   - WebSocket: `LIVE FEED`
3. Notice the User Role switcher in the top right. Default active role is `FRAUD_ANALYST (Marcus S.)`.

---

### Step 2: Screen a Legitimate Consignment (Scenario A)
1. Click **Live Bookings** in the navigation.
2. Under "One-Click Operational Demonstration Scenarios", click **Scenario A**.
   - Shipper: Apex Precision Tools Ltd (SHP-101)
   - Route: Mumbai to Bengaluru
   - Weight: 6.2 kg
3. Click **SCREEN CONSIGNMENT**.
4. Observe:
   - Risk Score: **Low (5-6 / 100)**
   - Decision: **ALLOW**
   - Detection Policy: **LEVEL 1 — AI/ML DETECTION**
   - Digital Trust Index: **96 / 100**
   - Privilege Integrity Matrix: All fields (Destination, Service, Weight, Payment) report **MATCH / COMPLIANT**.

---

### Step 3: Screen an Account Takeover / 180kg Privilege Abuse Consignment (Scenario B)
1. On the **Live Bookings** screen, click **Scenario B**.
   - Shipper: Nexus BioLogistics Pharma (SHP-202)
   - Route: Delhi to Frankfurt Airport Cargo Hub (DE-FRA-FRANKFURT)
   - Weight: **180.0 kg** (36.0x historical average of 5.0 kg!)
   - Terminal: Tor Exit Node (DEV-999)
   - Payment: Offshore Prepaid Card with Mismatched Name (PM-888)
2. Click **SCREEN CONSIGNMENT**.
3. Observe:
   - Risk Score: **Critical (78 - 92 / 100)**
   - Decision: **BLOCK** (Carrier dispatch locked)
   - GenAI Explanation synthesizes the exact observed evidence without hallucinating.
   - Privilege Matrix flags:
     - Destination: **VIOLATION** (Strictly domestic account attempting international route)
     - Weight: **EXCEEDED BY 36.0x** (Breaches 40.0 kg ceiling)
   - A new forensic incident is automatically created!
4. Click **Open Investigation Workspace** at the bottom of the result panel.

---

### Step 4: Incident Investigation Workspace
1. In the Incident Investigation Workspace:
   - **Chronological Timeline (Left)**: Review database-driven sequence from Account Authentication &rarr; Tor Hardware Fingerprint &rarr; Payment Injected &rarr; Route Change &rarr; Fraud Score &rarr; BLOCK &rarr; Incident Created &rarr; Evidence Sealed.
   - **Center Graph**: Cytoscape interactive topology showing all involved entities.
2. Click **TRACE ATTACK PATH**:
   - The compromised pathway from Account &rarr; Device DEV-999 &rarr; Booking &rarr; Risk Engine &rarr; Decision &rarr; Incident is highlighted in vibrant terracotta/orange.
3. Click **Play** on the timeline replay bar:
   - Watch the events progress step-by-step with real-time highlighted graph nodes!

---

### Step 5: Cryptographic SHA-256 Evidence Chain & Tamper Detection
1. Scroll down to the **Tamper-Evident SHA-256 Forensic Evidence Ledger**.
2. Click **Verify Hash** on any evidence item:
   - The engine recalculates the SHA-256 from payload and previous hash.
   - Confirms: **HASH_MATCH** and **UNBROKEN** chain continuity.
3. Click **Inject Tamper**:
   - The payload is altered in memory.
4. Click **Verify Hash** again:
   - Confirms: **HASH_MISMATCH** and **TAMPER DETECTED**!
5. Click **Restore Payload** to return to sealed integrity.

---

### Step 6: Off-Chain Blockchain Anchoring
1. Click **Anchor Proof** next to any evidence item:
   - State is anchored in `SIMULATED` mode.
   - Block number, simulated transaction hash, and Merkle root are confirmed.
2. Explicit disclaimer is visible: *BLOCKCHAIN MODE: SIMULATED (Zero-trust off-chain anchor)*.

---

### Step 7: Generate Authentic PDF Reports
1. In the Incident Workspace, click **Download Dossier PDF**:
   - The backend compiles an authentic, styled PDF file (`reports/fraud_investigation_...pdf`) and downloads it.
2. Click **Export Compliance PDF**:
   - Generates a **Regulatory Compliance Verification Report** containing statutory citations and the mandatory notice:
     *"This is an automated compliance verification record and is not a government-issued approval."*

---

### Step 8: Test Level 2 Rule-Based Fallback (AI/ML Disabled)
1. Click **Settings** in the navbar.
2. Uncheck **Isolation Forest ML Anomaly Engine** to disable ML.
3. Click **SAVE SETTINGS**.
4. Notice the top status bar now displays: **LEVEL 2 FALLBACK ACTIVE**.
5. Return to **Live Bookings** and click **Scenario E**.
6. Click **SCREEN CONSIGNMENT**.
7. Observe:
   - Detection Policy explicitly shows: **LEVEL 2 — RULE-BASED FALLBACK**.
   - ML status shows: `DISABLED`.
   - The deterministic rules and heuristics still successfully detect and BLOCK the consignment. The system never fails open.
8. Return to Settings and re-enable ML.

---

### Step 9: Audit Trail Inspection
1. Click the **Audit Trail** button in the top navbar.
2. Inspect the append-only security log:
   - Captures user logins, role switches, booking screening decisions, evidence verifications, tampering flags, and PDF compilations with timestamps and IP addresses.

---

### Step 10: Reset Demo State
1. Click **Reset Demo** in the top navbar.
2. Confirms pristine state reloaded across all databases and scenarios.
