import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  User, Shipper, Account, PermissionProfile, Device, PaymentMethod,
  Booking, RiskAssessment, Incident, IncidentEvent, Evidence,
  ComplianceRule, ComplianceCheck, AuditEvent, BlockchainAnchor,
  SystemSettings, ShipperHistoryEvent
} from './types';
import { INITIAL_COMPLIANCE_RULES } from './compliance_engine';
import { ReportRecord } from './report_engine';
import { EvidenceEngine } from './evidence_engine';

export interface DatabaseState {
  users: User[];
  shippers: Shipper[];
  accounts: Account[];
  permissionProfiles: PermissionProfile[];
  devices: Device[];
  paymentMethods: PaymentMethod[];
  bookings: Booking[];
  riskAssessments: RiskAssessment[];
  incidents: Incident[];
  incidentEvents: IncidentEvent[];
  evidenceList: Evidence[];
  complianceRules: ComplianceRule[];
  complianceChecks: ComplianceCheck[];
  auditEvents: AuditEvent[];
  blockchainAnchors: BlockchainAnchor[];
  reports: ReportRecord[];
  settings: SystemSettings;
}

const DEFAULT_SETTINGS: SystemSettings = {
  risk_weights: {
    identity_permission: 0.20,
    behavior_anomaly: 0.20,
    shipment_anomaly: 0.20,
    payment_risk: 0.15,
    destination_risk: 0.10,
    policy_compliance: 0.15,
  },
  thresholds: {
    allow_max: 29,
    hold_max: 69,
    block_min: 70,
  },
  features: {
    ml_enabled: true,
    genai_enabled: true,
    blockchain_mode: 'SIMULATED',
    strict_cold_start: false,
  },
  fallback_policy: 'AUTO',
  system_metadata: {
    version: 'FraudShield Core v2.4.0',
    environment: 'production-ready-preview',
    last_reloaded: new Date().toISOString(),
  }
};

export class DatabaseStore {
  private static instance: DatabaseStore;
  private dbFilePath: string;
  private data: DatabaseState;

  private constructor() {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbFilePath = path.join(dataDir, 'fraudshield_store.json');
    this.data = this.loadOrSeed();
  }

  public static getInstance(): DatabaseStore {
    if (!DatabaseStore.instance) {
      DatabaseStore.instance = new DatabaseStore();
    }
    return DatabaseStore.instance;
  }

  private save(): void {
    try {
      fs.writeFileSync(this.dbFilePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to write database file:', err);
    }
  }

  private loadOrSeed(): DatabaseState {
    if (fs.existsSync(this.dbFilePath)) {
      try {
        const raw = fs.readFileSync(this.dbFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.shippers && parsed.bookings && parsed.settings) {
          return parsed;
        }
      } catch (e) {
        console.warn('Corrupted database file, re-seeding...');
      }
    }
    return this.createSeedData();
  }

  public resetSeedData(): DatabaseState {
    this.data = this.createSeedData();
    this.save();
    return this.data;
  }

  private createSeedData(): DatabaseState {
    const passwordHash = bcrypt.hashSync('fraudshield2026!', 8);

    const users: User[] = [
      { id: 'USR-01', name: 'Dr. Sarah Vance', email: 'sarah.vance@fraudshield.internal', role: 'ADMIN' },
      { id: 'USR-02', name: 'Marcus Sterling', email: 'marcus.s@fraudshield.internal', role: 'FRAUD_ANALYST' },
      { id: 'USR-03', name: 'Ananya Sharma', email: 'ananya.s@fraudshield.internal', role: 'COMPLIANCE_ANALYST' },
      { id: 'USR-04', name: 'Robert Chen', email: 'robert.chen@auditor.gov', role: 'AUDITOR' },
      { id: 'USR-05', name: 'Elena Rostova', email: 'elena.r@fraudshield.internal', role: 'VIEWER' },
    ];

    const shippers: Shipper[] = [
      {
        id: 'SHP-101',
        company_name: 'Apex Precision Tools Ltd',
        email: 'logistics@apexprecision.in',
        phone: '+91-22-2847-1100',
        country: 'India',
        created_at: '2023-04-12T09:00:00Z',
        status: 'ACTIVE',
        trust_score: 94,
        verified_identity: true,
        kyc_status: 'VERIFIED',
        total_bookings: 148,
        average_weight_kg: 5.2,
        max_weight_kg: 18.0,
        common_origins: ['IN-BOM-MUMBAI', 'IN-PNQ-PUNE'],
        common_destinations: ['IN-BLR-BENGALURU', 'IN-DEL-DELHI', 'IN-HYD-HYDERABAD'],
        historical_incidents_count: 0,
      },
      {
        id: 'SHP-202',
        company_name: 'Nexus BioLogistics Pharma',
        email: 'ops@nexusbio.com',
        phone: '+91-11-4560-8900',
        country: 'India',
        created_at: '2022-08-19T10:30:00Z',
        status: 'FLAGGED',
        trust_score: 58,
        verified_identity: true,
        kyc_status: 'VERIFIED',
        total_bookings: 85,
        average_weight_kg: 5.0,
        max_weight_kg: 38.0,
        common_origins: ['IN-DEL-DELHI', 'IN-BOM-MUMBAI'],
        common_destinations: ['IN-BOM-MUMBAI', 'IN-CCU-KOLKATA', 'IN-MAA-CHENNAI'],
        historical_incidents_count: 1,
      },
      {
        id: 'SHP-303',
        company_name: 'Solis Robotics Inc',
        email: 'supply@solisrobotics.io',
        phone: '+91-80-6710-4422',
        country: 'India',
        created_at: '2026-09-28T14:15:00Z',
        status: 'ACTIVE',
        trust_score: 72,
        verified_identity: true,
        kyc_status: 'VERIFIED',
        total_bookings: 1, // Cold Start
        average_weight_kg: 8.5,
        max_weight_kg: 8.5,
        common_origins: ['IN-BLR-BENGALURU'],
        common_destinations: ['IN-HYD-HYDERABAD'],
        historical_incidents_count: 0,
      },
      {
        id: 'SHP-404',
        company_name: 'Orion Freight Logistics',
        email: 'dispatch@orionfreight.net',
        phone: '+91-44-2499-5500',
        country: 'India',
        created_at: '2025-11-10T11:00:00Z',
        status: 'FLAGGED',
        trust_score: 41,
        verified_identity: false,
        kyc_status: 'PENDING',
        total_bookings: 12,
        average_weight_kg: 24.0,
        max_weight_kg: 65.0,
        common_origins: ['IN-MAA-CHENNAI'],
        common_destinations: ['IN-COK-KOCHI', 'IN-BLR-BENGALURU'],
        historical_incidents_count: 2,
      },
      {
        id: 'SHP-999',
        company_name: 'Phantom Star Express (Blocked Sybil)',
        email: 'contact@phantom-sybil.org',
        phone: '+91-99-8800-1122',
        country: 'India',
        created_at: '2025-01-05T08:00:00Z',
        status: 'BLOCKED',
        trust_score: 8,
        verified_identity: false,
        kyc_status: 'REJECTED',
        total_bookings: 6,
        average_weight_kg: 140.0,
        max_weight_kg: 260.0,
        common_origins: ['IN-DEL-DELHI'],
        common_destinations: ['DE-FRA-FRANKFURT', 'AE-DXB-DUBAI'],
        historical_incidents_count: 4,
      }
    ];

    const accounts: Account[] = [
      {
        id: 'ACC-101',
        shipper_id: 'SHP-101',
        account_number: 'FS-ACC-88019',
        tier: 'PREMIUM',
        created_at: '2023-04-12T09:00:00Z',
        status: 'ACTIVE',
        is_cold_start: false,
        credit_limit: 50000,
      },
      {
        id: 'ACC-202',
        shipper_id: 'SHP-202',
        account_number: 'FS-ACC-44912',
        tier: 'ENTERPRISE',
        created_at: '2022-08-19T10:30:00Z',
        status: 'ACTIVE',
        is_cold_start: false,
        credit_limit: 100000,
      },
      {
        id: 'ACC-303',
        shipper_id: 'SHP-303',
        account_number: 'FS-ACC-11002',
        tier: 'STANDARD',
        created_at: '2026-09-28T14:15:00Z',
        status: 'ACTIVE',
        is_cold_start: true, // Cold start!
        credit_limit: 15000,
      },
      {
        id: 'ACC-404',
        shipper_id: 'SHP-404',
        account_number: 'FS-ACC-77341',
        tier: 'STANDARD',
        created_at: '2025-11-10T11:00:00Z',
        status: 'ACTIVE',
        is_cold_start: false,
        credit_limit: 20000,
      },
      {
        id: 'ACC-992',
        shipper_id: 'SHP-999',
        account_number: 'FS-ACC-99201',
        tier: 'STANDARD',
        created_at: '2025-01-05T08:00:00Z',
        status: 'BLOCKED',
        is_cold_start: false,
        credit_limit: 0,
      }
    ];

    const permissionProfiles: PermissionProfile[] = [
      {
        id: 'PERM-101',
        account_id: 'ACC-101',
        allowed_domestic: true,
        allowed_international: false,
        allowed_service_types: ['STANDARD_GROUND', 'EXPRESS_SAVER'],
        max_weight_kg: 30.0,
        approved_destinations: ['IN-BLR-BENGALURU', 'IN-DEL-DELHI', 'IN-HYD-HYDERABAD', 'IN-PNQ-PUNE', 'IN-MAA-CHENNAI'],
        approved_origins: ['IN-BOM-MUMBAI', 'IN-PNQ-PUNE'],
        allowed_payment_types: ['CORPORATE_ACH', 'CREDIT_CARD'],
      },
      {
        id: 'PERM-202',
        account_id: 'ACC-202',
        allowed_domestic: true,
        allowed_international: false, // NOT authorized for international!
        allowed_service_types: ['STANDARD_GROUND', 'COLD_CHAIN_STANDARD'],
        max_weight_kg: 40.0, // Max 40kg!
        approved_destinations: ['IN-BOM-MUMBAI', 'IN-CCU-KOLKATA', 'IN-MAA-CHENNAI', 'IN-BLR-BENGALURU'],
        approved_origins: ['IN-DEL-DELHI', 'IN-BOM-MUMBAI'],
        allowed_payment_types: ['CORPORATE_ACH'],
      },
      {
        id: 'PERM-303',
        account_id: 'ACC-303',
        allowed_domestic: true,
        allowed_international: false,
        allowed_service_types: ['STANDARD_GROUND', 'EXPRESS_SAVER'],
        max_weight_kg: 25.0,
        approved_destinations: ['IN-BLR-BENGALURU', 'IN-HYD-HYDERABAD'],
        approved_origins: ['IN-BLR-BENGALURU'],
        allowed_payment_types: ['CREDIT_CARD'],
      },
      {
        id: 'PERM-404',
        account_id: 'ACC-404',
        allowed_domestic: true,
        allowed_international: true,
        allowed_service_types: ['STANDARD_GROUND', 'AIR_FREIGHT_EXPEDITED'],
        max_weight_kg: 100.0,
        approved_destinations: ['IN-COK-KOCHI', 'IN-BLR-BENGALURU', 'AE-DXB-DUBAI'],
        approved_origins: ['IN-MAA-CHENNAI'],
        allowed_payment_types: ['CREDIT_CARD', 'WIRE_TRANSFER'],
      },
    ];

    const devices: Device[] = [
      {
        id: 'DEV-101',
        device_fingerprint: 'fp_a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
        ip_address: '103.21.58.42',
        network_asn: 'AS55836 Reliance Jio Infocomm',
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        is_flagged_suspicious: false,
        last_seen: '2026-10-02T10:14:00Z',
        associated_accounts: ['ACC-101'],
      },
      {
        id: 'DEV-202',
        device_fingerprint: 'fp_nexus_known_macbook_corp_sec',
        ip_address: '14.139.60.18',
        network_asn: 'AS4755 Tata Communications',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        is_flagged_suspicious: false,
        last_seen: '2026-09-30T17:20:00Z',
        associated_accounts: ['ACC-202'],
      },
      {
        id: 'DEV-999', // Rogue Device linked to ATO on Nexus BioLogistics
        device_fingerprint: 'fp_tor_exit_node_spoofed_linux_442',
        ip_address: '185.220.101.45', // Tor Exit Node / Data Center IP
        network_asn: 'AS60729 Zwiebelfreunde e.V.',
        user_agent: 'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0',
        is_flagged_suspicious: true,
        previously_blocked_link: 'INC-2025-0819 (Cargo Intercepted)',
        last_seen: '2026-10-03T04:22:15Z',
        associated_accounts: ['ACC-202', 'ACC-992'],
      },
      {
        id: 'DEV-404', // Device linked to Blocked Sybil Account ACC-992
        device_fingerprint: 'fp_sybil_linked_proxy_hardware_id',
        ip_address: '45.154.255.89',
        network_asn: 'AS200052 Datacenter Proxy Services',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        is_flagged_suspicious: true,
        previously_blocked_link: 'ACC-992 (Phantom Star Express)',
        last_seen: '2026-10-01T08:11:00Z',
        associated_accounts: ['ACC-404', 'ACC-992'],
      },
      {
        id: 'DEV-303',
        device_fingerprint: 'fp_solis_fresh_win11_laptop',
        ip_address: '49.207.214.10',
        network_asn: 'AS24186 ACT Fibernet Bengaluru',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0.0.0',
        is_flagged_suspicious: false,
        last_seen: '2026-10-02T16:00:00Z',
        associated_accounts: ['ACC-303'],
      }
    ];

    const paymentMethods: PaymentMethod[] = [
      {
        id: 'PM-101',
        shipper_id: 'SHP-101',
        account_id: 'ACC-101',
        payment_type: 'CORPORATE_ACH',
        masked_number: '•••• •••• •••• 4492',
        card_holder: 'Apex Precision Tools Ltd',
        billing_country: 'India',
        is_verified: true,
        risk_flag: false,
        failure_count: 0,
      },
      {
        id: 'PM-202',
        shipper_id: 'SHP-202',
        account_id: 'ACC-202',
        payment_type: 'CORPORATE_ACH',
        masked_number: '•••• •••• •••• 9011',
        card_holder: 'Nexus BioLogistics Pharma',
        billing_country: 'India',
        is_verified: true,
        risk_flag: false,
        failure_count: 0,
      },
      {
        id: 'PM-888', // Suspicious prepaid foreign card used in ATO attack
        shipper_id: 'SHP-202',
        account_id: 'ACC-202',
        payment_type: 'PREPAID',
        masked_number: '5312 •••• •••• 7714',
        card_holder: 'Viktor Kane (Name Mismatch)',
        billing_country: 'Cyprus',
        is_verified: false,
        risk_flag: true,
        failure_count: 2,
      },
      {
        id: 'PM-303',
        shipper_id: 'SHP-303',
        account_id: 'ACC-303',
        payment_type: 'CREDIT_CARD',
        masked_number: '4111 •••• •••• 3029',
        card_holder: 'Solis Robotics Inc',
        billing_country: 'India',
        is_verified: true,
        risk_flag: false,
        failure_count: 0,
      },
      {
        id: 'PM-404',
        shipper_id: 'SHP-404',
        account_id: 'ACC-404',
        payment_type: 'CREDIT_CARD',
        masked_number: '4242 •••• •••• 1180',
        card_holder: 'Orion Logistics Management',
        billing_country: 'India',
        is_verified: true,
        risk_flag: false,
        failure_count: 1,
      }
    ];

    // Seeded Scenario A Booking (Processed Legitimate)
    const bookingA: Booking = {
      id: 'BKG-2026-1001',
      booking_reference: 'FS-BK-1001',
      shipper_id: 'SHP-101',
      account_id: 'ACC-101',
      payment_id: 'PM-101',
      device_id: 'DEV-101',
      origin: 'IN-BOM-MUMBAI',
      destination: 'IN-BLR-BENGALURU',
      weight_kg: 5.4,
      service_type: 'STANDARD_GROUND',
      package_category: 'MACHINERY_PARTS',
      declared_value_inr: 70000,
      declared_value_usd: 850,
      booking_timestamp: '2026-10-02T10:14:00Z',
      status: 'PROCESSED',
      created_at: '2026-10-02T10:14:00Z',
    };

    const assessmentA: RiskAssessment = {
      id: 'RSK-1001',
      booking_id: bookingA.id,
      identity_score: 5,
      behavior_score: 8,
      shipment_score: 6,
      payment_score: 4,
      destination_score: 5,
      compliance_score: 8,
      final_score: 6,
      risk_level: 'LOW',
      decision: 'ALLOW',
      digital_trust_score: 96,
      triggered_signals: [],
      ml_anomaly_score: 0.04,
      ml_status: 'ACTIVE',
      ml_model_version: 'FS-IForest-v1.4',
      fallback_level: 'LEVEL 1 — AI/ML DETECTION',
      explanation: 'Consignment perfectly matches historical behavioral profile (5.4kg vs 5.2kg avg), authorized domestic corridor (Mumbai to Bengaluru), verified corporate ACH payment, and recognized hardware fingerprint.',
      explanation_source: 'DETERMINISTIC_RULES',
      authorized_vs_observed: {
        destination: { authorized: ['IN-BLR-BENGALURU', 'IN-DEL-DELHI'], observed: 'IN-BLR-BENGALURU', matches: true },
        service_type: { authorized: ['STANDARD_GROUND', 'EXPRESS_SAVER'], observed: 'STANDARD_GROUND', matches: true },
        weight: { authorized_max: 30.0, observed: 5.4, matches: true, multiple: 1.0 },
        payment: { authorized_type: ['CORPORATE_ACH', 'CREDIT_CARD'], observed: 'CORPORATE_ACH', matches: true }
      },
      created_at: '2026-10-02T10:14:05Z',
    };

    // Seeded Scenario B Booking (Account Takeover / 180kg Privilege Abuse -> BLOCKED)
    const bookingB: Booking = {
      id: 'BKG-2026-9042',
      booking_reference: 'FS-BK-9042',
      shipper_id: 'SHP-202',
      account_id: 'ACC-202',
      payment_id: 'PM-888', // Suspicious card
      device_id: 'DEV-999', // Tor Exit Node
      origin: 'IN-DEL-DELHI',
      destination: 'DE-FRA-FRANKFURT', // International! Not authorized!
      weight_kg: 180.0, // 36x historical average!
      service_type: 'AIR_EXPRESS_PRIORITY',
      package_category: 'CHEMICALS_HIGH_DENSITY',
      declared_value_inr: 2800000,
      declared_value_usd: 35000,
      booking_timestamp: '2026-10-03T04:22:15Z',
      status: 'BLOCKED',
      created_at: '2026-10-03T04:22:15Z',
    };

    const assessmentB: RiskAssessment = {
      id: 'RSK-9042',
      booking_id: bookingB.id,
      identity_score: 88,
      behavior_score: 96,
      shipment_score: 94,
      payment_score: 92,
      destination_score: 85,
      compliance_score: 89,
      final_score: 92,
      risk_level: 'HIGH',
      decision: 'BLOCK',
      digital_trust_score: 18,
      triggered_signals: [
        {
          code: 'WEIGHT_ANOMALY_EXTREME',
          category: 'BEHAVIOR',
          severity: 'CRITICAL',
          description: 'Shipment weight 180.0 kg is 36.0x the shipper historical average of 5.0 kg',
          score_contribution: 28,
          observed_value: '180.0 kg',
          expected_value: '5.0 kg'
        },
        {
          code: 'PERMISSION_VIOLATION_INTERNATIONAL',
          category: 'IDENTITY',
          severity: 'HIGH',
          description: 'Shipper permission profile strictly restricts booking to domestic routes. International destination DE-FRA-FRANKFURT attempted.',
          score_contribution: 22,
          observed_value: 'DE-FRA-FRANKFURT',
          expected_value: 'Domestic Only'
        },
        {
          code: 'PERMISSION_VIOLATION_WEIGHT_CAP',
          category: 'SHIPMENT',
          severity: 'HIGH',
          description: 'Booking weight 180.0 kg exceeds authorized maximum profile limit of 40.0 kg',
          score_contribution: 18,
          observed_value: '180.0 kg',
          expected_value: 'Max 40.0 kg'
        },
        {
          code: 'DEVICE_LINKED_TO_SUSPICIOUS_NETWORK',
          category: 'RELATIONSHIP',
          severity: 'CRITICAL',
          description: 'Originating device DEV-999 is operating from Tor exit node AS60729 and previously linked to blocked sybil account ACC-992',
          score_contribution: 24,
          observed_value: '185.220.101.45 (AS60729)',
          expected_value: 'Tata Communications (Known AS4755)'
        },
        {
          code: 'PAYMENT_CARDHOLDER_MISMATCH',
          category: 'PAYMENT',
          severity: 'HIGH',
          description: 'Payment cardholder (Viktor Kane) does not match authenticated corporate entity (Nexus BioLogistics Pharma)',
          score_contribution: 16,
          observed_value: 'Viktor Kane (Cyprus)',
          expected_value: 'Nexus BioLogistics Pharma'
        },
        {
          code: 'REGULATORY_CUSTOMS_INTERCEPT',
          category: 'COMPLIANCE',
          severity: 'HIGH',
          description: 'Consignment exceeds simplified courier clearance limits under Regulation 5(1) and lacks required formal Shipping Bill declaration',
          score_contribution: 14,
          observed_value: '180kg / ₹28,00,000 INR',
          expected_value: 'Max 70kg / ₹50,000 INR'
        }
      ],
      ml_anomaly_score: 0.982,
      ml_status: 'ACTIVE',
      ml_model_version: 'FS-IForest-v1.4',
      fallback_level: 'LEVEL 1 — AI/ML DETECTION',
      explanation: 'Critical Risk Detected (Score 92/100): High-confidence account takeover and privilege abuse pattern. Observed booking weight (180.0 kg) represents a 36.0x deviation from historical baseline (5.0 kg) and breaches the 40.0 kg permission ceiling. The transaction originated via an untrusted Tor exit node (DEV-999) previously connected to blocked sybil entities, paired with an unverified offshore prepaid card under an unrelated cardholder name. Immediate pre-shipment quarantine enforced.',
      explanation_source: 'GENAI',
      authorized_vs_observed: {
        destination: { authorized: ['IN-BOM-MUMBAI', 'IN-CCU-KOLKATA', 'IN-MAA-CHENNAI'], observed: 'DE-FRA-FRANKFURT', matches: false },
        service_type: { authorized: ['STANDARD_GROUND', 'COLD_CHAIN_STANDARD'], observed: 'AIR_EXPRESS_PRIORITY', matches: false },
        weight: { authorized_max: 40.0, observed: 180.0, matches: false, multiple: 36.0 },
        payment: { authorized_type: ['CORPORATE_ACH'], observed: 'PREPAID', matches: false }
      },
      created_at: '2026-10-03T04:22:20Z',
    };

    const incidentB: Incident = {
      id: 'INC-2026-0042',
      incident_number: 'INC-2026-0042',
      booking_id: bookingB.id,
      shipper_id: bookingB.shipper_id,
      severity: 'CRITICAL',
      risk_score: 92,
      decision: 'BLOCK',
      status: 'OPEN',
      assigned_to: 'Marcus Sterling (Senior Fraud Investigator)',
      triggered_rules: [
        'WEIGHT_ANOMALY_EXTREME',
        'PERMISSION_VIOLATION_INTERNATIONAL',
        'DEVICE_LINKED_TO_SUSPICIOUS_NETWORK',
        'PAYMENT_CARDHOLDER_MISMATCH',
        'REGULATORY_CUSTOMS_INTERCEPT'
      ],
      evidence_ids: ['EVD-001-AUTH', 'EVD-002-DEVICE', 'EVD-003-PAYMENT', 'EVD-004-RISK'],
      created_at: '2026-10-03T04:22:21Z',
      updated_at: '2026-10-03T04:22:21Z',
      attack_path_node_ids: ['SHP-202', 'ACC-202', 'DEV-999', 'PM-888', 'BKG-2026-9042', 'RSK-9042', 'DEC-BLOCK-9042', 'INC-2026-0042'],
    };

    const incidentEventsB: IncidentEvent[] = [
      {
        id: 'EVT-01',
        incident_id: incidentB.id,
        step_order: 1,
        event_type: 'AUTH',
        title: 'Account Session Established',
        description: 'Login authenticated for ACC-202 using valid API credential token',
        timestamp: '2026-10-03T04:18:10Z',
        entity_type: 'ACCOUNT',
        entity_id: 'ACC-202',
        risk_delta: 0,
      },
      {
        id: 'EVT-02',
        incident_id: incidentB.id,
        step_order: 2,
        event_type: 'DEVICE',
        title: 'New Hardware Device Observed',
        description: 'Request originated from unseen Linux fingerprint on Tor Exit Node AS60729 (185.220.101.45)',
        timestamp: '2026-10-03T04:19:02Z',
        entity_type: 'DEVICE',
        entity_id: 'DEV-999',
        risk_delta: 24,
      },
      {
        id: 'EVT-03',
        incident_id: incidentB.id,
        step_order: 3,
        event_type: 'PAYMENT',
        title: 'Payment Method Injected',
        description: 'New prepaid card (5312 •••• •••• 7714) added under third-party name Viktor Kane',
        timestamp: '2026-10-03T04:20:45Z',
        entity_type: 'PAYMENT',
        entity_id: 'PM-888',
        risk_delta: 22,
      },
      {
        id: 'EVT-04',
        incident_id: incidentB.id,
        step_order: 4,
        event_type: 'DESTINATION',
        title: 'Unauthorized Cross-Border Routing',
        description: 'Destination changed to Frankfurt Airport Cargo Hub DE-FRA-FRANKFURT (Violates domestic-only permission profile)',
        timestamp: '2026-10-03T04:21:30Z',
        entity_type: 'DESTINATION',
        entity_id: 'DE-FRA-FRANKFURT',
        risk_delta: 18,
      },
      {
        id: 'EVT-05',
        incident_id: incidentB.id,
        step_order: 5,
        event_type: 'BOOKING',
        title: 'Anomalous Booking Ingested',
        description: 'Consignment declared at 180.0 kg (36x historical average of 5.0 kg)',
        timestamp: '2026-10-03T04:22:15Z',
        entity_type: 'BOOKING',
        entity_id: 'BKG-2026-9042',
        risk_delta: 28,
      },
      {
        id: 'EVT-06',
        incident_id: incidentB.id,
        step_order: 6,
        event_type: 'FRAUD_ANALYSIS',
        title: 'Multi-Engine Risk Aggregation',
        description: 'Behavioral, permission, payment, and ML anomaly models triggered. Risk score calculated at 92/100.',
        timestamp: '2026-10-03T04:22:19Z',
        entity_type: 'RISK_ASSESSMENT',
        entity_id: 'RSK-9042',
        risk_delta: 0,
      },
      {
        id: 'EVT-07',
        incident_id: incidentB.id,
        step_order: 7,
        event_type: 'DECISION',
        title: 'Carrier Dispatch Quarantined — BLOCK Enforced',
        description: 'Pre-shipment blocking policy triggered; carrier manifest integration halted',
        timestamp: '2026-10-03T04:22:20Z',
        entity_type: 'DECISION',
        entity_id: 'DEC-BLOCK-9042',
        risk_delta: 0,
      },
      {
        id: 'EVT-08',
        incident_id: incidentB.id,
        step_order: 8,
        event_type: 'INCIDENT_CREATED',
        title: 'Forensic Incident INC-2026-0042 Created',
        description: 'Auto-routed to Senior Fraud Investigator queue with Critical severity',
        timestamp: '2026-10-03T04:22:21Z',
        entity_type: 'INCIDENT',
        entity_id: 'INC-2026-0042',
        risk_delta: 0,
      },
      {
        id: 'EVT-09',
        incident_id: incidentB.id,
        step_order: 9,
        event_type: 'EVIDENCE_SEALED',
        title: 'Tamper-Evident SHA-256 Hash Chain Sealed',
        description: 'Digital evidence bundle cryptographically anchored to internal ledger',
        timestamp: '2026-10-03T04:22:22Z',
        entity_type: 'EVIDENCE',
        entity_id: 'EVD-004-RISK',
        risk_delta: 0,
      }
    ];

    // Build seeded tamper-evident evidence chain for Incident B
    const hash0 = '0000000000000000000000000000000000000000000000000000000000000000';
    const content1 = { event: 'AUTH_SESSION', account: 'ACC-202', ip: '185.220.101.45', time: '2026-10-03T04:18:10Z' };
    const hash1 = EvidenceEngine.computeHash(hash0, content1);

    const content2 = { event: 'DEVICE_OBSERVED', device: 'DEV-999', asn: 'AS60729', fingerprint: 'fp_tor_exit_node_spoofed_linux_442' };
    const hash2 = EvidenceEngine.computeHash(hash1, content2);

    const content3 = { event: 'PAYMENT_ADDED', payment_id: 'PM-888', cardholder: 'Viktor Kane', issuer_country: 'CY' };
    const hash3 = EvidenceEngine.computeHash(hash2, content3);

    const content4 = { event: 'FRAUD_BLOCK_DECISION', booking: 'BKG-2026-9042', weight: 180.0, score: 92, decision: 'BLOCK' };
    const hash4 = EvidenceEngine.computeHash(hash3, content4);

    const evidenceList: Evidence[] = [
      {
        id: 'EVD-001-AUTH',
        incident_id: incidentB.id,
        booking_id: bookingB.id,
        source_event: 'Account Authentication Session',
        source_system: 'FraudShield Identity Gateway',
        created_at: '2026-10-03T04:18:10Z',
        creator: 'Identity Verification Subsystem',
        content_data: content1,
        previous_hash: hash0,
        current_hash: hash1,
        is_tampered: false,
      },
      {
        id: 'EVD-002-DEVICE',
        incident_id: incidentB.id,
        booking_id: bookingB.id,
        source_event: 'Device & Network Telemetry Capture',
        source_system: 'FraudShield Topology Sniffer',
        created_at: '2026-10-03T04:19:02Z',
        creator: 'Network Forensics Subsystem',
        content_data: content2,
        previous_hash: hash1,
        current_hash: hash2,
        is_tampered: false,
      },
      {
        id: 'EVD-003-PAYMENT',
        incident_id: incidentB.id,
        booking_id: bookingB.id,
        source_event: 'Payment Risk Inspection',
        source_system: 'FraudShield Payment Gateway Broker',
        created_at: '2026-10-03T04:20:45Z',
        creator: 'Payment Risk Subsystem',
        content_data: content3,
        previous_hash: hash2,
        current_hash: hash3,
        is_tampered: false,
      },
      {
        id: 'EVD-004-RISK',
        incident_id: incidentB.id,
        booking_id: bookingB.id,
        source_event: 'Risk Scoring & Quarantine Decision',
        source_system: 'FraudShield Core Decision Engine',
        created_at: '2026-10-03T04:22:20Z',
        creator: 'Automated Quarantine Pipeline',
        content_data: content4,
        previous_hash: hash3,
        current_hash: hash4,
        is_tampered: false,
      }
    ];

    const blockchainAnchors: BlockchainAnchor[] = [
      {
        id: 'BCA-0042',
        evidence_id: 'EVD-004-RISK',
        incident_id: incidentB.id,
        anchor_tx_id: '0xsim_7c4f1a8e99b2d304e5a6f7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8',
        block_number: 18491024,
        network_mode: 'SIMULATED',
        timestamp: '2026-10-03T04:23:00Z',
        document_hash: hash4,
        merkle_root: '0xmrk_9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d',
        state: 'ANCHORED',
      }
    ];

    const complianceChecks: ComplianceCheck[] = [
      {
        id: 'CHK-1001-01',
        booking_id: bookingA.id,
        rule_id: 'COMP-IN-01',
        authority: 'Central Board of Indirect Taxes and Customs (CBIC), India',
        law_regulation: 'Customs Act, 1962',
        section_rule: 'Section 50 & Section 46',
        requirement: 'Mandatory declaration of accurate commercial description, weight, and true transaction value.',
        status: 'PASS',
        evidence_summary: 'Compliant declaration: Weight 5.4kg and transaction value ₹70,000 duly recorded.',
        verified_at: '2026-10-02T10:14:05Z',
        verifier: 'FraudShield Automated Statutory Engine v2.4',
      },
      {
        id: 'CHK-9042-01',
        booking_id: bookingB.id,
        rule_id: 'COMP-IN-02',
        authority: 'Directorate General of Systems & Data Management, CBIC',
        law_regulation: 'Courier Imports and Exports (Clearance) Regulations, 1998',
        section_rule: 'Regulation 5(1) & Regulation 12',
        requirement: 'Consignment weight > 70kg or value > ₹50,000 mandates formal Shipping Bill filing and IEC verification.',
        status: 'FAIL',
        evidence_summary: 'Consignment (180kg / ₹28,00,000) exceeds express courier limits. Missing verified export documents.',
        verified_at: '2026-10-03T04:22:20Z',
        verifier: 'FraudShield Automated Statutory Engine v2.4',
      },
      {
        id: 'CHK-9042-02',
        booking_id: bookingB.id,
        rule_id: 'COMP-IN-03',
        authority: 'Directorate General of Shipping, Ministry of Ports, Shipping and Waterways',
        law_regulation: 'Merchant Shipping Act, 1958',
        section_rule: 'Section 334 & Section 335',
        requirement: 'Carriage of hazardous or heavy cargo (>100kg) requires verified MSDS checklist.',
        status: 'REVIEW',
        evidence_summary: 'Consignment weight 180kg requires mandatory container scale certification.',
        verified_at: '2026-10-03T04:22:20Z',
        verifier: 'FraudShield Automated Statutory Engine v2.4',
      }
    ];

    const auditEvents: AuditEvent[] = [
      {
        id: 'AUD-001',
        actor_name: 'Dr. Sarah Vance',
        actor_role: 'ADMIN',
        action: 'SYSTEM_BOOTSTRAP',
        resource_type: 'SYSTEM',
        resource_id: 'FRAUDSHIELD_CORE',
        timestamp: '2026-10-01T08:00:00Z',
        ip_address: '10.0.4.1',
        result: 'SUCCESS',
        details: { message: 'Database initialized with calibrated fraud detection models and compliance rules.' }
      },
      {
        id: 'AUD-002',
        actor_name: 'System Worker',
        actor_role: 'ADMIN',
        action: 'BOOKING_SCREENED',
        resource_type: 'BOOKING',
        resource_id: 'BKG-2026-1001',
        timestamp: '2026-10-02T10:14:05Z',
        ip_address: '103.21.58.42',
        result: 'SUCCESS',
        details: { decision: 'ALLOW', score: 6 }
      },
      {
        id: 'AUD-003',
        actor_name: 'System Quarantine Engine',
        actor_role: 'FRAUD_ANALYST',
        action: 'PRE_SHIPMENT_BLOCK_ENFORCED',
        resource_type: 'BOOKING',
        resource_id: 'BKG-2026-9042',
        timestamp: '2026-10-03T04:22:20Z',
        ip_address: '185.220.101.45',
        result: 'SUCCESS',
        details: { decision: 'BLOCK', score: 92, incident_id: 'INC-2026-0042' }
      },
      {
        id: 'AUD-004',
        actor_name: 'System Cryptographer',
        actor_role: 'ADMIN',
        action: 'EVIDENCE_ANCHORED_BLOCKCHAIN',
        resource_type: 'BLOCKCHAIN_ANCHOR',
        resource_id: 'BCA-0042',
        timestamp: '2026-10-03T04:23:00Z',
        ip_address: '127.0.0.1',
        result: 'SUCCESS',
        details: { mode: 'SIMULATED', block_number: 18491024 }
      }
    ];

    const state: DatabaseState = {
      users,
      shippers,
      accounts,
      permissionProfiles,
      devices,
      paymentMethods,
      bookings: [bookingA, bookingB],
      riskAssessments: [assessmentA, assessmentB],
      incidents: [incidentB],
      incidentEvents: incidentEventsB,
      evidenceList,
      complianceRules: INITIAL_COMPLIANCE_RULES,
      complianceChecks,
      auditEvents,
      blockchainAnchors,
      reports: [],
      settings: DEFAULT_SETTINGS,
    };

    return state;
  }

  // --- Accessors and Mutators ---

  public getUsers(): User[] { return this.data.users; }
  public getShippers(): Shipper[] { return this.data.shippers; }
  public getShipperById(id: string): Shipper | undefined {
    return this.data.shippers.find(s => s.id === id);
  }

  public getShipperHistory(shipperId: string): ShipperHistoryEvent[] {
    const defaultHistories: Record<string, ShipperHistoryEvent[]> = {
      'SHP-101': [
        {
          id: 'HIST-101-01',
          shipper_id: 'SHP-101',
          timestamp: '2023-04-12T09:00:00Z',
          category: 'REGISTRATION',
          title: 'Enterprise Shipper Onboarded & Licensed',
          description: 'Incorporated under Companies Act; Ministry of Corporate Affairs filing and Director DIN verification completed. Import-Export Code (IEC) #0319481023 officially linked.',
          actor: 'Registrar of Companies / CBIC Gateway',
          status: 'COMPLETED',
          port: 'IN-BOM-MUMBAI',
          risk_delta: 0
        },
        {
          id: 'HIST-101-02',
          shipper_id: 'SHP-101',
          timestamp: '2023-05-18T14:30:00Z',
          category: 'KYC_AUDIT',
          title: 'Authorized Economic Operator (AEO-T1) Accredited',
          description: 'CBIC customs on-site physical security and financial solvency clearance granted for JNPT Nhava Sheva & Mumbai Air Cargo Complex. Expedited clearance lane unlocked.',
          actor: 'Customs Officer P. Deshmukh (JNPT)',
          status: 'VERIFIED',
          port: 'IN-BOM-MUMBAI',
          risk_delta: -15
        },
        {
          id: 'HIST-101-03',
          shipper_id: 'SHP-101',
          timestamp: '2024-01-10T11:15:00Z',
          category: 'CREDIT_LIMIT',
          title: 'Enterprise Freight Credit Ceiling Expanded',
          description: 'Monthly rolling credit ceiling elevated from ₹15,00,000 to ₹50,00,000 INR based on 250+ defect-free dispatches and prompt GST invoice reconciliations.',
          actor: 'Carrier Credit Committee',
          status: 'COMPLETED',
          risk_delta: -5
        },
        {
          id: 'HIST-101-04',
          shipper_id: 'SHP-101',
          timestamp: '2024-08-22T16:45:00Z',
          category: 'CORRIDOR_APPROVAL',
          title: 'High-Frequency Industrial Corridor Approved',
          description: 'Mumbai (IN-BOM) to Bengaluru (IN-BLR) express ground & air courier transit route approved for precision CNC and machinery consignments.',
          actor: 'National Dispatch Operations',
          status: 'VERIFIED',
          port: 'IN-BLR-BENGALURU',
          risk_delta: 0
        },
        {
          id: 'HIST-101-05',
          shipper_id: 'SHP-101',
          timestamp: '2025-06-14T10:00:00Z',
          category: 'KYC_AUDIT',
          title: 'Annual Statutory Tax Re-Verification Completed',
          description: 'Annual GSTIN filing verification (27AAACA1234A1Z5) reconciled with CBIC ICEGATE ledger. Identity trust rating renewed to 96/100.',
          actor: 'Automated ICEGATE API',
          status: 'VERIFIED',
          risk_delta: -5
        },
        {
          id: 'HIST-101-06',
          shipper_id: 'SHP-101',
          timestamp: '2026-09-15T08:30:00Z',
          category: 'CUSTOMS_CLEARANCE',
          title: '1,000th Consignment Clearance Milestone',
          description: 'Carrier clearance issued with 99.8% on-time record and zero customs violations across 36 consecutive months of operation.',
          actor: 'Fleet Carrier Control',
          status: 'COMPLETED',
          risk_delta: -2
        }
      ],
      'SHP-202': [
        {
          id: 'HIST-202-01',
          shipper_id: 'SHP-202',
          timestamp: '2022-08-19T10:30:00Z',
          category: 'REGISTRATION',
          title: 'Cross-Border BioLogistics Shipper Registered',
          description: 'German Handelsregister HRB-88912 filing verified; Cold-chain temperature-controlled pharmaceutical consignment baseline registered for Frankfurt FRA.',
          actor: 'EU Trade Registrar / Carrier Onboarding',
          status: 'COMPLETED',
          port: 'DE-FRA-FRANKFURT',
          risk_delta: 0
        },
        {
          id: 'HIST-202-02',
          shipper_id: 'SHP-202',
          timestamp: '2023-03-12T11:20:00Z',
          category: 'CORRIDOR_APPROVAL',
          title: 'Pharma Air-Cargo Corridor Approved',
          description: 'Delhi IGI Airport (IN-DEL) to Frankfurt Airport (DE-FRA) dedicated priority lane activated for biochemical reagents and certified pharmaceutical vials.',
          actor: 'Port Health & Customs Authority',
          status: 'VERIFIED',
          port: 'IN-DEL-DELHI',
          risk_delta: 0
        },
        {
          id: 'HIST-202-03',
          shipper_id: 'SHP-202',
          timestamp: '2024-11-05T09:15:00Z',
          category: 'SECURITY_FLAG',
          title: 'Multiple IP Concurrency Warning Flagged',
          description: 'Concurrent dashboard logins flagged from IP 185.220.101.5 (Tor Exit Node) and Frankfurt office IP within 90 seconds. Security advisory issued.',
          actor: 'FraudShield Telemetry Engine',
          status: 'WARNING',
          risk_delta: 25
        },
        {
          id: 'HIST-202-04',
          shipper_id: 'SHP-202',
          timestamp: '2025-02-14T17:40:00Z',
          category: 'DEVICE_BIND',
          title: 'Hardware Token Security Key Re-Binding',
          description: 'Chief Logistics Officer Yubikey security token re-bound following mandatory credential rotation. Session timeouts shortened to 15 minutes.',
          actor: 'Security Operations Center (SOC)',
          status: 'COMPLETED',
          risk_delta: -10
        },
        {
          id: 'HIST-202-05',
          shipper_id: 'SHP-202',
          timestamp: '2026-10-02T19:35:00Z',
          category: 'SECURITY_FLAG',
          title: 'CRITICAL: 180kg Toxic Anomaly Privilege Abuse Blocked',
          description: 'Booking FS-BK-9042 submitted 180.0kg corrosive chemicals package exceeding shipper baseline 12.0kg by 1,400%. Carrier pre-shipment hold triggered under INC-2026-0042.',
          actor: 'FraudShield ML Ensemble (Model ID: XGB-ANOMALY-99)',
          status: 'FLAGGED',
          port: 'IN-DEL-DELHI',
          risk_delta: 65
        },
        {
          id: 'HIST-202-06',
          shipper_id: 'SHP-202',
          timestamp: '2026-10-02T20:10:00Z',
          category: 'INSPECTION',
          title: 'Customs Cargo Quarantine & Physical Hold Enforced',
          description: 'Delhi Cargo Terminal customs inspector sealed consignment for hazmat physical verification. Account suspended from booking new air freight.',
          actor: 'Superintendent R. Sharma (Delhi Air Cargo Customs)',
          status: 'FLAGGED',
          port: 'IN-DEL-DELHI',
          risk_delta: 10
        }
      ],
      'SHP-303': [
        {
          id: 'HIST-303-01',
          shipper_id: 'SHP-303',
          timestamp: '2026-09-28T14:15:00Z',
          category: 'REGISTRATION',
          title: 'Initial Cold-Start Shipper Onboarding',
          description: 'Standard courier merchant registration initiated from Bengaluru tech corridor. Operational baseline initialized with cold-start probation flags.',
          actor: 'Carrier Self-Service Portal',
          status: 'COMPLETED',
          port: 'IN-BLR-BENGALURU',
          risk_delta: 15
        },
        {
          id: 'HIST-303-02',
          shipper_id: 'SHP-303',
          timestamp: '2026-09-29T10:00:00Z',
          category: 'KYC_AUDIT',
          title: 'Digital KYC & PAN Verification Sealed',
          description: 'Director Aadhaar/PAN verified via DigiLocker with Indian tax authority. Preliminary ₹15,000 INR freight credit limit assigned.',
          actor: 'Automated KYC Engine',
          status: 'VERIFIED',
          risk_delta: -10
        },
        {
          id: 'HIST-303-03',
          shipper_id: 'SHP-303',
          timestamp: '2026-09-30T11:30:00Z',
          category: 'CORRIDOR_APPROVAL',
          title: 'Domestic Ground Route Corridor Authorized',
          description: 'Bengaluru (IN-BLR) to Hyderabad (IN-HYD) ground courier lane approved for electronics consumer freight under 10.0kg per parcel.',
          actor: 'Regional Logistics Coordinator',
          status: 'VERIFIED',
          port: 'IN-HYD-HYDERABAD',
          risk_delta: 0
        },
        {
          id: 'HIST-303-04',
          shipper_id: 'SHP-303',
          timestamp: '2026-10-01T15:20:00Z',
          category: 'INSPECTION',
          title: 'First Consignment Physical Cargo Inspection',
          description: '5.4kg consignment FS-BK-1001 inspected at Bengaluru Cargo Terminal. X-ray scan confirmed consumer audio electronics matching declaration.',
          actor: 'Terminal Security Officer S. Rao',
          status: 'VERIFIED',
          port: 'IN-BLR-BENGALURU',
          risk_delta: -5
        },
        {
          id: 'HIST-303-05',
          shipper_id: 'SHP-303',
          timestamp: '2026-10-02T12:00:00Z',
          category: 'STATUS_CHANGE',
          title: 'Cold-Start Probation Monitor Active',
          description: '30-day velocity throttle applied to observe booking frequency before raising maximum weight limit above 15kg.',
          actor: 'FraudShield Policy Controller',
          status: 'COMPLETED',
          risk_delta: 0
        }
      ],
      'SHP-404': [
        {
          id: 'HIST-404-01',
          shipper_id: 'SHP-404',
          timestamp: '2024-03-10T12:00:00Z',
          category: 'REGISTRATION',
          title: 'Dubai Free Zone Trade Aggregator Onboarded',
          description: 'Registered under JAFZA License #FZ-2024-91823; Multi-vendor consolidated shipment hierarchy approved for cross-border freight forwarding.',
          actor: 'Middle East Regional Logistics Team',
          status: 'COMPLETED',
          port: 'AE-DXB-DUBAI',
          risk_delta: 0
        },
        {
          id: 'HIST-404-02',
          shipper_id: 'SHP-404',
          timestamp: '2024-09-18T14:40:00Z',
          category: 'CORRIDOR_APPROVAL',
          title: 'Multimodal Sea-Air Mumbai-Dubai Corridor Activated',
          description: 'Mumbai (IN-BOM) to Dubai (AE-DXB) sea-air transshipment corridor authorized with dual customs bond backing.',
          actor: 'Customs & Port Logistics Authority',
          status: 'VERIFIED',
          port: 'AE-DXB-DUBAI',
          risk_delta: 0
        },
        {
          id: 'HIST-404-03',
          shipper_id: 'SHP-404',
          timestamp: '2025-04-02T11:15:00Z',
          category: 'SECURITY_FLAG',
          title: 'Payment Instrument Velocity Spike Warning',
          description: '6 corporate virtual credit cards added within 48 hours across multiple branches. Pre-booking approval threshold temporarily reduced.',
          actor: 'Payment Fraud Detection Rule PR-09',
          status: 'WARNING',
          risk_delta: 20
        },
        {
          id: 'HIST-404-04',
          shipper_id: 'SHP-404',
          timestamp: '2025-04-05T16:00:00Z',
          category: 'KYC_AUDIT',
          title: 'Beneficial Ownership & Corporate Structure Verified',
          description: 'Ultimate Beneficial Owner (UBO) declarations submitted and verified with Emirates NBD banking references. Enhanced monitoring concluded.',
          actor: 'Senior Compliance Auditor V. Nair',
          status: 'RESOLVED',
          risk_delta: -15
        },
        {
          id: 'HIST-404-05',
          shipper_id: 'SHP-404',
          timestamp: '2026-08-11T13:20:00Z',
          category: 'CUSTOMS_CLEARANCE',
          title: 'Dubai DWC Air Cargo Compliance Audit Passed',
          description: 'Random statutory cargo inspection at Dubai World Central completed with zero contraband flags and full manifest integrity.',
          actor: 'Dubai Customs Inspection Unit',
          status: 'COMPLETED',
          port: 'AE-DXB-DUBAI',
          risk_delta: -5
        }
      ],
      'SHP-505': [
        {
          id: 'HIST-505-01',
          shipper_id: 'SHP-505',
          timestamp: '2023-11-20T09:30:00Z',
          category: 'REGISTRATION',
          title: 'Commercial Express Air Freight License Granted',
          description: 'DGCA Dangerous Goods Regulations (DGR) Category 6 handling accreditation certified for rapid transit air operations.',
          actor: 'Directorate General of Civil Aviation',
          status: 'COMPLETED',
          port: 'IN-DEL-DELHI',
          risk_delta: 0
        },
        {
          id: 'HIST-505-02',
          shipper_id: 'SHP-505',
          timestamp: '2024-02-14T10:15:00Z',
          category: 'CORRIDOR_APPROVAL',
          title: 'Pan-India Express Air Network Tier-1 Activated',
          description: 'Same-day and next-day air freight corridor interconnecting Delhi, Mumbai, Bengaluru, and Chennai hubs operationalized.',
          actor: 'Air Network Control Center',
          status: 'VERIFIED',
          port: 'IN-DEL-DELHI',
          risk_delta: 0
        },
        {
          id: 'HIST-505-03',
          shipper_id: 'SHP-505',
          timestamp: '2024-10-30T16:00:00Z',
          category: 'CREDIT_LIMIT',
          title: 'Credit Line Elevated to ₹75,00,000 INR',
          description: 'Excellent payment velocity and zero invoice delinquencies over 12 months. Fleet volume discount tier applied.',
          actor: 'Treasury & Corporate Accounts',
          status: 'COMPLETED',
          risk_delta: -5
        },
        {
          id: 'HIST-505-04',
          shipper_id: 'SHP-505',
          timestamp: '2025-07-19T11:45:00Z',
          category: 'DEVICE_BIND',
          title: 'Automated Warehouse Dispatch API Integration',
          description: 'Certified API webhook key provisioned for automated cargo manifest generation with zero manual data entry.',
          actor: 'Enterprise Systems Integration Team',
          status: 'VERIFIED',
          risk_delta: 0
        },
        {
          id: 'HIST-505-05',
          shipper_id: 'SHP-505',
          timestamp: '2026-09-01T14:10:00Z',
          category: 'KYC_AUDIT',
          title: 'Terminal 3 Cargo Biometric Gate Audit Passed',
          description: 'Mandatory quarterly audit of airport security badge holder logs and driver biometric authorizations at Delhi Terminal 3 Cargo complex.',
          actor: 'BCAS Airport Security Auditor',
          status: 'COMPLETED',
          port: 'IN-DEL-DELHI',
          risk_delta: -5
        }
      ]
    };

    if (defaultHistories[shipperId]) {
      return defaultHistories[shipperId];
    }

    const shipper = this.getShipperById(shipperId);
    const company = shipper ? shipper.company_name : 'Shipper';
    const country = shipper ? shipper.country : 'India';
    return [
      {
        id: `HIST-${shipperId}-01`,
        shipper_id: shipperId,
        timestamp: shipper?.created_at || '2024-01-01T09:00:00Z',
        category: 'REGISTRATION',
        title: `${company} Registered & Onboarded`,
        description: `Official corporate registration completed in ${country} with commercial cargo carrier dispatch credentials.`,
        actor: 'Carrier Onboarding Gateway',
        status: 'COMPLETED',
        risk_delta: 0
      },
      {
        id: `HIST-${shipperId}-02`,
        shipper_id: shipperId,
        timestamp: '2025-03-15T11:00:00Z',
        category: 'KYC_AUDIT',
        title: 'Statutory Business License Verified',
        description: `Corporate tax records and banking standing verified. Baseline trust score set to ${shipper?.trust_score || 80}/100.`,
        actor: 'Statutory Verification Office',
        status: 'VERIFIED',
        risk_delta: -5
      },
      {
        id: `HIST-${shipperId}-03`,
        shipper_id: shipperId,
        timestamp: '2026-06-20T14:30:00Z',
        category: 'CORRIDOR_APPROVAL',
        title: 'Approved Commercial Shipping Corridor',
        description: `Authorization issued for common origin ${shipper?.common_origins[0] || 'IN-BOM-MUMBAI'} to ${shipper?.common_destinations[0] || 'IN-BLR-BENGALURU'}.`,
        actor: 'Route Management Controller',
        status: 'VERIFIED',
        risk_delta: 0
      }
    ];
  }

  public getAccounts(): Account[] { return this.data.accounts; }
  public getAccountById(id: string): Account | undefined {
    return this.data.accounts.find(a => a.id === id);
  }

  public getPermissionProfiles(): PermissionProfile[] { return this.data.permissionProfiles; }
  public getPermissionProfileByAccountId(accountId: string): PermissionProfile | undefined {
    return this.data.permissionProfiles.find(p => p.account_id === accountId);
  }

  public getDevices(): Device[] { return this.data.devices; }
  public getDeviceById(id: string): Device | undefined {
    return this.data.devices.find(d => d.id === id);
  }

  public getPaymentMethods(): PaymentMethod[] { return this.data.paymentMethods; }
  public getPaymentMethodById(id: string): PaymentMethod | undefined {
    return this.data.paymentMethods.find(p => p.id === id);
  }

  public getBookings(): Booking[] { return this.data.bookings; }
  public getBookingById(id: string): Booking | undefined {
    return this.data.bookings.find(b => b.id === id);
  }

  public addBooking(booking: Booking): void {
    this.data.bookings.unshift(booking);
    // Update shipper stats
    const shipper = this.getShipperById(booking.shipper_id);
    if (shipper) {
      shipper.total_bookings += 1;
      const allShipperBookings = this.data.bookings.filter(b => b.shipper_id === shipper.id);
      const totalWeight = allShipperBookings.reduce((sum, b) => sum + b.weight_kg, 0);
      shipper.average_weight_kg = Number((totalWeight / allShipperBookings.length).toFixed(1));
      if (booking.weight_kg > shipper.max_weight_kg) {
        shipper.max_weight_kg = booking.weight_kg;
      }
      if (!shipper.common_destinations.includes(booking.destination)) {
        shipper.common_destinations.push(booking.destination);
      }
    }
    this.save();
  }

  public getRiskAssessments(): RiskAssessment[] { return this.data.riskAssessments; }
  public getRiskAssessmentByBookingId(bookingId: string): RiskAssessment | undefined {
    return this.data.riskAssessments.find(r => r.booking_id === bookingId);
  }
  public addRiskAssessment(assessment: RiskAssessment): void {
    this.data.riskAssessments.unshift(assessment);
    this.save();
  }

  public getIncidents(): Incident[] { return this.data.incidents; }
  public getIncidentById(id: string): Incident | undefined {
    return this.data.incidents.find(i => i.id === id);
  }
  public addIncident(incident: Incident): void {
    this.data.incidents.unshift(incident);
    const shipper = this.getShipperById(incident.shipper_id);
    if (shipper) {
      shipper.historical_incidents_count += 1;
      shipper.trust_score = Math.max(0, shipper.trust_score - 25);
    }
    this.save();
  }
  public updateIncident(id: string, updates: Partial<Incident>): Incident | undefined {
    const inc = this.data.incidents.find(i => i.id === id);
    if (inc) {
      Object.assign(inc, updates, { updated_at: new Date().toISOString() });
      this.save();
    }
    return inc;
  }

  public getIncidentEvents(incidentId: string): IncidentEvent[] {
    return this.data.incidentEvents
      .filter(e => e.incident_id === incidentId)
      .sort((a, b) => a.step_order - b.step_order);
  }
  public addIncidentEvents(events: IncidentEvent[]): void {
    this.data.incidentEvents.push(...events);
    this.save();
  }

  public getEvidenceList(incidentId?: string): Evidence[] {
    if (incidentId) {
      return this.data.evidenceList.filter(e => e.incident_id === incidentId);
    }
    return this.data.evidenceList;
  }
  public getEvidenceById(id: string): Evidence | undefined {
    return this.data.evidenceList.find(e => e.id === id);
  }
  public addEvidence(evidence: Evidence): void {
    this.data.evidenceList.push(evidence);
    this.save();
  }
  public setEvidenceTampered(id: string, tampered: boolean): boolean {
    const ev = this.getEvidenceById(id);
    if (ev) {
      ev.is_tampered = tampered;
      if (tampered) {
        // Mutate content to simulate tampering
        ev.content_data.tamper_marker = `TAMPERED_AT_${Date.now()}`;
      }
      this.save();
      return true;
    }
    return false;
  }

  public getComplianceRules(): ComplianceRule[] { return this.data.complianceRules; }
  public getComplianceChecks(bookingId?: string): ComplianceCheck[] {
    if (bookingId) {
      return this.data.complianceChecks.filter(c => c.booking_id === bookingId);
    }
    return this.data.complianceChecks;
  }
  public addComplianceChecks(checks: ComplianceCheck[]): void {
    this.data.complianceChecks.unshift(...checks);
    this.save();
  }

  public getBlockchainAnchors(incidentId?: string): BlockchainAnchor[] {
    if (incidentId) {
      return this.data.blockchainAnchors.filter(a => a.incident_id === incidentId);
    }
    return this.data.blockchainAnchors;
  }
  public getBlockchainAnchorById(id: string): BlockchainAnchor | undefined {
    return this.data.blockchainAnchors.find(a => a.id === id);
  }
  public addBlockchainAnchor(anchor: BlockchainAnchor): void {
    this.data.blockchainAnchors.unshift(anchor);
    this.save();
  }

  public getReports(): ReportRecord[] { return this.data.reports; }
  public addReport(report: ReportRecord): void {
    this.data.reports.unshift(report);
    this.save();
  }

  public getAuditEvents(): AuditEvent[] { return this.data.auditEvents; }
  public addAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): AuditEvent {
    const fullEvent: AuditEvent = {
      ...event,
      id: `AUD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      timestamp: new Date().toISOString(),
    };
    this.data.auditEvents.unshift(fullEvent);
    this.save();
    return fullEvent;
  }

  public getSettings(): SystemSettings { return this.data.settings; }
  public updateSettings(partial: Partial<SystemSettings>): SystemSettings {
    if (partial.risk_weights) {
      this.data.settings.risk_weights = { ...this.data.settings.risk_weights, ...partial.risk_weights };
    }
    if (partial.thresholds) {
      this.data.settings.thresholds = { ...this.data.settings.thresholds, ...partial.thresholds };
    }
    if (partial.features) {
      this.data.settings.features = { ...this.data.settings.features, ...partial.features };
    }
    if (partial.fallback_policy) {
      this.data.settings.fallback_policy = partial.fallback_policy;
    }
    this.data.settings.system_metadata.last_reloaded = new Date().toISOString();
    this.save();
    return this.data.settings;
  }
}
