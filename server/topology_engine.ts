import { DatabaseStore } from './store';
import { TopologyEdge, TopologyNode } from './types';

export class TopologyEngine {
  private store: DatabaseStore;

  constructor() {
    this.store = DatabaseStore.getInstance();
  }

  /**
   * Builds the entire global topology graph or a scoped subgraph for a specific incident/booking.
   */
  public buildTopology(incidentId?: string, bookingId?: string): { nodes: TopologyNode[]; edges: TopologyEdge[] } {
    const nodes: TopologyNode[] = [];
    const edges: TopologyEdge[] = [];
    const addedNodeIds = new Set<string>();

    const addNode = (node: TopologyNode) => {
      if (!addedNodeIds.has(node.id)) {
        nodes.push(node);
        addedNodeIds.add(node.id);
      }
    };

    const addEdge = (edge: TopologyEdge) => {
      edges.push(edge);
    };

    // Filter target bookings
    let relevantBookings = this.store.getBookings();
    if (bookingId) {
      relevantBookings = relevantBookings.filter(b => b.id === bookingId);
    } else if (incidentId) {
      const inc = this.store.getIncidentById(incidentId);
      if (inc) {
        relevantBookings = relevantBookings.filter(b => b.id === inc.booking_id);
      }
    } else {
      // Limit to latest 10 bookings for clean global display
      relevantBookings = relevantBookings.slice(0, 10);
    }

    const relevantShipperIds = new Set(relevantBookings.map(b => b.shipper_id));
    const relevantAccountIds = new Set(relevantBookings.map(b => b.account_id));
    const relevantDeviceIds = new Set(relevantBookings.map(b => b.device_id));
    const relevantPaymentIds = new Set(relevantBookings.map(b => b.payment_id));

    // 1. Shippers
    for (const shp of this.store.getShippers()) {
      if (relevantShipperIds.has(shp.id) || !incidentId) {
        addNode({
          id: shp.id,
          label: shp.company_name,
          type: 'SHIPPER',
          status: shp.status === 'BLOCKED' ? 'BLOCKED' : (shp.status === 'FLAGGED' ? 'FLAGGED' : 'NORMAL'),
          risk_contribution: 100 - shp.trust_score,
          metadata: {
            country: shp.country,
            trust_score: shp.trust_score,
            verified: shp.verified_identity,
            total_bookings: shp.total_bookings,
            avg_weight_kg: shp.average_weight_kg,
            incidents: shp.historical_incidents_count,
          }
        });
      }
    }

    // 2. Accounts & Ownership Edges
    for (const acc of this.store.getAccounts()) {
      if (relevantAccountIds.has(acc.id) || !incidentId) {
        addNode({
          id: acc.id,
          label: `Account: ${acc.account_number}`,
          type: 'ACCOUNT',
          status: acc.status === 'BLOCKED' ? 'BLOCKED' : (acc.is_cold_start ? 'FLAGGED' : 'NORMAL'),
          risk_contribution: acc.status === 'BLOCKED' ? 90 : (acc.is_cold_start ? 30 : 5),
          metadata: {
            tier: acc.tier,
            cold_start: acc.is_cold_start,
            credit_limit: acc.credit_limit,
          }
        });

        if (addedNodeIds.has(acc.shipper_id)) {
          addEdge({
            id: `edge-${acc.shipper_id}-${acc.id}`,
            source: acc.shipper_id,
            target: acc.id,
            relationship: 'OWNS',
            is_suspicious: acc.status === 'BLOCKED',
          });
        }
      }
    }

    // 3. Devices & Network ASN
    for (const dev of this.store.getDevices()) {
      if (relevantDeviceIds.has(dev.id) || !incidentId) {
        addNode({
          id: dev.id,
          label: `Device: ${dev.id} (${dev.ip_address})`,
          type: 'DEVICE',
          status: dev.is_flagged_suspicious ? 'SUSPICIOUS' : 'NORMAL',
          risk_contribution: dev.is_flagged_suspicious ? 75 : 10,
          metadata: {
            ip: dev.ip_address,
            asn: dev.network_asn,
            fingerprint: dev.device_fingerprint,
            previously_blocked_link: dev.previously_blocked_link,
          }
        });

        for (const accId of dev.associated_accounts) {
          if (addedNodeIds.has(accId)) {
            addEdge({
              id: `edge-${accId}-${dev.id}`,
              source: accId,
              target: dev.id,
              relationship: 'LOGGED_IN_FROM',
              is_suspicious: dev.is_flagged_suspicious,
            });
          }
        }
      }
    }

    // 4. Payment Methods
    for (const pm of this.store.getPaymentMethods()) {
      if (relevantPaymentIds.has(pm.id) || !incidentId) {
        addNode({
          id: pm.id,
          label: `Payment: ${pm.masked_number} (${pm.payment_type})`,
          type: 'PAYMENT',
          status: pm.risk_flag ? 'SUSPICIOUS' : 'NORMAL',
          risk_contribution: pm.risk_flag ? 80 : 5,
          metadata: {
            holder: pm.card_holder,
            country: pm.billing_country,
            verified: pm.is_verified,
            failures: pm.failure_count,
          }
        });

        if (addedNodeIds.has(pm.account_id)) {
          addEdge({
            id: `edge-${pm.account_id}-${pm.id}`,
            source: pm.account_id,
            target: pm.id,
            relationship: 'PAID_WITH',
            is_suspicious: pm.risk_flag,
          });
        }
      }
    }

    // 5. Bookings, Origins, Destinations, Services, Risk Nodes
    for (const bkg of relevantBookings) {
      addNode({
        id: bkg.id,
        label: `Booking: ${bkg.booking_reference} (${bkg.weight_kg}kg)`,
        type: 'BOOKING',
        status: bkg.status === 'BLOCKED' ? 'BLOCKED' : (bkg.status === 'HELD' ? 'SUSPICIOUS' : 'NORMAL'),
        risk_contribution: bkg.status === 'BLOCKED' ? 90 : (bkg.status === 'HELD' ? 50 : 10),
        metadata: {
          reference: bkg.booking_reference,
          weight_kg: bkg.weight_kg,
          origin: bkg.origin,
          destination: bkg.destination,
          service_type: bkg.service_type,
          declared_value: bkg.declared_value_usd,
        }
      });

      // Link Account -> Booking
      if (addedNodeIds.has(bkg.account_id)) {
        addEdge({
          id: `edge-${bkg.account_id}-${bkg.id}`,
          source: bkg.account_id,
          target: bkg.id,
          relationship: 'CREATED',
          is_suspicious: bkg.status === 'BLOCKED',
        });
      }

      // Link Device -> Booking
      if (addedNodeIds.has(bkg.device_id)) {
        addEdge({
          id: `edge-${bkg.device_id}-${bkg.id}`,
          source: bkg.device_id,
          target: bkg.id,
          relationship: 'USES',
          is_suspicious: bkg.status === 'BLOCKED',
        });
      }

      // Link Payment -> Booking
      if (addedNodeIds.has(bkg.payment_id)) {
        addEdge({
          id: `edge-${bkg.payment_id}-${bkg.id}`,
          source: bkg.payment_id,
          target: bkg.id,
          relationship: 'PAID_WITH',
          is_suspicious: bkg.status === 'BLOCKED',
        });
      }

      // Destination Node
      const destNodeId = `DEST-${bkg.destination.replace(/[^a-zA-Z0-9]/g, '_')}`;
      addNode({
        id: destNodeId,
        label: `Dest: ${bkg.destination}`,
        type: 'DESTINATION',
        status: bkg.destination.includes('International') || bkg.destination.startsWith('DE-') ? 'FLAGGED' : 'NORMAL',
        metadata: { destination: bkg.destination }
      });
      addEdge({
        id: `edge-${bkg.id}-${destNodeId}`,
        source: bkg.id,
        target: destNodeId,
        relationship: 'SHIPPED_TO',
        is_suspicious: bkg.status === 'BLOCKED',
      });

      // Risk Assessment Node
      const assessment = this.store.getRiskAssessmentByBookingId(bkg.id);
      if (assessment) {
        addNode({
          id: assessment.id,
          label: `Risk Engine: ${assessment.final_score}/100 (${assessment.risk_level})`,
          type: 'FRAUD_ENGINE',
          status: assessment.decision === 'BLOCK' ? 'BLOCKED' : (assessment.decision === 'HOLD' ? 'SUSPICIOUS' : 'NORMAL'),
          risk_contribution: assessment.final_score,
          metadata: {
            final_score: assessment.final_score,
            decision: assessment.decision,
            ml_anomaly: assessment.ml_anomaly_score,
            fallback_level: assessment.fallback_level,
          }
        });
        addEdge({
          id: `edge-${bkg.id}-${assessment.id}`,
          source: bkg.id,
          target: assessment.id,
          relationship: 'EVALUATED_BY',
          is_suspicious: assessment.decision === 'BLOCK',
        });

        // Decision Node
        const decNodeId = `DEC-${assessment.decision}-${bkg.id}`;
        addNode({
          id: decNodeId,
          label: `Decision: ${assessment.decision}`,
          type: 'DECISION',
          status: assessment.decision === 'BLOCK' ? 'BLOCKED' : (assessment.decision === 'HOLD' ? 'SUSPICIOUS' : 'NORMAL'),
          risk_contribution: assessment.final_score,
        });
        addEdge({
          id: `edge-${assessment.id}-${decNodeId}`,
          source: assessment.id,
          target: decNodeId,
          relationship: 'RESULTED_IN',
          is_suspicious: assessment.decision === 'BLOCK',
        });
      }

      // Incident Node
      const inc = this.store.getIncidents().find(i => i.booking_id === bkg.id);
      if (inc) {
        addNode({
          id: inc.id,
          label: `Incident: ${inc.incident_number} (${inc.severity})`,
          type: 'INCIDENT',
          status: 'BLOCKED',
          risk_contribution: inc.risk_score,
          metadata: {
            incident_number: inc.incident_number,
            status: inc.status,
            assigned_to: inc.assigned_to,
            triggered_rules: inc.triggered_rules,
          }
        });
        addEdge({
          id: `edge-${bkg.id}-${inc.id}`,
          source: bkg.id,
          target: inc.id,
          relationship: 'TRIGGERED',
          is_suspicious: true,
        });

        // Evidence nodes
        const evidences = this.store.getEvidenceList(inc.id);
        for (const ev of evidences.slice(0, 3)) {
          addNode({
            id: ev.id,
            label: `Evidence: ${ev.source_event.substring(0, 22)}...`,
            type: 'EVIDENCE',
            status: ev.is_tampered ? 'SUSPICIOUS' : 'NORMAL',
            metadata: {
              source_event: ev.source_event,
              current_hash: ev.current_hash,
              tampered: ev.is_tampered,
            }
          });
          addEdge({
            id: `edge-${inc.id}-${ev.id}`,
            source: inc.id,
            target: ev.id,
            relationship: 'EVIDENCE_FOR',
            is_suspicious: ev.is_tampered,
          });
        }

        // Blockchain Anchor Node
        const anchor = this.store.getBlockchainAnchors(inc.id)[0];
        if (anchor) {
          addNode({
            id: anchor.id,
            label: `Blockchain Anchor (${anchor.network_mode}): Block #${anchor.block_number}`,
            type: 'BLOCKCHAIN',
            status: 'ANCHORED',
            metadata: {
              tx_id: anchor.anchor_tx_id,
              block_number: anchor.block_number,
              mode: anchor.network_mode,
            }
          });
          addEdge({
            id: `edge-${inc.id}-${anchor.id}`,
            source: inc.id,
            target: anchor.id,
            relationship: 'ANCHORED_BY',
          });
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Dynamically calculates and returns the attack path for a given incident.
   */
  public getAttackPath(incidentId: string): { path_node_ids: string[]; path_edge_ids: string[]; summary: string } {
    const incident = this.store.getIncidentById(incidentId);
    if (!incident) {
      return { path_node_ids: [], path_edge_ids: [], summary: 'Incident not found' };
    }

    const booking = this.store.getBookingById(incident.booking_id);
    if (!booking) {
      return { path_node_ids: [], path_edge_ids: [], summary: 'Booking not found' };
    }

    const assessment = this.store.getRiskAssessmentByBookingId(booking.id);
    const destNodeId = `DEST-${booking.destination.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const decNodeId = assessment ? `DEC-${assessment.decision}-${booking.id}` : '';

    const pathNodeIds: string[] = [
      booking.shipper_id,
      booking.account_id,
      booking.device_id,
      booking.payment_id,
      booking.id,
      destNodeId,
    ];

    if (assessment) {
      pathNodeIds.push(assessment.id);
      pathNodeIds.push(decNodeId);
    }
    pathNodeIds.push(incident.id);

    const pathEdgeIds: string[] = [
      `edge-${booking.shipper_id}-${booking.account_id}`,
      `edge-${booking.account_id}-${booking.device_id}`,
      `edge-${booking.account_id}-${booking.payment_id}`,
      `edge-${booking.account_id}-${booking.id}`,
      `edge-${booking.device_id}-${booking.id}`,
      `edge-${booking.payment_id}-${booking.id}`,
      `edge-${booking.id}-${destNodeId}`,
    ];

    if (assessment) {
      pathEdgeIds.push(`edge-${booking.id}-${assessment.id}`);
      pathEdgeIds.push(`edge-${assessment.id}-${decNodeId}`);
    }
    pathEdgeIds.push(`edge-${booking.id}-${incident.id}`);

    return {
      path_node_ids: pathNodeIds,
      path_edge_ids: pathEdgeIds,
      summary: `Dynamically reconstructed attack path: Account Access (${booking.account_id}) -> Device Terminal (${booking.device_id}) -> Injected Payment (${booking.payment_id}) -> High-risk Booking (${booking.id}) -> Destination Anomaly (${booking.destination}) -> Risk Assessment Engine -> Decision Quarantine (${incident.decision}) -> Forensic Incident (${incident.incident_number})`,
    };
  }
}
