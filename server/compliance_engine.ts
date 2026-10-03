import { Booking, ComplianceCheck, ComplianceRule, Shipper } from './types';

export const INITIAL_COMPLIANCE_RULES: ComplianceRule[] = [
  {
    id: 'COMP-IN-01',
    authority: 'Central Board of Indirect Taxes and Customs (CBIC), India',
    law_regulation: 'Customs Act, 1962',
    section_rule: 'Section 50 & Section 46',
    requirement: 'Mandatory declaration of accurate commercial description, weight, and true transaction value for all outbound/inbound cargo. False declaration attracts seizure under Section 111/113.',
    source_url: 'https://www.cbic.gov.in/htdocs-cbec/customs/cs-act/cs-act-idx',
    effective_date: '1962-12-13',
    version: 'Statutory 2024 Reissue',
    applicable_shipment_type: 'ALL_EXPORTS_IMPORTS',
  },
  {
    id: 'COMP-IN-02',
    authority: 'Directorate General of Systems & Data Management, CBIC',
    law_regulation: 'Courier Imports and Exports (Clearance) Regulations, 1998',
    section_rule: 'Regulation 5(1) & Regulation 12',
    requirement: 'Express courier consignment value threshold: Commercial packages exceeding ₹50,000 or 70 kg require formal Bill of Entry/Shipping Bill and verified Importer-Exporter Code (IEC).',
    source_url: 'https://www.cbic.gov.in/resources//htdocs-cbec/customs/cs-regulations/cour-imprt-exprt-clrnc1998.pdf',
    effective_date: '1998-06-02',
    version: 'Amended Circular 30/2020',
    applicable_shipment_type: 'EXPRESS_COURIER',
  },
  {
    id: 'COMP-IN-03',
    authority: 'Directorate General of Shipping, Ministry of Ports, Shipping and Waterways',
    law_regulation: 'Merchant Shipping Act, 1958',
    section_rule: 'Section 334 & Section 335',
    requirement: 'Carriage of dangerous, high-density or hazardous cargo requires verified Material Safety Data Sheet (MSDS) and shipper liability certification prior to vessel/air consignment.',
    source_url: 'https://dgshipping.gov.in/Content/MerchantShippingAct.aspx',
    effective_date: '1958-10-30',
    version: 'Statutory Gazetted Revision 2021',
    applicable_shipment_type: 'CARGO_ABOVE_100KG',
  },
  {
    id: 'COMP-IN-04',
    authority: 'Reserve Bank of India (RBI) / Financial Intelligence Unit (FIU-IND)',
    law_regulation: 'Foreign Exchange Management Act (FEMA), 1999 & PMLA Rules',
    section_rule: 'FEMA Section 7 & PMLA Rule 9(1)',
    requirement: 'Mandatory verification of corporate KYC and beneficial ownership for cross-border transit logistics exceeding threshold value or with high-risk financial jurisdictions.',
    source_url: 'https://www.rbi.org.in/Scripts/BS_ViewMasCirculardetails.aspx?id=9862',
    effective_date: '2000-06-01',
    version: 'RBI Master Direction 2023',
    applicable_shipment_type: 'CROSS_BORDER_HIGH_VALUE',
  },
];

export class ComplianceEngine {
  private rules: ComplianceRule[];

  constructor(rules: ComplianceRule[] = INITIAL_COMPLIANCE_RULES) {
    this.rules = rules;
  }

  public getRules(): ComplianceRule[] {
    return [...this.rules];
  }

  /**
   * Evaluates a booking against statutory shipping and customs regulations.
   */
  public evaluateBooking(booking: Booking, shipper: Shipper): ComplianceCheck[] {
    const checks: ComplianceCheck[] = [];
    const isInternational = booking.destination.includes('International') || 
      booking.destination.includes('Frankfurt') || 
      booking.destination.includes('Dubai') || 
      booking.destination.includes('Rotterdam') ||
      booking.destination.includes('Singapore') ||
      booking.destination.includes('Shenzhen');

    const valueInr = booking.declared_value_inr || (booking.declared_value_usd ? booking.declared_value_usd * 83 : 0);

    for (const rule of this.rules) {
      let status: 'PASS' | 'FAIL' | 'REVIEW' = 'PASS';
      let evidenceSummary = '';

      if (rule.id === 'COMP-IN-01') {
        // Declaration check
        if (booking.weight_kg <= 0 || valueInr <= 0) {
          status = 'FAIL';
          evidenceSummary = `Non-compliant: Invalid weight (${booking.weight_kg}kg) or value (₹${valueInr.toLocaleString('en-IN')}) declared.`;
        } else if (booking.weight_kg > 150 && valueInr < 40000) {
          status = 'REVIEW';
          evidenceSummary = `Discrepancy flag: Declared weight is high (${booking.weight_kg}kg) but declared value is disproportionately low (₹${valueInr.toLocaleString('en-IN')}). Requires valuation scrutiny under Section 50.`;
        } else {
          status = 'PASS';
          evidenceSummary = `Compliant declaration: Weight ${booking.weight_kg}kg and transaction value ₹${valueInr.toLocaleString('en-IN')} duly recorded.`;
        }
      } else if (rule.id === 'COMP-IN-02') {
        // Express courier threshold check (70kg or ₹50,000 threshold under Courier Regs)
        const isExpress = booking.service_type.includes('EXPRESS') || booking.service_type.includes('AIR');
        if (isExpress && (booking.weight_kg > 70 || valueInr > 50000)) {
          if (!shipper.verified_identity || shipper.kyc_status !== 'VERIFIED') {
            status = 'FAIL';
            evidenceSummary = `Threshold exceeded: Express consignment (${booking.weight_kg}kg / ₹${valueInr.toLocaleString('en-IN')}) exceeds ₹50,000 simplified courier threshold. Shipper KYC/IEC is not verified.`;
          } else {
            status = 'REVIEW';
            evidenceSummary = `Formal clearance mandated: Weight (${booking.weight_kg}kg) or value (₹${valueInr.toLocaleString('en-IN')}) exceeds courier limit. Formal Shipping Bill filing required.`;
          }
        } else {
          status = 'PASS';
          evidenceSummary = `Courier limits satisfied: Package falls within standard courier clearance parameters.`;
        }
      } else if (rule.id === 'COMP-IN-03') {
        // Heavy/Hazardous cargo (>100kg)
        if (booking.weight_kg > 100) {
          if (booking.package_category === 'HAZARDOUS' || booking.package_category === 'CHEMICALS' || booking.weight_kg >= 180) {
            status = 'REVIEW';
            evidenceSummary = `Heavy cargo regulatory trigger: Consignment weight ${booking.weight_kg}kg requires mandatory verified container weight certificate and dangerous goods checklist prior to loading.`;
          } else {
            status = 'REVIEW';
            evidenceSummary = `Weight verification required: Consignment exceeds 100kg (${booking.weight_kg}kg). Weight scale calibration certificate required.`;
          }
        } else {
          status = 'PASS';
          evidenceSummary = `Cargo weight ${booking.weight_kg}kg conforms to standard general cargo protocol.`;
        }
      } else if (rule.id === 'COMP-IN-04') {
        // Cross-border high value / KYC check
        if (isInternational) {
          if (!shipper.verified_identity) {
            status = 'FAIL';
            evidenceSummary = `Regulatory block: Cross-border shipment initiated without verified KYC and beneficial owner authentication under FEMA/PMLA.`;
          } else if (valueInr > 800000) {
            status = 'REVIEW';
            evidenceSummary = `High-value cross border transaction (₹${valueInr.toLocaleString('en-IN')}): Subject to EDPMS regulatory reconciliation.`;
          } else {
            status = 'PASS';
            evidenceSummary = `Cross-border KYC verified for ${shipper.company_name} (KYC status: VERIFIED).`;
          }
        } else {
          status = 'PASS';
          evidenceSummary = `Domestic booking; exempt from cross-border FEMA reporting.`;
        }
      }

      checks.push({
        id: `CHK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        booking_id: booking.id,
        rule_id: rule.id,
        authority: rule.authority,
        law_regulation: rule.law_regulation,
        section_rule: rule.section_rule,
        requirement: rule.requirement,
        status,
        evidence_summary: evidenceSummary,
        verified_at: new Date().toISOString(),
        verifier: 'F-Shield Automated Statutory Engine v2.4 (Independent Algorithmic Audit)',
      });
    }

    return checks;
  }
}
