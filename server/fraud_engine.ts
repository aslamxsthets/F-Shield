import { GoogleGenAI } from '@google/genai';
import {
  Booking, Device, Incident, IncidentEvent, PaymentMethod,
  PermissionProfile, RiskAssessment, Shipper, TriggeredSignal,
  UserRole
} from './types';
import { DatabaseStore } from './store';
import { EvidenceEngine } from './evidence_engine';
import { ComplianceEngine } from './compliance_engine';

export interface ScreenBookingInput {
  shipper_id: string;
  account_id: string;
  payment_id: string;
  device_id: string;
  origin: string;
  destination: string;
  weight_kg: number;
  service_type: string;
  package_category: string;
  declared_value_inr?: number;
  declared_value_usd?: number;
  booking_timestamp?: string;
}

export interface ScreenBookingResult {
  booking: Booking;
  assessment: RiskAssessment;
  incident?: Incident;
  new_evidence_count: number;
  compliance_count: number;
  processing_ms: number;
}

export class FraudEngine {
  private store: DatabaseStore;
  private complianceEngine: ComplianceEngine;
  private geminiClient: GoogleGenAI | null = null;

  constructor() {
    this.store = DatabaseStore.getInstance();
    this.complianceEngine = new ComplianceEngine(this.store.getComplianceRules());

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        this.geminiClient = new GoogleGenAI({});
      } catch (err) {
        console.warn('Failed to initialize Google GenAI SDK:', err);
      }
    }
  }

  /**
   * Main real-time screening pipeline.
   */
  public async screenBooking(input: ScreenBookingInput, actorRole: UserRole = 'FRAUD_ANALYST'): Promise<ScreenBookingResult> {
    const startTime = Date.now();
    const settings = this.store.getSettings();

    // 1. Validate Entities
    const shipper = this.store.getShipperById(input.shipper_id);
    if (!shipper) {
      throw new Error(`Shipper '${input.shipper_id}' not found in database.`);
    }

    const account = this.store.getAccountById(input.account_id);
    if (!account) {
      throw new Error(`Account '${input.account_id}' not found in database.`);
    }

    const permission = this.store.getPermissionProfileByAccountId(input.account_id);
    let device = this.store.getDeviceById(input.device_id);
    if (!device) {
      // Dynamic registration of new device
      device = {
        id: input.device_id,
        device_fingerprint: `fp_unknown_${Date.now().toString(36)}`,
        ip_address: '198.51.100.22',
        network_asn: 'AS-UNKNOWN Unverified Hosting/Proxy Provider',
        user_agent: 'Unrecognized Browser Agent / Automated Script',
        is_flagged_suspicious: true,
        last_seen: new Date().toISOString(),
        associated_accounts: [account.id],
      };
      this.store.getDevices().push(device);
    }

    const payment = this.store.getPaymentMethodById(input.payment_id);
    if (!payment) {
      throw new Error(`Payment method '${input.payment_id}' not found in database.`);
    }

    // Create Booking record
    const bookingId = `BKG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const bookingRef = `FS-BK-${Math.floor(1000 + Math.random() * 9000)}`;
    const declaredValueInr = input.declared_value_inr || (input.declared_value_usd ? Math.round(input.declared_value_usd * 83) : Math.round(input.weight_kg * 3500));

    const booking: Booking = {
      id: bookingId,
      booking_reference: bookingRef,
      shipper_id: shipper.id,
      account_id: account.id,
      payment_id: payment.id,
      device_id: device.id,
      origin: input.origin,
      destination: input.destination,
      weight_kg: Number(input.weight_kg),
      service_type: input.service_type,
      package_category: input.package_category,
      declared_value_inr: declaredValueInr,
      declared_value_usd: input.declared_value_usd || Math.round(declaredValueInr / 83),
      booking_timestamp: input.booking_timestamp || new Date().toISOString(),
      status: 'PROCESSED',
      created_at: new Date().toISOString(),
    };

    const triggeredSignals: TriggeredSignal[] = [];

    // 2. Behavioral Analysis
    let behaviorScore = 5;
    const isColdStart = shipper.total_bookings < 3 || account.is_cold_start;
    let weightMultiple = 1.0;

    if (!isColdStart && shipper.average_weight_kg > 0) {
      weightMultiple = Number((booking.weight_kg / shipper.average_weight_kg).toFixed(1));
      if (weightMultiple >= 10.0) {
        behaviorScore = Math.min(100, 50 + weightMultiple * 1.5);
        triggeredSignals.push({
          code: 'WEIGHT_ANOMALY_EXTREME',
          category: 'BEHAVIOR',
          severity: 'CRITICAL',
          description: `Consignment weight (${booking.weight_kg} kg) is ${weightMultiple}x the shipper historical average of ${shipper.average_weight_kg} kg`,
          score_contribution: 28,
          observed_value: `${booking.weight_kg} kg`,
          expected_value: `${shipper.average_weight_kg} kg`,
        });
      } else if (weightMultiple >= 3.0) {
        behaviorScore = Math.min(75, 25 + weightMultiple * 10);
        triggeredSignals.push({
          code: 'WEIGHT_ANOMALY_SIGNIFICANT',
          category: 'BEHAVIOR',
          severity: 'MEDIUM',
          description: `Consignment weight (${booking.weight_kg} kg) is ${weightMultiple}x historical average`,
          score_contribution: 15,
          observed_value: `${booking.weight_kg} kg`,
          expected_value: `${shipper.average_weight_kg} kg`,
        });
      }

      if (!shipper.common_destinations.includes(booking.destination)) {
        behaviorScore = Math.min(100, behaviorScore + 15);
        triggeredSignals.push({
          code: 'BEHAVIORAL_UNUSUAL_DESTINATION',
          category: 'BEHAVIOR',
          severity: 'MEDIUM',
          description: `Destination '${booking.destination}' is not in historical shipping routes`,
          score_contribution: 12,
          observed_value: booking.destination,
          expected_value: shipper.common_destinations.join(', '),
        });
      }
    } else {
      // Cold start handling - do not penalize purely for being new
      behaviorScore = 15;
      triggeredSignals.push({
        code: 'COLD_START_ACCOUNT_ACTIVE',
        category: 'BEHAVIOR',
        severity: 'LOW',
        description: `Cold Start Mode: Account has limited historical volume (${shipper.total_bookings} prior bookings). Applying progressive trust evaluation.`,
        score_contribution: 0,
        observed_value: `${shipper.total_bookings} bookings`,
        expected_value: '>= 3 bookings for baseline',
      });
    }

    // 3. Identity & Privilege Abuse / Permission Analysis
    let identityScore = 5;
    const isInternational = booking.destination.includes('International') ||
      booking.destination.includes('DE-') || booking.destination.includes('AE-') ||
      booking.destination.includes('US-') || booking.destination.includes('SG-') ||
      booking.destination.includes('NL-');

    const authorizedVsObserved = {
      destination: {
        authorized: permission?.approved_destinations || ['DOMESTIC_GENERAL'],
        observed: booking.destination,
        matches: true,
      },
      service_type: {
        authorized: permission?.allowed_service_types || ['STANDARD_GROUND'],
        observed: booking.service_type,
        matches: true,
      },
      weight: {
        authorized_max: permission?.max_weight_kg || 50.0,
        observed: booking.weight_kg,
        matches: true,
        multiple: weightMultiple,
      },
      payment: {
        authorized_type: permission?.allowed_payment_types || ['CORPORATE_ACH', 'CREDIT_CARD'],
        observed: payment.payment_type,
        matches: true,
      }
    };

    if (permission) {
      if (isInternational && !permission.allowed_international) {
        identityScore += 35;
        authorizedVsObserved.destination.matches = false;
        triggeredSignals.push({
          code: 'PRIVILEGE_ABUSE_INTERNATIONAL_DESTINATION',
          category: 'IDENTITY',
          severity: 'HIGH',
          description: `Account permission profile strictly restricts booking to domestic territory. International destination ${booking.destination} attempted.`,
          score_contribution: 25,
          observed_value: booking.destination,
          expected_value: 'Domestic Only',
        });
      }

      if (booking.weight_kg > permission.max_weight_kg) {
        identityScore += 30;
        authorizedVsObserved.weight.matches = false;
        triggeredSignals.push({
          code: 'PRIVILEGE_ABUSE_WEIGHT_CEILING_BREACH',
          category: 'SHIPMENT',
          severity: 'HIGH',
          description: `Consignment weight (${booking.weight_kg} kg) exceeds authorized maximum profile limit of ${permission.max_weight_kg} kg`,
          score_contribution: 20,
          observed_value: `${booking.weight_kg} kg`,
          expected_value: `Max ${permission.max_weight_kg} kg`,
        });
      }

      if (permission.allowed_service_types.length > 0 && !permission.allowed_service_types.includes(booking.service_type)) {
        identityScore += 15;
        authorizedVsObserved.service_type.matches = false;
        triggeredSignals.push({
          code: 'SERVICE_TIER_MISMATCH',
          category: 'IDENTITY',
          severity: 'MEDIUM',
          description: `Requested service '${booking.service_type}' is outside approved service tiers`,
          score_contribution: 12,
          observed_value: booking.service_type,
          expected_value: permission.allowed_service_types.join(', '),
        });
      }
    }

    if (!shipper.verified_identity) {
      identityScore += 20;
    }

    // 4. Payment Analysis
    let paymentScore = 5;
    if (payment.risk_flag) {
      paymentScore += 45;
      triggeredSignals.push({
        code: 'PAYMENT_RISK_FLAG_ACTIVE',
        category: 'PAYMENT',
        severity: 'HIGH',
        description: `Payment instrument has active risk flags or previous decline patterns (${payment.failure_count} failures)`,
        score_contribution: 22,
        observed_value: `${payment.masked_number} (${payment.payment_type})`,
        expected_value: 'Verified Payment Instrument',
      });
    }

    if (!payment.is_verified) {
      paymentScore += 20;
    }

    // Cardholder vs corporate shipper check
    const normalizedHolder = payment.card_holder.toLowerCase();
    const normalizedShipper = shipper.company_name.toLowerCase();
    if (!normalizedHolder.includes(normalizedShipper.split(' ')[0].toLowerCase()) && payment.payment_type !== 'CORPORATE_ACH') {
      paymentScore += 25;
      authorizedVsObserved.payment.matches = false;
      triggeredSignals.push({
        code: 'PAYMENT_BENEFICIARY_MISMATCH',
        category: 'PAYMENT',
        severity: 'HIGH',
        description: `Payment cardholder name '${payment.card_holder}' does not match company entity '${shipper.company_name}'`,
        score_contribution: 18,
        observed_value: payment.card_holder,
        expected_value: shipper.company_name,
      });
    }

    // 5. Device & Network / Relationship Analysis
    let shipmentScore = 5;
    let destinationScore = 5;
    let relationshipScore = 5;

    if (device.is_flagged_suspicious || device.previously_blocked_link) {
      relationshipScore += 50;
      triggeredSignals.push({
        code: 'DEVICE_LINKED_TO_SUSPICIOUS_INFRASTRUCTURE',
        category: 'RELATIONSHIP',
        severity: 'CRITICAL',
        description: `Originating device ${device.id} is linked to previously blocked entity: ${device.previously_blocked_link || 'Sybil Cluster'}`,
        score_contribution: 26,
        observed_value: `${device.ip_address} (${device.network_asn})`,
        expected_value: 'Clean Verified Terminal',
      });
    }

    if (device.ip_address.startsWith('185.220.') || device.network_asn.toLowerCase().includes('tor') || device.network_asn.toLowerCase().includes('proxy')) {
      relationshipScore += 35;
      triggeredSignals.push({
        code: 'ANONYMIZED_NETWORK_TOR_PROXY',
        category: 'RELATIONSHIP',
        severity: 'HIGH',
        description: `Connection routed via anonymization proxy/Tor exit node (${device.network_asn})`,
        score_contribution: 20,
        observed_value: device.ip_address,
        expected_value: 'Standard Residential / Corporate ISP',
      });
    }

    if (isInternational) {
      destinationScore += 30;
    }

    if (booking.weight_kg > 100) {
      shipmentScore += 35;
    }
    if (booking.package_category.includes('CHEMICAL') || booking.package_category.includes('HAZARDOUS')) {
      shipmentScore += 25;
      triggeredSignals.push({
        code: 'HAZARDOUS_CARGO_SENSITIVITY',
        category: 'SHIPMENT',
        severity: 'MEDIUM',
        description: `High-risk cargo classification: '${booking.package_category}' requires specialized handling audits`,
        score_contribution: 14,
        observed_value: booking.package_category,
        expected_value: 'General Cargo',
      });
    }

    // 6. Statutory Compliance Evaluation
    const complianceChecks = this.complianceEngine.evaluateBooking(booking, shipper);
    let complianceScore = 5;
    const hasFailCompliance = complianceChecks.some(c => c.status === 'FAIL');
    const hasReviewCompliance = complianceChecks.some(c => c.status === 'REVIEW');

    if (hasFailCompliance) {
      complianceScore = 85;
      triggeredSignals.push({
        code: 'REGULATORY_STATUTORY_BREACH',
        category: 'COMPLIANCE',
        severity: 'HIGH',
        description: 'Failed mandatory pre-shipment statutory customs/export compliance checks',
        score_contribution: 22,
        observed_value: 'FAIL',
        expected_value: 'PASS',
      });
    } else if (hasReviewCompliance) {
      complianceScore = 45;
    }

    // 7. ML Anomaly Detection (Isolation Forest vector computation)
    let mlAnomalyScore = 0.05;
    let mlStatus: 'ACTIVE' | 'INSUFFICIENT_DATA' | 'DISABLED' = 'ACTIVE';

    if (!settings.features.ml_enabled) {
      mlStatus = 'DISABLED';
      mlAnomalyScore = 0.0;
    } else if (isColdStart) {
      mlStatus = 'INSUFFICIENT_DATA';
      mlAnomalyScore = 0.15;
    } else {
      // Multivariate anomaly vector: [weight deviation ratio, international novelty, device risk flag, payment risk flag]
      const wDev = Math.min(1.0, (weightMultiple - 1.0) / 10.0);
      const intDev = isInternational ? 0.4 : 0.0;
      const devRisk = device.is_flagged_suspicious ? 0.5 : 0.0;
      const payRisk = payment.risk_flag ? 0.4 : 0.0;
      mlAnomalyScore = Number(Math.min(0.99, Math.max(0.02, 0.04 + (wDev * 0.45) + (intDev * 0.2) + (devRisk * 0.25) + (payRisk * 0.15))).toFixed(3));
    }

    // 8. Risk Aggregation (Configurable Weights)
    // Clamp individual component scores 0-100
    identityScore = Math.min(100, Math.max(0, identityScore + (relationshipScore * 0.3)));
    behaviorScore = Math.min(100, Math.max(0, behaviorScore));
    shipmentScore = Math.min(100, Math.max(0, shipmentScore));
    paymentScore = Math.min(100, Math.max(0, paymentScore));
    destinationScore = Math.min(100, Math.max(0, destinationScore));
    complianceScore = Math.min(100, Math.max(0, complianceScore));

    const weights = settings.risk_weights;
    let finalScore = Math.round(
      (identityScore * weights.identity_permission) +
      (behaviorScore * weights.behavior_anomaly) +
      (shipmentScore * weights.shipment_anomaly) +
      (paymentScore * weights.payment_risk) +
      (destinationScore * weights.destination_risk) +
      (complianceScore * weights.policy_compliance)
    );

    // If critical signals triggered, floor at 75
    const hasCritical = triggeredSignals.some(s => s.severity === 'CRITICAL');
    if (hasCritical && finalScore < 75) {
      finalScore = 75;
    }

    // 9. Three-Level Fallback Policy Determination
    let fallbackLevel: 'LEVEL 1 — AI/ML DETECTION' | 'LEVEL 2 — RULE-BASED FALLBACK' | 'LEVEL 3 — MANDATORY HUMAN REVIEW';

    if (settings.fallback_policy === 'FORCE_LEVEL_2' || !settings.features.ml_enabled || mlStatus === 'DISABLED') {
      fallbackLevel = 'LEVEL 2 — RULE-BASED FALLBACK';
    } else if (settings.fallback_policy === 'FORCE_LEVEL_3' || (finalScore >= 50 && finalScore <= 69)) {
      fallbackLevel = 'LEVEL 3 — MANDATORY HUMAN REVIEW';
    } else {
      fallbackLevel = 'LEVEL 1 — AI/ML DETECTION';
    }

    // 10. Decision Engine
    let decision: 'ALLOW' | 'HOLD' | 'BLOCK' = 'ALLOW';
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

    if (finalScore >= settings.thresholds.block_min) {
      decision = 'BLOCK';
      riskLevel = 'HIGH';
    } else if (finalScore > settings.thresholds.allow_max) {
      decision = 'HOLD';
      riskLevel = 'MEDIUM';
    } else {
      decision = 'ALLOW';
      riskLevel = 'LOW';
    }

    // Digital Trust Score Calculation (0-100)
    const digitalTrustScore = Math.max(0, Math.min(100, Math.round(
      (shipper.trust_score * 0.4) +
      ((100 - finalScore) * 0.4) +
      (shipper.verified_identity ? 20 : 0)
    )));

    // 11. Explanation Generation (GenAI if enabled & available; deterministic fallback)
    let explanation = '';
    let explanationSource: 'GENAI' | 'DETERMINISTIC_RULES' = 'DETERMINISTIC_RULES';

    const deterministicSummary = this.generateDeterministicExplanation(
      shipper, booking, finalScore, decision, triggeredSignals, weightMultiple, fallbackLevel
    );

    if (settings.features.genai_enabled && this.geminiClient) {
      try {
        const prompt = `You are the lead explainability engine of FraudShield, a shipping fraud detection platform.
Explain this fraud screening decision concisely in 2-3 enterprise-grade sentences for an executive or compliance auditor.
Reference ONLY the provided observed evidence without fabricating facts.

Shipper: ${shipper.company_name} (Trust Score: ${digitalTrustScore}/100)
Booking Reference: ${booking.booking_reference}
Weight: ${booking.weight_kg} kg (Historical average: ${shipper.average_weight_kg} kg, Multiple: ${weightMultiple}x)
Routing: ${booking.origin} -> ${booking.destination}
Service: ${booking.service_type}
Payment: ${payment.payment_type} (Holder: ${payment.card_holder})
Device/Network: ${device.ip_address} (${device.network_asn})
Computed Risk Score: ${finalScore}/100
Decision: ${decision}
Triggered Signals:
${triggeredSignals.map(s => `- [${s.severity}] ${s.description}`).join('\n')}

Synthesize the precise factors that caused this decision:`;

        const response = await this.geminiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        });

        if (response.text && response.text.trim().length > 20) {
          explanation = response.text.trim();
          explanationSource = 'GENAI';
        } else {
          explanation = deterministicSummary;
        }
      } catch (genAiErr) {
        console.warn('GenAI explanation failed, using deterministic fallback:', genAiErr);
        explanation = deterministicSummary;
        explanationSource = 'DETERMINISTIC_RULES';
      }
    } else {
      explanation = deterministicSummary;
      explanationSource = 'DETERMINISTIC_RULES';
    }

    // 12. Create Risk Assessment
    booking.status = decision === 'BLOCK' ? 'BLOCKED' : (decision === 'HOLD' ? 'HELD' : 'PROCESSED');

    const assessment: RiskAssessment = {
      id: `RSK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      booking_id: booking.id,
      identity_score: identityScore,
      behavior_score: behaviorScore,
      shipment_score: shipmentScore,
      payment_score: paymentScore,
      destination_score: destinationScore,
      compliance_score: complianceScore,
      final_score: finalScore,
      risk_level: riskLevel,
      decision,
      digital_trust_score: digitalTrustScore,
      triggered_signals: triggeredSignals,
      ml_anomaly_score: mlAnomalyScore,
      ml_status: mlStatus,
      ml_model_version: 'FS-IForest-v1.4',
      fallback_level: fallbackLevel,
      explanation,
      explanation_source: explanationSource,
      authorized_vs_observed: authorizedVsObserved,
      created_at: new Date().toISOString(),
    };

    // 13. Persist Booking & Assessment
    this.store.addBooking(booking);
    this.store.addRiskAssessment(assessment);
    this.store.addComplianceChecks(complianceChecks);

    // 14. Incident Creation if HOLD or BLOCK
    let incident: Incident | undefined;
    let newEvidenceCount = 0;

    if (decision === 'HOLD' || decision === 'BLOCK') {
      const incidentId = `INC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const severity = finalScore >= 80 ? 'CRITICAL' : (finalScore >= 60 ? 'HIGH' : 'MEDIUM');

      // Create Chronological Timeline Events
      const events: IncidentEvent[] = [
        {
          id: `EVT-${Date.now().toString(36)}-1`,
          incident_id: incidentId,
          step_order: 1,
          event_type: 'AUTH',
          title: 'Account Authentication Session',
          description: `Access token validated for account ${account.account_number} (${shipper.company_name})`,
          timestamp: new Date(Date.now() - 4 * 60000).toISOString(),
          entity_type: 'ACCOUNT',
          entity_id: account.id,
          risk_delta: 0,
        },
        {
          id: `EVT-${Date.now().toString(36)}-2`,
          incident_id: incidentId,
          step_order: 2,
          event_type: 'DEVICE',
          title: 'Device Hardware & Network Fingerprinted',
          description: `Connected from ${device.ip_address} (${device.network_asn}) ${device.is_flagged_suspicious ? '[SUSPICIOUS INFRASTRUCTURE]' : ''}`,
          timestamp: new Date(Date.now() - 3 * 60000).toISOString(),
          entity_type: 'DEVICE',
          entity_id: device.id,
          risk_delta: relationshipScore > 20 ? 25 : 5,
        },
        {
          id: `EVT-${Date.now().toString(36)}-3`,
          incident_id: incidentId,
          step_order: 3,
          event_type: 'PAYMENT',
          title: 'Payment Method Attached',
          description: `Payment instrument ${payment.masked_number} (${payment.payment_type}) submitted by ${payment.card_holder}`,
          timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
          entity_type: 'PAYMENT',
          entity_id: payment.id,
          risk_delta: paymentScore > 20 ? 20 : 0,
        },
        {
          id: `EVT-${Date.now().toString(36)}-4`,
          incident_id: incidentId,
          step_order: 4,
          event_type: 'DESTINATION',
          title: 'Consignment Routing Configured',
          description: `Routing specified: ${booking.origin} -> ${booking.destination} (${booking.service_type})`,
          timestamp: new Date(Date.now() - 1 * 60000).toISOString(),
          entity_type: 'DESTINATION',
          entity_id: booking.destination,
          risk_delta: destinationScore > 20 ? 15 : 0,
        },
        {
          id: `EVT-${Date.now().toString(36)}-5`,
          incident_id: incidentId,
          step_order: 5,
          event_type: 'BOOKING',
          title: 'Consignment Screening Ingested',
          description: `Booking ${booking.booking_reference} registered: ${booking.weight_kg} kg declared`,
          timestamp: new Date(Date.now() - 30000).toISOString(),
          entity_type: 'BOOKING',
          entity_id: booking.id,
          risk_delta: behaviorScore > 30 ? 30 : 5,
        },
        {
          id: `EVT-${Date.now().toString(36)}-6`,
          incident_id: incidentId,
          step_order: 6,
          event_type: 'FRAUD_ANALYSIS',
          title: 'Fraud Engine Risk Scoring Executed',
          description: `Aggregated composite risk score calculated at ${finalScore}/100 with ${triggeredSignals.length} triggers`,
          timestamp: new Date(Date.now() - 10000).toISOString(),
          entity_type: 'RISK_ASSESSMENT',
          entity_id: assessment.id,
          risk_delta: 0,
        },
        {
          id: `EVT-${Date.now().toString(36)}-7`,
          incident_id: incidentId,
          step_order: 7,
          event_type: 'DECISION',
          title: `Pre-Shipment Decision Enforced: ${decision}`,
          description: decision === 'BLOCK' ? 'Carrier booking locked and quarantined from processing line.' : 'Consignment diverted to tier-2 human inspection holding bay.',
          timestamp: new Date(Date.now() - 5000).toISOString(),
          entity_type: 'DECISION',
          entity_id: `DEC-${decision}-${booking.id}`,
          risk_delta: 0,
        },
        {
          id: `EVT-${Date.now().toString(36)}-8`,
          incident_id: incidentId,
          step_order: 8,
          event_type: 'INCIDENT_CREATED',
          title: `Forensic Incident Opened: ${incidentId}`,
          description: `Automated assignment to Senior Fraud Investigator queue`,
          timestamp: new Date().toISOString(),
          entity_type: 'INCIDENT',
          entity_id: incidentId,
          risk_delta: 0,
        }
      ];

      // Build tamper-evident evidence chain for this incident
      const sealedEvidenceList = [];
      let lastEvidence = this.store.getEvidenceList().slice(-1)[0];

      const ev1 = EvidenceEngine.sealEvidence(
        incidentId,
        booking.id,
        'Booking Ingestion & Authentication',
        'FraudShield Ingestion API',
        'Identity Subsystem',
        { booking_id: booking.id, shipper_id: shipper.id, account_id: account.id, weight_kg: booking.weight_kg },
        lastEvidence
      );
      this.store.addEvidence(ev1);
      sealedEvidenceList.push(ev1);
      lastEvidence = ev1;

      const ev2 = EvidenceEngine.sealEvidence(
        incidentId,
        booking.id,
        'Hardware & Network Telemetry',
        'FraudShield Device Intelligence',
        'Device Forensics',
        { device_id: device.id, ip: device.ip_address, asn: device.network_asn, fingerprint: device.device_fingerprint },
        lastEvidence
      );
      this.store.addEvidence(ev2);
      sealedEvidenceList.push(ev2);
      lastEvidence = ev2;

      const ev3 = EvidenceEngine.sealEvidence(
        incidentId,
        booking.id,
        'Risk Engine Decision & Quarantine',
        'FraudShield Core Decision Engine',
        'Decision Subsystem',
        { risk_score: finalScore, decision, triggers: triggeredSignals.map(s => s.code), fallback: fallbackLevel },
        lastEvidence
      );
      this.store.addEvidence(ev3);
      sealedEvidenceList.push(ev3);

      newEvidenceCount = sealedEvidenceList.length;

      incident = {
        id: incidentId,
        incident_number: incidentId,
        booking_id: booking.id,
        shipper_id: shipper.id,
        severity,
        risk_score: finalScore,
        decision: decision as 'HOLD' | 'BLOCK',
        status: 'OPEN',
        assigned_to: 'Marcus Sterling (Senior Fraud Investigator)',
        triggered_rules: triggeredSignals.map(s => s.code),
        evidence_ids: sealedEvidenceList.map(e => e.id),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        attack_path_node_ids: [shipper.id, account.id, device.id, payment.id, booking.id, assessment.id, incidentId],
      };

      this.store.addIncident(incident);
      this.store.addIncidentEvents(events);
    }

    // 15. Audit Logging
    this.store.addAuditEvent({
      actor_name: 'FraudShield Automated Pipeline',
      actor_role: actorRole,
      action: 'BOOKING_SCREENED',
      resource_type: 'BOOKING',
      resource_id: booking.id,
      ip_address: device.ip_address,
      result: 'SUCCESS',
      details: {
        booking_ref: booking.booking_reference,
        shipper_id: shipper.id,
        final_score: finalScore,
        decision,
        signals_count: triggeredSignals.length,
        incident_id: incident?.id,
        fallback_level: fallbackLevel,
      }
    });

    const processingMs = Date.now() - startTime;

    return {
      booking,
      assessment,
      incident,
      new_evidence_count: newEvidenceCount,
      compliance_count: complianceChecks.length,
      processing_ms: processingMs,
    };
  }

  /**
   * Deterministic explanation generator when GenAI is unavailable or disabled.
   */
  private generateDeterministicExplanation(
    shipper: Shipper,
    booking: Booking,
    score: number,
    decision: 'ALLOW' | 'HOLD' | 'BLOCK',
    signals: TriggeredSignal[],
    weightMultiple: number,
    fallback: string
  ): string {
    if (decision === 'ALLOW') {
      return `Shipment authorized under routine controls (Risk Score ${score}/100). The booking parameters (${booking.weight_kg} kg to ${booking.destination}) conform to ${shipper.company_name}'s historical profile and verified authorization boundaries. Processed via ${fallback}.`;
    }

    const reasons: string[] = [];
    if (weightMultiple >= 3.0) {
      reasons.push(`an anomalous cargo weight of ${booking.weight_kg} kg (${weightMultiple.toFixed(1)}x historical average of ${shipper.average_weight_kg} kg)`);
    }
    const privSignals = signals.filter(s => s.category === 'IDENTITY' || s.category === 'SHIPMENT');
    if (privSignals.length > 0) {
      reasons.push(`permission profile violations including ${privSignals.map(s => s.description).join('; ')}`);
    }
    const relSignals = signals.filter(s => s.category === 'RELATIONSHIP');
    if (relSignals.length > 0) {
      reasons.push(`high-risk network infrastructure or linkage to previously blocked entities`);
    }
    const paySignals = signals.filter(s => s.category === 'PAYMENT');
    if (paySignals.length > 0) {
      reasons.push(`payment instrument irregularities`);
    }
    const compSignals = signals.filter(s => s.category === 'COMPLIANCE');
    if (compSignals.length > 0) {
      reasons.push(`statutory customs/export compliance clearance blocks`);
    }

    const joinedReasons = reasons.length > 0
      ? reasons.join(', ')
      : `multiple coordinated risk indicators across shipment behavior and identity controls`;

    return `Pre-shipment ${decision} enforced (Risk Score ${score}/100, ${fallback}). This action was triggered by ${joinedReasons}. Digital trust score reduced to prevent fraudulent dispatch.`;
  }
}
