# F-Shield Database Architecture & Relational Schema

F-Shield features a zero-loss file-persisted relational database engine stored in `data/fraudshield_store.json` (with PostgreSQL compatibility schema for distributed deployments).

## Relational Entities

1. **Shipper (`shippers`)**:
   - `id` (PK): e.g. `SHP-101`
   - `company_name`: string
   - `email`, `phone`, `country`: string
   - `status`: `ACTIVE` | `SUSPENDED` | `BLOCKED` | `FLAGGED`
   - `trust_score`: integer (0-100)
   - `verified_identity`: boolean
   - `kyc_status`: `VERIFIED` | `PENDING` | `REJECTED`
   - `average_weight_kg`, `max_weight_kg`: float
   - `common_origins`, `common_destinations`: array of strings
   - `historical_incidents_count`: integer

2. **Account (`accounts`)**:
   - `id` (PK): e.g. `ACC-101`
   - `shipper_id` (FK &rarr; `shippers.id`)
   - `account_number`: string
   - `tier`: `STANDARD` | `PREMIUM` | `ENTERPRISE`
   - `status`: `ACTIVE` | `SUSPENDED` | `BLOCKED`
   - `is_cold_start`: boolean
   - `credit_limit`: float

3. **PermissionProfile (`permission_profiles`)**:
   - `id` (PK): e.g. `PERM-101`
   - `account_id` (FK &rarr; `accounts.id`)
   - `allowed_domestic`, `allowed_international`: boolean
   - `allowed_service_types`: array of strings
   - `max_weight_kg`: float ceiling
   - `approved_destinations`, `approved_origins`: array of strings
   - `allowed_payment_types`: array of strings

4. **Device (`devices`)**:
   - `id` (PK): e.g. `DEV-101`
   - `device_fingerprint`: SHA-256 hardware identifier
   - `ip_address`: IPv4 string
   - `network_asn`: Autonomous System Number & carrier
   - `is_flagged_suspicious`: boolean
   - `previously_blocked_link`: string (FK linkage to prior sybil incidents)
   - `associated_accounts`: array of account IDs

5. **PaymentMethod (`payment_methods`)**:
   - `id` (PK): e.g. `PM-101`
   - `account_id` (FK &rarr; `accounts.id`)
   - `payment_type`: `CREDIT_CARD` | `CORPORATE_ACH` | `PREPAID` | `WIRE_TRANSFER`
   - `masked_number`: string
   - `card_holder`: string
   - `is_verified`, `risk_flag`: boolean

6. **Booking (`bookings`)**:
   - `id` (PK): e.g. `BKG-2026-1001`
   - `booking_reference`: e.g. `FS-BK-1001`
   - `shipper_id` (FK), `account_id` (FK), `payment_id` (FK), `device_id` (FK)
   - `origin`, `destination`: strings
   - `weight_kg`, `declared_value_usd`: float
   - `service_type`, `package_category`: strings
   - `status`: `PROCESSED` | `HELD` | `BLOCKED`

7. **RiskAssessment (`risk_assessments`)**:
   - `id` (PK): e.g. `RSK-1001`
   - `booking_id` (FK &rarr; `bookings.id`)
   - Component scores: `identity_score`, `behavior_score`, `shipment_score`, `payment_score`, `destination_score`, `compliance_score` (each 0-100)
   - `final_score`: 0-100
   - `decision`: `ALLOW` | `HOLD` | `BLOCK`
   - `digital_trust_score`: 0-100
   - `fallback_level`: string
   - `explanation`: string
   - `authorized_vs_observed`: JSON object

8. **Incident (`incidents`)**:
   - `id` (PK): e.g. `INC-2026-0042`
   - `booking_id` (FK)
   - `severity`: `LOW` | `MEDIUM` | `HIGH` | `CRITICAL`
   - `risk_score`: integer
   - `decision`: `HOLD` | `BLOCK`
   - `status`: `OPEN` | `UNDER_REVIEW` | `RESOLVED` | `FALSE_POSITIVE` | `ESCALATED`
   - `attack_path_node_ids`: array of node IDs

9. **Evidence (`evidence`)**:
   - `id` (PK): e.g. `EVD-001-AUTH`
   - `incident_id` (FK)
   - `previous_hash`: SHA-256 (64 hex)
   - `current_hash`: SHA-256 (64 hex)
   - `content_data`: canonical JSON dictionary
   - `is_tampered`: boolean flag

10. **BlockchainAnchor (`blockchain_anchors`)**:
    - `id` (PK)
    - `evidence_id` (FK)
    - `anchor_tx_id`: string
    - `block_number`: integer
    - `network_mode`: `SIMULATED` | `REAL`
    - `document_hash`: string
    - `merkle_root`: string

11. **AuditEvent (`audit_events`)**:
    - `id` (PK)
    - `actor_name`, `actor_role`: string
    - `action`, `resource_type`, `resource_id`: string
    - `ip_address`: string
    - `result`: `SUCCESS` | `DENIED` | `FAILED`
    - `timestamp`: ISO timestamp
