export type UserRole = 'ADMIN' | 'FRAUD_ANALYST' | 'COMPLIANCE_ANALYST' | 'AUDITOR' | 'VIEWER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  username?: string;
  phone?: string;
  token?: string;
}

export interface Shipper {
  id: string;
  company_name: string;
  email: string;
  phone: string;
  country: string;
  created_at: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED' | 'FLAGGED';
  trust_score: number;
  verified_identity: boolean;
  kyc_status: 'VERIFIED' | 'PENDING' | 'REJECTED';
  total_bookings: number;
  average_weight_kg: number;
  max_weight_kg: number;
  common_origins: string[];
  common_destinations: string[];
  historical_incidents_count: number;
}

export interface ShipperHistoryEvent {
  id: string;
  shipper_id: string;
  timestamp: string;
  category: 'REGISTRATION' | 'KYC_AUDIT' | 'CUSTOMS_CLEARANCE' | 'SECURITY_FLAG' | 'CREDIT_LIMIT' | 'CORRIDOR_APPROVAL' | 'DEVICE_BIND' | 'INSPECTION' | 'STATUS_CHANGE';
  title: string;
  description: string;
  actor: string;
  status: 'COMPLETED' | 'FLAGGED' | 'RESOLVED' | 'VERIFIED' | 'WARNING';
  reference_id?: string;
  port?: string;
  risk_delta?: number;
}

export interface Account {
  id: string;
  shipper_id: string;
  account_number: string;
  tier: 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
  created_at: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED';
  is_cold_start: boolean;
  credit_limit: number;
}

export interface PermissionProfile {
  id: string;
  account_id: string;
  allowed_domestic: boolean;
  allowed_international: boolean;
  allowed_service_types: string[];
  max_weight_kg: number;
  approved_destinations: string[];
  approved_origins: string[];
  allowed_payment_types: string[];
}

export interface Device {
  id: string;
  device_fingerprint: string;
  ip_address: string;
  network_asn: string;
  user_agent: string;
  is_flagged_suspicious: boolean;
  previously_blocked_link?: string;
  last_seen: string;
  associated_accounts: string[];
}

export interface PaymentMethod {
  id: string;
  shipper_id: string;
  account_id: string;
  payment_type: 'CREDIT_CARD' | 'CORPORATE_ACH' | 'PREPAID' | 'WIRE_TRANSFER';
  masked_number: string;
  card_holder: string;
  billing_country: string;
  is_verified: boolean;
  risk_flag: boolean;
  failure_count: number;
}

export interface Booking {
  id: string;
  booking_reference: string;
  shipper_id: string;
  account_id: string;
  payment_id: string;
  device_id: string;
  origin: string;
  destination: string;
  weight_kg: number;
  service_type: string;
  package_category: string;
  declared_value_inr: number;
  declared_value_usd?: number;
  booking_timestamp: string;
  status: 'PROCESSED' | 'HELD' | 'BLOCKED';
  created_at: string;
  assessment?: RiskAssessment;
  shipper?: Shipper;
}

export interface TriggeredSignal {
  code: string;
  category: 'IDENTITY' | 'BEHAVIOR' | 'SHIPMENT' | 'PAYMENT' | 'DESTINATION' | 'COMPLIANCE' | 'RELATIONSHIP';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  score_contribution: number;
  observed_value?: string | number;
  expected_value?: string | number;
}

export interface RiskAssessment {
  id: string;
  booking_id: string;
  identity_score: number;
  behavior_score: number;
  shipment_score: number;
  payment_score: number;
  destination_score: number;
  compliance_score: number;
  final_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  decision: 'ALLOW' | 'HOLD' | 'BLOCK';
  digital_trust_score: number;
  triggered_signals: TriggeredSignal[];
  ml_anomaly_score: number;
  ml_status: 'ACTIVE' | 'INSUFFICIENT_DATA' | 'DISABLED';
  ml_model_version: string;
  fallback_level: 'LEVEL 1 — AI/ML DETECTION' | 'LEVEL 2 — RULE-BASED FALLBACK' | 'LEVEL 3 — MANDATORY HUMAN REVIEW';
  explanation: string;
  explanation_source: 'GENAI' | 'DETERMINISTIC_RULES';
  authorized_vs_observed?: {
    destination: { authorized: string[]; observed: string; matches: boolean };
    service_type: { authorized: string[]; observed: string; matches: boolean };
    weight: { authorized_max: number; observed: number; matches: boolean; multiple?: number };
    payment: { authorized_type: string[]; observed: string; matches: boolean };
  };
  created_at: string;
}

export interface IncidentEvent {
  id: string;
  incident_id: string;
  step_order: number;
  event_type: 'AUTH' | 'DEVICE' | 'PAYMENT' | 'DESTINATION' | 'BOOKING' | 'FRAUD_ANALYSIS' | 'DECISION' | 'INCIDENT_CREATED' | 'EVIDENCE_SEALED';
  title: string;
  description: string;
  timestamp: string;
  entity_type: string;
  entity_id: string;
  risk_delta: number;
  metadata?: Record<string, any>;
}

export interface Incident {
  id: string;
  incident_number: string;
  booking_id: string;
  shipper_id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_score: number;
  decision: 'HOLD' | 'BLOCK';
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'FALSE_POSITIVE' | 'ESCALATED';
  assigned_to?: string;
  triggered_rules: string[];
  evidence_ids: string[];
  created_at: string;
  updated_at: string;
  resolution_notes?: string;
  attack_path_node_ids?: string[];
  booking?: Booking;
  shipper?: Shipper;
}

export interface Evidence {
  id: string;
  incident_id: string;
  booking_id?: string;
  source_event: string;
  source_system: string;
  created_at: string;
  creator: string;
  content_data: Record<string, any>;
  previous_hash: string;
  current_hash: string;
  is_tampered?: boolean;
}

export interface ComplianceRule {
  id: string;
  authority: string;
  law_regulation: string;
  section_rule: string;
  requirement: string;
  source_url: string;
  effective_date: string;
  version: string;
  applicable_shipment_type: string;
}

export interface ComplianceCheck {
  id: string;
  booking_id: string;
  rule_id: string;
  authority: string;
  law_regulation: string;
  section_rule: string;
  requirement: string;
  status: 'PASS' | 'FAIL' | 'REVIEW';
  evidence_summary: string;
  verified_at: string;
  verifier: string;
}

export interface AuditEvent {
  id: string;
  actor_name: string;
  actor_role: UserRole;
  action: string;
  resource_type: string;
  resource_id: string;
  timestamp: string;
  ip_address: string;
  result: 'SUCCESS' | 'DENIED' | 'FAILED';
  details?: Record<string, any>;
}

export interface BlockchainAnchor {
  id: string;
  evidence_id: string;
  incident_id: string;
  anchor_tx_id: string;
  block_number: number;
  network_mode: 'SIMULATED' | 'REAL';
  timestamp: string;
  document_hash: string;
  merkle_root: string;
  state: 'ANCHORED' | 'VERIFIED';
}

export interface ReportRecord {
  id: string;
  report_type: 'FRAUD_INVESTIGATION' | 'COMPLIANCE_VERIFICATION' | 'EVIDENCE_MANIFEST' | 'SHIPPER_APPROVAL';
  title: string;
  filename: string;
  filepath: string;
  file_size_bytes: number;
  sha256_hash: string;
  incident_id?: string;
  booking_id?: string;
  shipper_id?: string;
  created_at: string;
  creator: string;
  download_url: string;
}

export interface SystemSettings {
  risk_weights: {
    identity_permission: number;
    behavior_anomaly: number;
    shipment_anomaly: number;
    payment_risk: number;
    destination_risk: number;
    policy_compliance: number;
  };
  thresholds: {
    allow_max: number;
    hold_max: number;
    block_min: number;
  };
  features: {
    ml_enabled: boolean;
    genai_enabled: boolean;
    blockchain_mode: 'SIMULATED' | 'REAL';
    strict_cold_start: boolean;
  };
  fallback_policy: 'AUTO' | 'FORCE_LEVEL_2' | 'FORCE_LEVEL_3';
  system_metadata: {
    version: string;
    environment: string;
    last_reloaded: string;
  };
}

export interface TopologyNode {
  id: string;
  label: string;
  type: string;
  status?: string;
  risk_contribution?: number;
  metadata?: Record<string, any>;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  is_suspicious?: boolean;
  is_attack_path?: boolean;
  metadata?: Record<string, any>;
}

export interface DashboardMetrics {
  total_screened: number;
  high_risk_count: number;
  blocked_count: number;
  held_count: number;
  allowed_count: number;
  active_incidents: number;
  fraud_prevented_value_inr: number;
  fraud_prevented_value_usd?: number;
  average_risk_score: number;
  risk_trend: { time: string; score: number; volume: number }[];
  decision_distribution: { decision: string; count: number; percentage: number }[];
  top_suspicious_destinations: { destination: string; count: number; risk_avg: number }[];
  top_suspicious_devices: { device_id: string; count: number; flag: string }[];
  signal_frequency: { signal: string; category: string; count: number }[];
  is_demo_data?: boolean;
}
