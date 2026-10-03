import crypto from 'crypto';
import { Evidence } from './types';

export class EvidenceEngine {
  /**
   * Computes SHA-256 hash of previous hash and canonical content data.
   */
  public static computeHash(previousHash: string, contentData: Record<string, any>): string {
    const canonicalContent = JSON.stringify(contentData, Object.keys(contentData).sort());
    const payload = `${previousHash}:${canonicalContent}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Seals a new piece of evidence into the tamper-evident chain.
   */
  public static sealEvidence(
    incidentId: string,
    bookingId: string | undefined,
    sourceEvent: string,
    sourceSystem: string,
    creator: string,
    contentData: Record<string, any>,
    lastEvidenceInChain?: Evidence
  ): Evidence {
    const previousHash = lastEvidenceInChain
      ? lastEvidenceInChain.current_hash
      : '0000000000000000000000000000000000000000000000000000000000000000'; // Genesis anchor
    
    const currentHash = this.computeHash(previousHash, contentData);
    const id = `EVD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    return {
      id,
      incident_id: incidentId,
      booking_id: bookingId,
      source_event: sourceEvent,
      source_system: sourceSystem,
      created_at: new Date().toISOString(),
      creator,
      content_data: contentData,
      previous_hash: previousHash,
      current_hash: currentHash,
      is_tampered: false,
    };
  }

  /**
   * Verifies the SHA-256 integrity of an individual evidence item and optionally against its predecessor.
   */
  public static verifyEvidence(
    evidence: Evidence,
    expectedPreviousHash?: string
  ): {
    status: 'HASH_MATCH' | 'HASH_MISMATCH';
    computed_hash: string;
    stored_hash: string;
    previous_hash: string;
    previous_hash_match: boolean;
    tamper_detected: boolean;
    verification_timestamp: string;
    details: string;
  } {
    const computedHash = this.computeHash(evidence.previous_hash, evidence.content_data);
    const hashMatch = computedHash === evidence.current_hash && !evidence.is_tampered;
    const prevMatch = expectedPreviousHash ? evidence.previous_hash === expectedPreviousHash : true;
    const tamperDetected = !hashMatch || !prevMatch;

    return {
      status: hashMatch && prevMatch ? 'HASH_MATCH' : 'HASH_MISMATCH',
      computed_hash: computedHash,
      stored_hash: evidence.current_hash,
      previous_hash: evidence.previous_hash,
      previous_hash_match: prevMatch,
      tamper_detected: tamperDetected,
      verification_timestamp: new Date().toISOString(),
      details: tamperDetected
        ? `Cryptographic mismatch detected: Recomputed SHA-256 (${computedHash.substring(0, 12)}...) differs from sealed record (${evidence.current_hash.substring(0, 12)}...). Forensic integrity alert!`
        : `Cryptographic SHA-256 integrity verified. Evidence payload exactly matches sealed state with previous chain anchor.`,
    };
  }
}
