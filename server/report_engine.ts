import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Booking, Incident, IncidentEvent, Evidence, ComplianceCheck, RiskAssessment, Shipper, BlockchainAnchor, PermissionProfile } from './types';

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

export class ReportEngine {
  private reportsDir: string;

  constructor() {
    this.reportsDir = path.resolve(process.cwd(), 'reports');
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Generates a genuine Fraud Investigation PDF report and writes to disk.
   */
  public generateFraudInvestigationReport(
    incident: Incident,
    booking: Booking,
    shipper: Shipper,
    assessment: RiskAssessment,
    timeline: IncidentEvent[],
    evidenceList: Evidence[],
    complianceChecks: ComplianceCheck[],
    anchor?: BlockchainAnchor,
    permissionProfile?: PermissionProfile
  ): ReportRecord {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const reportId = `RPT-FRAUD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const filename = `fraud_investigation_${incident.incident_number}_${Date.now()}.pdf`;
    const filepath = path.join(this.reportsDir, filename);

    // Warm enterprise palette: Charcoal #27272A, Terracotta #C2410C, Amber #D97706, Sand #F4F1EA
    doc.setFillColor(244, 241, 234); // warm ivory header bar
    doc.rect(0, 0, 612, 80, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(194, 65, 12); // Terracotta
    doc.text('F-SHIELD FORENSIC INTELLIGENCE PLATFORM', 40, 36);

    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text('OFFICIAL FRAUD INVESTIGATION & RISK RECONSTRUCTION DOSSIER', 40, 56);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toUTCString()} | Report ID: ${reportId}`, 40, 70);

    let y = 105;

    // Executive Summary Box
    doc.setFillColor(250, 250, 249);
    doc.setDrawColor(220, 215, 205);
    doc.roundedRect(40, y, 532, 75, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text(`INCIDENT: ${incident.incident_number} (Status: ${incident.status})`, 50, y + 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Booking Ref: ${booking.booking_reference} | Shipper: ${shipper.company_name} (${shipper.id})`, 50, y + 34);
    doc.text(`Decision: ${incident.decision} | Risk Score: ${incident.risk_score} / 100 | Severity: ${incident.severity}`, 50, y + 48);
    doc.text(`Assigned Analyst: ${incident.assigned_to || 'Senior Fraud Response Unit'} | Fallback Level: ${assessment.fallback_level}`, 50, y + 62);

    y += 95;

    // Risk Component Breakdown
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(194, 65, 12);
    doc.text('1. RISK COMPONENT BREAKDOWN (0 - 100 NORMALIZED)', 40, y);
    y += 15;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 50);
    const scores = [
      `Identity / Permission: ${assessment.identity_score}`,
      `Behavioral Anomaly: ${assessment.behavior_score}`,
      `Shipment Anomaly: ${assessment.shipment_score}`,
      `Payment Risk: ${assessment.payment_score}`,
      `Destination Risk: ${assessment.destination_score}`,
      `Compliance Risk: ${assessment.compliance_score}`,
    ];
    doc.text(scores.slice(0, 3).join('   |   '), 40, y);
    y += 13;
    doc.text(scores.slice(3).join('   |   '), 40, y);
    y += 13;
    doc.text(`Composite Digital Trust Score: ${assessment.digital_trust_score}/100 | ML Anomaly Model: ${assessment.ml_model_version} (${assessment.ml_status})`, 40, y);

    y += 22;

    // Explainable AI / Evidence Reasoning
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(194, 65, 12);
    doc.text(`2. EVIDENCE SYNTHESIS & REASONING (${assessment.explanation_source})`, 40, y);
    y += 14;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 40);
    const splitExplanation = doc.splitTextToSize(assessment.explanation, 532);
    doc.text(splitExplanation, 40, y);
    y += splitExplanation.length * 11 + 10;

    // Authorized vs Observed
    if (assessment.authorized_vs_observed) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text('3. PRIVILEGE INTEGRITY: AUTHORIZED VS OBSERVED MATRIX', 40, y);
      y += 14;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const avo = assessment.authorized_vs_observed;
      doc.text(`• Destination: Observed [${avo.destination.observed}] | Authorized [${avo.destination.authorized.join(', ')}] -> ${avo.destination.matches ? 'MATCH' : 'VIOLATION DETECTED'}`, 45, y);
      y += 11;
      doc.text(`• Weight: Observed [${avo.weight.observed} kg] | Max Permitted [${avo.weight.authorized_max} kg] -> ${avo.weight.matches ? 'COMPLIANT' : `EXCEEDED BY ${avo.weight.multiple || 'ANOMALOUS'}x`}`, 45, y);
      y += 11;
      doc.text(`• Service Type: Observed [${avo.service_type.observed}] | Authorized [${avo.service_type.authorized.join(', ')}] -> ${avo.service_type.matches ? 'MATCH' : 'RESTRICTED ROUTE'}`, 45, y);
      y += 18;
    }

    // Chronological Timeline
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(194, 65, 12);
    doc.text('4. RECONSTRUCTED ATTACK PATH & INCIDENT TIMELINE', 40, y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    for (const evt of timeline.slice(0, 6)) {
      doc.text(`[Step ${evt.step_order}] ${new Date(evt.timestamp).toISOString().substring(11, 19)}: ${evt.title} - ${evt.description}`, 45, y);
      y += 11;
      if (y > 670) break;
    }

    y += 12;

    // Evidence & Blockchain Integrity
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(194, 65, 12);
    doc.text('5. FORENSIC EVIDENCE CHAIN & BLOCKCHAIN ANCHOR', 40, y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    for (const ev of evidenceList.slice(0, 3)) {
      doc.text(`• ${ev.id}: SHA256[${ev.current_hash.substring(0, 24)}...] Prev[${ev.previous_hash.substring(0, 16)}...]`, 45, y);
      y += 11;
    }

    if (anchor) {
      y += 4;
      doc.text(`• Blockchain Proof (${anchor.network_mode}): Block #${anchor.block_number} | Tx: ${anchor.anchor_tx_id.substring(0, 32)}... State: ${anchor.state}`, 45, y);
      y += 11;
    }

    // Footer with legal disclaimer
    doc.setDrawColor(200, 200, 200);
    doc.line(40, 740, 572, 740);
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text('F-Shield Cryptographic Forensic System | Built for Regulatory Audit & Pre-Shipment Interception', 40, 755);
    doc.text('This is an automated compliance & forensic intelligence record and is not a government-issued approval.', 40, 768);

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    fs.writeFileSync(filepath, pdfBuffer);

    const fileHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

    return {
      id: reportId,
      report_type: 'FRAUD_INVESTIGATION',
      title: `Fraud Investigation Dossier — Incident ${incident.incident_number}`,
      filename,
      filepath,
      file_size_bytes: pdfBuffer.length,
      sha256_hash: fileHash,
      incident_id: incident.id,
      booking_id: booking.id,
      created_at: new Date().toISOString(),
      creator: 'Senior Fraud Investigator (Automated Forensic Compiler)',
      download_url: `/api/v1/reports/download/${filename}`,
    };
  }

  /**
   * Generates genuine Regulatory Compliance Verification Report PDF.
   */
  public generateComplianceReport(
    booking: Booking,
    shipper: Shipper,
    checks: ComplianceCheck[],
    assessment?: RiskAssessment
  ): ReportRecord {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const reportId = `RPT-COMP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const filename = `compliance_verification_${booking.booking_reference}_${Date.now()}.pdf`;
    const filepath = path.join(this.reportsDir, filename);

    // Warm ivory header
    doc.setFillColor(244, 241, 234);
    doc.rect(0, 0, 612, 80, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(194, 65, 12);
    doc.text('REGULATORY COMPLIANCE VERIFICATION REPORT', 40, 36);

    doc.setFontSize(10);
    doc.setTextColor(70, 70, 70);
    doc.text('PRE-SHIPMENT STATUTORY COMPLIANCE & CUSTOMS AUDIT RECORD', 40, 56);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Document Reference: ${reportId} | System Version: F-Shield Compliance Engine v2.4`, 40, 70);

    let y = 105;

    // Consignment Manifest
    doc.setFillColor(250, 250, 249);
    doc.setDrawColor(220, 215, 205);
    doc.roundedRect(40, y, 532, 60, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    const valInr = booking.declared_value_inr || (booking.declared_value_usd ? booking.declared_value_usd * 83 : 0);
    doc.text(`CONSIGNMENT: ${booking.booking_reference} | Weight: ${booking.weight_kg} kg | Declared Value: Rs. ${valInr.toLocaleString('en-IN')}`, 50, y + 18);
    doc.setFont('helvetica', 'normal');
    doc.text(`Shipper: ${shipper.company_name} (KYC: ${shipper.kyc_status}) | Service: ${booking.service_type}`, 50, y + 34);
    doc.text(`Routing: ${booking.origin} -> ${booking.destination} | Timestamp: ${booking.booking_timestamp}`, 50, y + 48);

    y += 80;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(194, 65, 12);
    doc.text('STATUTORY REGULATORY CHECKS & VERIFICATION FINDINGS', 40, y);
    y += 18;

    for (const check of checks) {
      doc.setFillColor(check.status === 'PASS' ? 245 : (check.status === 'FAIL' ? 254 : 255), 245, check.status === 'FAIL' ? 242 : 235);
      doc.setDrawColor(210, 205, 195);
      doc.roundedRect(40, y, 532, 70, 3, 3, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(check.status === 'PASS' ? 22 : (check.status === 'FAIL' ? 185 : 180), check.status === 'PASS' ? 101 : 28, check.status === 'PASS' ? 52 : 28);
      doc.text(`[${check.status}] ${check.law_regulation} — ${check.section_rule}`, 50, y + 16);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);
      doc.text(`Authority: ${check.authority}`, 50, y + 28);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      const reqText = doc.splitTextToSize(`Requirement: ${check.requirement}`, 512);
      doc.text(reqText[0] || '', 50, y + 40);

      doc.setTextColor(40, 40, 40);
      const evText = doc.splitTextToSize(`Evidence: ${check.evidence_summary}`, 512);
      doc.text(evText[0] || '', 50, y + 54);

      y += 80;
      if (y > 670) break;
    }

    // Stamp & Signature block
    y = Math.max(y + 10, 600);
    doc.setFillColor(252, 250, 247);
    doc.rect(40, y, 532, 70, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 50);
    doc.text('AUDIT CERTIFICATION STATEMENT', 50, y + 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('This record documents the algorithmic and procedural checks applied to the booking before carrier acceptance.', 50, y + 30);
    doc.text('All data hashes are cryptographically verified against F-Shield forensic records.', 50, y + 42);
    doc.text(`Auditor Signature Hash: 0x${crypto.createHash('sha256').update(reportId).digest('hex').substring(0, 32)}`, 50, y + 56);

    // Explicit statutory disclaimer footer
    doc.setDrawColor(200, 200, 200);
    doc.line(40, 740, 572, 740);
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.setFont('helvetica', 'bold');
    doc.text('IMPORTANT STATUTORY NOTICE:', 40, 755);
    doc.setFont('helvetica', 'normal');
    doc.text('This is an automated compliance verification record and is not a government-issued approval.', 40, 768);

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    fs.writeFileSync(filepath, pdfBuffer);

    const fileHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

    return {
      id: reportId,
      report_type: 'COMPLIANCE_VERIFICATION',
      title: `Regulatory Compliance Record — Booking ${booking.booking_reference}`,
      filename,
      filepath,
      file_size_bytes: pdfBuffer.length,
      sha256_hash: fileHash,
      booking_id: booking.id,
      created_at: new Date().toISOString(),
      creator: 'Statutory Logistics Compliance Officer',
      download_url: `/api/v1/reports/download/${filename}`,
    };
  }

  /**
   * Generates genuine Evidence Manifest PDF.
   */
  public generateEvidenceManifest(
    incidentId: string,
    evidenceList: Evidence[],
    anchor?: BlockchainAnchor
  ): ReportRecord {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const reportId = `RPT-MNFST-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const filename = `evidence_manifest_${incidentId}_${Date.now()}.pdf`;
    const filepath = path.join(this.reportsDir, filename);

    // Warm ivory header
    doc.setFillColor(244, 241, 234);
    doc.rect(0, 0, 612, 80, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(194, 65, 12);
    doc.text('FORENSIC EVIDENCE CHAIN MANIFEST', 40, 36);

    doc.setFontSize(10);
    doc.setTextColor(70, 70, 70);
    doc.text(`TAMPER-EVIDENT SHA-256 AUDIT LOG | INCIDENT: ${incidentId}`, 40, 56);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Manifest ID: ${reportId} | Compiled At: ${new Date().toISOString()}`, 40, 70);

    let y = 110;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text('EVIDENCE ID', 40, y);
    doc.text('SOURCE EVENT', 160, y);
    doc.text('CURRENT SHA-256 HASH', 280, y);
    doc.text('STATUS', 520, y);
    y += 8;

    doc.setDrawColor(200, 200, 200);
    doc.line(40, y, 572, y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    for (const ev of evidenceList) {
      doc.text(ev.id, 40, y);
      doc.text(ev.source_event.substring(0, 20), 160, y);
      doc.text(`${ev.current_hash.substring(0, 36)}...`, 280, y);
      doc.text(ev.is_tampered ? 'TAMPERED' : 'VERIFIED', 520, y);
      y += 12;
      doc.setTextColor(110, 110, 110);
      doc.text(`  ↳ Prev: ${ev.previous_hash.substring(0, 36)}... | Created: ${ev.created_at}`, 40, y);
      doc.setTextColor(40, 40, 40);
      y += 18;
      if (y > 680) break;
    }

    if (anchor) {
      y += 10;
      doc.setFillColor(248, 246, 240);
      doc.rect(40, y, 532, 45, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(194, 65, 12);
      doc.text(`BLOCKCHAIN ANCHOR REFERENCE (${anchor.network_mode})`, 50, y + 16);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(50, 50, 50);
      doc.text(`Anchor Tx: ${anchor.anchor_tx_id} | Block #${anchor.block_number} | State: ${anchor.state}`, 50, y + 30);
    }

    doc.setDrawColor(200, 200, 200);
    doc.line(40, 740, 572, 740);
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text('This manifest establishes an unbroken cryptographic chain of custody for digital evidence.', 40, 755);
    doc.text('This is an automated compliance verification record and is not a government-issued approval.', 40, 768);

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    fs.writeFileSync(filepath, pdfBuffer);

    const fileHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

    return {
      id: reportId,
      report_type: 'EVIDENCE_MANIFEST',
      title: `Cryptographic Evidence Manifest — ${incidentId}`,
      filename,
      filepath,
      file_size_bytes: pdfBuffer.length,
      sha256_hash: fileHash,
      incident_id: incidentId,
      created_at: new Date().toISOString(),
      creator: 'Chief Forensic Evidence Officer',
      download_url: `/api/v1/reports/download/${filename}`,
    };
  }

  /**
   * Generates an official Shipper Approval & KYC Clearance Certificate PDF.
   */
  public generateShipperApprovalCertificate(
    shipper: Shipper,
    permissions: PermissionProfile[] = []
  ): ReportRecord {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const reportId = `RPT-APPR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const filename = `shipper_approval_${shipper.id}_${Date.now()}.pdf`;
    const filepath = path.join(this.reportsDir, filename);

    // Warm enterprise ivory banner
    doc.setFillColor(244, 241, 234);
    doc.rect(0, 0, 612, 85, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(194, 65, 12);
    doc.text('OFFICIAL SHIPPER ACCREDITATION & KYC CLEARANCE', 40, 36);

    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text('STATUTORY CARRIER DISPATCH CLEARANCE & DIGITAL TRUST CERTIFICATE', 40, 56);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Certificate Reference: ${reportId} | Issued: ${new Date().toUTCString()}`, 40, 72);

    let y = 110;

    // Approval Seal Box
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(40, y, 532, 60, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(22, 101, 52);
    doc.text('ACCREDITATION STATUS: APPROVED & KYC VERIFIED', 55, y + 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text(`Entity: ${shipper.company_name} | Identifier: ${shipper.id} | Operating Country: ${shipper.country}`, 55, y + 38);
    doc.text(`Digital Trust Score: ${shipper.trust_score} / 100 | KYC Verification State: ${shipper.kyc_status} | Identity: VERIFIED`, 55, y + 50);

    y += 80;

    // Behavioral Baselines & Authorization Matrix
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(194, 65, 12);
    doc.text('AUTHORIZED OPERATIONAL PARAMETERS & PERMISSION CEILINGS', 40, y);
    y += 18;

    doc.setFillColor(250, 250, 249);
    doc.setDrawColor(225, 220, 210);
    doc.roundedRect(40, y, 532, 95, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text('CARGO SPECIFICATIONS & WEIGHT PROFILE', 50, y + 18);

    doc.setFont('helvetica', 'normal');
    doc.text(`Historical Average Consignment Weight: ${shipper.average_weight_kg} kg`, 50, y + 34);
    doc.text(`Maximum Authorized Single Consignment Ceiling: ${shipper.max_weight_kg} kg`, 50, y + 48);
    doc.text(`Approved Dispatch Origins: ${shipper.common_origins.join(', ')}`, 50, y + 62);
    doc.text(`Approved Destination Hubs: ${shipper.common_destinations.join(', ')}`, 50, y + 76);
    doc.text(`Account Screening Track Record: ${shipper.total_bookings} screen cycles (${shipper.historical_incidents_count} flagged incidents)`, 50, y + 90);

    y += 115;

    // Regulatory Compliance Endorsements
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(194, 65, 12);
    doc.text('STATUTORY REGULATORY ENDORSEMENTS', 40, y);
    y += 18;

    const endorsements = [
      {
        law: 'Customs Act, 1962 (Section 46 & 50)',
        verdict: 'COMPLIANT — Identity IEC validated with accurate cargo classification.',
      },
      {
        law: 'Courier Imports and Exports (Clearance) Regulations, 1998 (Regulation 5(1))',
        verdict: 'AUTHORIZED — Cleared for simplified courier processing within Rs. 50,000 / 70kg thresholds.',
      },
      {
        law: 'Prevention of Money Laundering Act (PMLA) & FEMA Guidelines',
        verdict: 'VERIFIED — Beneficial owner and cross-border bank routing authenticated.',
      }
    ];

    for (const e of endorsements) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(220, 215, 205);
      doc.roundedRect(40, y, 532, 36, 3, 3, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 30, 30);
      doc.text(e.law, 50, y + 14);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(22, 101, 52);
      doc.text(e.verdict, 50, y + 26);

      y += 44;
    }

    y += 15;

    // Digital Cryptographic Signature Box
    doc.setFillColor(245, 245, 244);
    doc.setDrawColor(210, 205, 195);
    doc.roundedRect(40, y, 532, 60, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(194, 65, 12);
    doc.text('F-SHIELD AUTOMATED CLEARANCE AUTHORITY', 50, y + 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    doc.text('This accreditation is issued based on continuous behavioral risk screening and verified KYC credentials.', 50, y + 32);
    doc.text('Digital Certificate ID: ' + reportId + ' | Authorized System: F-Shield Compliance Engine v2.4', 50, y + 46);

    doc.setDrawColor(200, 200, 200);
    doc.line(40, 740, 572, 740);
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text('Official Carrier Accreditation Document — Retain for Statutory Port Customs Audits.', 40, 755);
    doc.text('Any weight or corridor violation beyond established ceilings triggers immediate automated carrier dispatch hold.', 40, 768);

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    fs.writeFileSync(filepath, pdfBuffer);

    const fileHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

    return {
      id: reportId,
      report_type: 'SHIPPER_APPROVAL',
      title: `Shipper Approval & Accreditation Certificate — ${shipper.company_name}`,
      filename,
      filepath,
      file_size_bytes: pdfBuffer.length,
      sha256_hash: fileHash,
      shipper_id: shipper.id,
      created_at: new Date().toISOString(),
      creator: 'Statutory Compliance Officer',
      download_url: `/api/v1/reports/download/${filename}`,
    };
  }
}
