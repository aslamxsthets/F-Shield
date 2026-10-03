# FraudShield REST & WebSocket API Specification

## Authentication
- `POST /api/v1/auth/login`: Authenticate user or switch roles (Admin, Fraud Analyst, Compliance Analyst, Auditor, Viewer).
- `POST /api/v1/auth/logout`: Terminate session and record audit event.
- `GET /api/v1/auth/me`: Get authenticated user profile.

## Consignment Screening
- `POST /api/v1/bookings/screen`: Pre-shipment risk screening pipeline.
  - Body: `shipper_id`, `account_id`, `payment_id`, `device_id`, `origin`, `destination`, `weight_kg`, `service_type`, `package_category`, `declared_value_usd`.
  - Returns: `booking`, `assessment`, `incident` (if quarantined), `processing_ms`.
- `GET /api/v1/bookings`: List screened bookings.
- `GET /api/v1/bookings/:id`: Retrieve single booking dossier.

## Forensic Incidents & Timeline
- `GET /api/v1/incidents`: List quarantined incidents.
- `GET /api/v1/incidents/:id`: Detailed incident dossier with timeline, attack path, and evidence.
- `PATCH /api/v1/incidents/:id`: Update status (OPEN, UNDER_REVIEW, RESOLVED, FALSE_POSITIVE, ESCALATED) or analyst assignment.
- `GET /api/v1/incidents/:id/timeline`: Get chronological event timeline.
- `GET /api/v1/incidents/:id/topology`: Get scoped Cytoscape graph elements and attack path.
- `POST /api/v1/incidents/:id/replay`: Replay incident execution step by step.

## Cryptographic Evidence
- `GET /api/v1/evidence`: Retrieve evidence ledger.
- `POST /api/v1/evidence/:id/verify`: Perform live SHA-256 integrity verification.
- `POST /api/v1/evidence/:id/tamper`: Simulate payload tampering to test detection.

## Blockchain Anchoring
- `POST /api/v1/blockchain/anchor`: Anchor evidence hash off-chain with cryptographic proof.
- `POST /api/v1/blockchain/verify`: Verify anchored state against block and Merkle root.

## Statutory Compliance
- `GET /api/v1/compliance/rules`: List statutory regulatory acts (CBIC, Courier Regs, Merchant Shipping).
- `GET /api/v1/compliance/:booking_id`: List statutory check records for a booking.
- `POST /api/v1/compliance/:booking_id/verify`: Execute compliance evaluation on booking.

## Real PDF Reports
- `GET /api/v1/reports`: List compiled report catalog.
- `POST /api/v1/reports/fraud`: Compile Fraud Investigation Dossier PDF.
- `POST /api/v1/reports/compliance`: Compile Regulatory Compliance Verification Report PDF.
- `POST /api/v1/reports/evidence`: Compile Evidence Manifest PDF.
- `GET /api/v1/reports/download/:filename`: Stream generated PDF file.

## System Configuration & Audit
- `GET /api/v1/dashboard/metrics`: Aggregate KPIs, distributions, and risk trends.
- `GET /api/v1/settings`: Get system weights, thresholds, and feature flags.
- `PATCH /api/v1/settings`: Update weights, thresholds, or toggle ML/AI.
- `GET /api/v1/audit`: Query append-only security audit events.
- `POST /api/v1/demo/reset`: Reset database to pristine calibrated scenarios.

## WebSocket Live Feed
- `WS /ws/live`: Real-time streaming of `BOOKING_SCREENED`, `INCIDENT_CREATED`, `EVIDENCE_SEALED`, `SETTINGS_UPDATED`.
