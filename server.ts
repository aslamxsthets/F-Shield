import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { DatabaseStore } from './server/store';
import { FraudEngine } from './server/fraud_engine';
import { TopologyEngine } from './server/topology_engine';
import { EvidenceEngine } from './server/evidence_engine';
import { getBlockchainAdapter } from './server/blockchain_adapter';
import { ComplianceEngine } from './server/compliance_engine';
import { ReportEngine } from './server/report_engine';
import { User, UserRole } from './server/types';

const JWT_SECRET = process.env.JWT_SECRET || 'fraudshield_jwt_secret_key_2026';
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

async function bootstrap() {
  const app = express();
  const server = createServer(app);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS and Security Headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  const store = DatabaseStore.getInstance();
  const fraudEngine = new FraudEngine();
  const topologyEngine = new TopologyEngine();
  const complianceEngine = new ComplianceEngine(store.getComplianceRules());
  const reportEngine = new ReportEngine();

  // WebSocket Server Setup
  const wss = new WebSocketServer({ server, path: '/ws/live' });
  const activeSockets = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    activeSockets.add(ws);
    // Send initial status
    ws.send(JSON.stringify({
      type: 'CONNECTION_READY',
      timestamp: new Date().toISOString(),
      client_count: activeSockets.size,
      settings: store.getSettings(),
    }));

    ws.on('close', () => {
      activeSockets.delete(ws);
    });

    ws.on('error', (err) => {
      console.warn('WebSocket client error:', err.message);
      activeSockets.delete(ws);
    });
  });

  function broadcastEvent(eventType: string, payload: any) {
    const message = JSON.stringify({
      type: eventType,
      timestamp: new Date().toISOString(),
      data: payload,
    });
    for (const client of activeSockets) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (e) {
          activeSockets.delete(client);
        }
      }
    }
  }

  // Authentication Middleware
  function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as User;
        (req as any).user = decoded;
        return next();
      } catch (err) {
        // Fallback to default user if invalid token
      }
    }
    // Default fallback to first active analyst user
    (req as any).user = store.getUsers()[1] || { id: 'USR-02', name: 'Marcus Sterling', role: 'FRAUD_ANALYST' };
    next();
  }

  // Role Checker
  function requireRole(allowedRoles: UserRole[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user as User;
      if (!user || (!allowedRoles.includes(user.role) && user.role !== 'ADMIN')) {
        return res.status(403).json({
          error: 'ACCESS_DENIED',
          message: `Role '${user?.role || 'NONE'}' does not have permission for this resource. Required: ${allowedRoles.join(', ')}`,
        });
      }
      next();
    };
  }

  // ==================== HEALTH & SYSTEM ROUTES ====================
  app.get('/health', (req, res) => {
    res.json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'FraudShield Core Engine',
      database: 'CONNECTED',
      ai_provider: process.env.GEMINI_API_KEY ? 'ONLINE' : 'FALLBACK_DETERMINISTIC',
      ml_engine: store.getSettings().features.ml_enabled ? 'ENABLED' : 'DISABLED',
      blockchain_mode: store.getSettings().features.blockchain_mode,
      version: store.getSettings().system_metadata.version,
    });
  });

  app.get('/ready', (req, res) => {
    res.json({ ready: true });
  });

  // ==================== AUTH ROUTES ====================
  app.post('/api/v1/auth/login', (req, res) => {
    const { email, role } = req.body;
    const users = store.getUsers();
    let user = users.find(u => u.email === email);
    if (!user && role) {
      user = users.find(u => u.role === role);
    }
    if (!user) {
      user = users[0]; // fallback to Admin
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    store.addAuditEvent({
      actor_name: user.name,
      actor_role: user.role,
      action: 'USER_LOGIN',
      resource_type: 'AUTH',
      resource_id: user.id,
      ip_address: req.ip || '127.0.0.1',
      result: 'SUCCESS',
      details: { role: user.role }
    });

    res.json({
      token,
      user: { ...user, token },
      message: 'Authentication successful',
    });
  });

  app.post('/api/v1/auth/logout', authMiddleware, (req, res) => {
    const user = (req as any).user;
    store.addAuditEvent({
      actor_name: user.name,
      actor_role: user.role,
      action: 'USER_LOGOUT',
      resource_type: 'AUTH',
      resource_id: user.id,
      ip_address: req.ip || '127.0.0.1',
      result: 'SUCCESS',
    });
    res.json({ message: 'Logged out successfully' });
  });

  app.get('/api/v1/auth/me', authMiddleware, (req, res) => {
    res.json({ user: (req as any).user });
  });

  // ==================== DASHBOARD METRICS ====================
  app.get('/api/v1/dashboard/metrics', authMiddleware, (req, res) => {
    const bookings = store.getBookings();
    const assessments = store.getRiskAssessments();
    const incidents = store.getIncidents();

    const totalScreened = bookings.length;
    const highRisk = assessments.filter(a => a.risk_level === 'HIGH').length;
    const blockedCount = assessments.filter(a => a.decision === 'BLOCK').length;
    const heldCount = assessments.filter(a => a.decision === 'HOLD').length;
    const allowedCount = assessments.filter(a => a.decision === 'ALLOW').length;
    const activeIncidents = incidents.filter(i => i.status === 'OPEN' || i.status === 'UNDER_REVIEW').length;

    // Calculate prevented fraud value (sum of declared value for BLOCKED bookings)
    const fraudPreventedValueInr = bookings
      .filter(b => b.status === 'BLOCKED')
      .reduce((sum, b) => sum + (b.declared_value_inr || (b.declared_value_usd ? b.declared_value_usd * 83 : 0)), 0);
    const fraudPreventedValueUsd = Math.round(fraudPreventedValueInr / 83);

    const avgRisk = assessments.length > 0
      ? Math.round(assessments.reduce((sum, a) => sum + a.final_score, 0) / assessments.length)
      : 0;

    // Decision distribution
    const decisionDistribution = [
      { decision: 'ALLOW', count: allowedCount, percentage: totalScreened ? Math.round((allowedCount / totalScreened) * 100) : 0 },
      { decision: 'HOLD', count: heldCount, percentage: totalScreened ? Math.round((heldCount / totalScreened) * 100) : 0 },
      { decision: 'BLOCK', count: blockedCount, percentage: totalScreened ? Math.round((blockedCount / totalScreened) * 100) : 0 },
    ];

    // Risk trend
    const riskTrend = assessments.slice(0, 10).reverse().map((a, idx) => ({
      time: `Consignment ${idx + 1}`,
      score: a.final_score,
      volume: 1,
    }));

    // Top suspicious destinations
    const destMap = new Map<string, { count: number; totalRisk: number }>();
    for (const b of bookings) {
      const a = assessments.find(x => x.booking_id === b.id);
      const risk = a ? a.final_score : 10;
      const cur = destMap.get(b.destination) || { count: 0, totalRisk: 0 };
      cur.count += 1;
      cur.totalRisk += risk;
      destMap.set(b.destination, cur);
    }
    const topSuspiciousDestinations = Array.from(destMap.entries())
      .map(([destination, data]) => ({
        destination,
        count: data.count,
        risk_avg: Math.round(data.totalRisk / data.count),
      }))
      .sort((a, b) => b.risk_avg - a.risk_avg)
      .slice(0, 5);

    // Top suspicious devices
    const topSuspiciousDevices = store.getDevices()
      .filter(d => d.is_flagged_suspicious || d.previously_blocked_link)
      .map(d => ({
        device_id: d.id,
        count: d.associated_accounts.length,
        flag: d.previously_blocked_link ? `Linked to ${d.previously_blocked_link}` : 'Suspicious Network / Tor',
      }));

    // Signal frequency aggregation
    const signalMap = new Map<string, { category: string; count: number }>();
    for (const a of assessments) {
      for (const sig of a.triggered_signals) {
        const cur = signalMap.get(sig.code) || { category: sig.category, count: 0 };
        cur.count += 1;
        signalMap.set(sig.code, cur);
      }
    }
    const signalFrequency = Array.from(signalMap.entries())
      .map(([signal, d]) => ({ signal, category: d.category, count: d.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    res.json({
      total_screened: totalScreened,
      high_risk_count: highRisk,
      blocked_count: blockedCount,
      held_count: heldCount,
      allowed_count: allowedCount,
      active_incidents: activeIncidents,
      fraud_prevented_value_inr: fraudPreventedValueInr,
      fraud_prevented_value_usd: fraudPreventedValueUsd,
      average_risk_score: avgRisk,
      risk_trend: riskTrend,
      decision_distribution: decisionDistribution,
      top_suspicious_destinations: topSuspiciousDestinations,
      top_suspicious_devices: topSuspiciousDevices,
      signal_frequency: signalFrequency,
      is_demo_data: true,
    });
  });

  // ==================== BOOKING SCREENING ====================
  app.post('/api/v1/bookings/screen', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user as User;
      const { shipper_id, account_id, payment_id, device_id, origin, destination, weight_kg, service_type, package_category, declared_value_inr, declared_value_usd } = req.body;

      if (!shipper_id || !account_id || !payment_id || !device_id || !origin || !destination || weight_kg === undefined) {
        return res.status(400).json({
          error: 'MISSING_REQUIRED_FIELDS',
          message: 'shipper_id, account_id, payment_id, device_id, origin, destination, and weight_kg are required.'
        });
      }

      const result = await fraudEngine.screenBooking({
        shipper_id,
        account_id,
        payment_id,
        device_id,
        origin,
        destination,
        weight_kg: parseFloat(weight_kg),
        service_type: service_type || 'STANDARD_GROUND',
        package_category: package_category || 'GENERAL_MERCHANDISE',
        declared_value_inr: declared_value_inr ? parseFloat(declared_value_inr) : undefined,
        declared_value_usd: declared_value_usd ? parseFloat(declared_value_usd) : undefined,
      }, user.role);

      // Real-time broadcast
      broadcastEvent('BOOKING_SCREENED', {
        booking: result.booking,
        assessment: result.assessment,
        incident: result.incident,
      });

      if (result.incident) {
        broadcastEvent('INCIDENT_CREATED', { incident: result.incident });
      }

      res.status(201).json(result);
    } catch (err: any) {
      console.error('Screening pipeline failed:', err);
      res.status(500).json({ error: 'SCREENING_FAILED', message: err.message });
    }
  });

  app.get('/api/v1/bookings', authMiddleware, (req, res) => {
    const bookings = store.getBookings();
    const enriched = bookings.map(b => ({
      ...b,
      assessment: store.getRiskAssessmentByBookingId(b.id),
      shipper: store.getShipperById(b.shipper_id),
    }));
    res.json(enriched);
  });

  app.get('/api/v1/bookings/:id', authMiddleware, (req, res) => {
    const booking = store.getBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'BOOKING_NOT_FOUND', message: `Booking ${req.params.id} does not exist.` });
    }
    const assessment = store.getRiskAssessmentByBookingId(booking.id);
    const shipper = store.getShipperById(booking.shipper_id);
    const incident = store.getIncidents().find(i => i.booking_id === booking.id);
    const compliance = store.getComplianceChecks(booking.id);

    res.json({
      booking,
      assessment,
      shipper,
      incident,
      compliance,
    });
  });

  // ==================== SHIPPERS ====================
  app.get('/api/v1/shippers', authMiddleware, (req, res) => {
    res.json(store.getShippers());
  });

  app.get('/api/v1/shippers/:id', authMiddleware, (req, res) => {
    const shipper = store.getShipperById(req.params.id);
    if (!shipper) {
      return res.status(404).json({ error: 'SHIPPER_NOT_FOUND', message: `Shipper ${req.params.id} does not exist.` });
    }
    const accounts = store.getAccounts().filter(a => a.shipper_id === shipper.id);
    const permissions = accounts.map(a => store.getPermissionProfileByAccountId(a.id)).filter(Boolean);
    const bookings = store.getBookings().filter(b => b.shipper_id === shipper.id);
    const payments = store.getPaymentMethods().filter(p => p.shipper_id === shipper.id);
    const history = store.getShipperHistory(shipper.id);

    res.json({
      shipper,
      accounts,
      permissions,
      payments,
      recent_bookings: bookings.slice(0, 10),
      history,
    });
  });

  app.get('/api/v1/shippers/:id/history', authMiddleware, (req, res) => {
    const shipper = store.getShipperById(req.params.id);
    if (!shipper) {
      return res.status(404).json({ error: 'SHIPPER_NOT_FOUND', message: `Shipper ${req.params.id} does not exist.` });
    }
    const history = store.getShipperHistory(shipper.id);
    res.json(history);
  });

  // ==================== INCIDENTS ====================
  app.get('/api/v1/incidents', authMiddleware, (req, res) => {
    const incidents = store.getIncidents();
    const enriched = incidents.map(inc => {
      const booking = store.getBookingById(inc.booking_id);
      const shipper = booking ? store.getShipperById(booking.shipper_id) : undefined;
      return {
        ...inc,
        booking,
        shipper,
      };
    });
    res.json(enriched);
  });

  app.get('/api/v1/incidents/:id', authMiddleware, (req, res) => {
    const incident = store.getIncidentById(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: 'INCIDENT_NOT_FOUND', message: `Incident ${req.params.id} not found.` });
    }
    const booking = store.getBookingById(incident.booking_id);
    const shipper = booking ? store.getShipperById(booking.shipper_id) : undefined;
    const assessment = booking ? store.getRiskAssessmentByBookingId(booking.id) : undefined;
    const timeline = store.getIncidentEvents(incident.id);
    const evidenceList = store.getEvidenceList(incident.id);
    const blockchainAnchor = store.getBlockchainAnchors(incident.id)[0];
    const complianceChecks = booking ? store.getComplianceChecks(booking.id) : [];
    const permission = booking ? store.getPermissionProfileByAccountId(booking.account_id) : undefined;
    const attackPath = topologyEngine.getAttackPath(incident.id);

    res.json({
      incident,
      booking,
      shipper,
      assessment,
      timeline,
      evidenceList,
      blockchainAnchor,
      complianceChecks,
      permission,
      attackPath,
    });
  });

  app.patch('/api/v1/incidents/:id', authMiddleware, (req, res) => {
    const user = (req as any).user as User;
    const { status, assigned_to, resolution_notes } = req.body;
    const updated = store.updateIncident(req.params.id, {
      status,
      assigned_to,
      resolution_notes,
    });

    if (!updated) {
      return res.status(404).json({ error: 'INCIDENT_NOT_FOUND' });
    }

    store.addAuditEvent({
      actor_name: user.name,
      actor_role: user.role,
      action: 'INCIDENT_MODIFIED',
      resource_type: 'INCIDENT',
      resource_id: updated.id,
      ip_address: req.ip || '127.0.0.1',
      result: 'SUCCESS',
      details: { status, assigned_to }
    });

    broadcastEvent('INCIDENT_UPDATED', { incident: updated });
    res.json(updated);
  });

  app.get('/api/v1/incidents/:id/timeline', authMiddleware, (req, res) => {
    const events = store.getIncidentEvents(req.params.id);
    res.json(events);
  });

  app.get('/api/v1/incidents/:id/topology', authMiddleware, (req, res) => {
    const topology = topologyEngine.buildTopology(req.params.id);
    const attackPath = topologyEngine.getAttackPath(req.params.id);
    res.json({ ...topology, attack_path: attackPath });
  });

  app.post('/api/v1/incidents/:id/replay', authMiddleware, (req, res) => {
    const events = store.getIncidentEvents(req.params.id);
    const attackPath = topologyEngine.getAttackPath(req.params.id);
    res.json({
      incident_id: req.params.id,
      total_steps: events.length,
      events,
      attack_path: attackPath,
      replay_instructions: 'Execute progressive highlight state by iterating step_order from 1 to total_steps',
    });
  });

  // ==================== TOPOLOGY (GLOBAL) ====================
  app.get('/api/v1/topology', authMiddleware, (req, res) => {
    const topology = topologyEngine.buildTopology();
    res.json(topology);
  });

  // ==================== EVIDENCE & VERIFICATION ====================
  app.get('/api/v1/evidence', authMiddleware, (req, res) => {
    const incidentId = req.query.incident_id as string | undefined;
    res.json(store.getEvidenceList(incidentId));
  });

  app.get('/api/v1/evidence/:id', authMiddleware, (req, res) => {
    const evidence = store.getEvidenceById(req.params.id);
    if (!evidence) {
      return res.status(404).json({ error: 'EVIDENCE_NOT_FOUND' });
    }
    res.json(evidence);
  });

  app.post('/api/v1/evidence/:id/verify', authMiddleware, (req, res) => {
    const user = (req as any).user as User;
    const evidence = store.getEvidenceById(req.params.id);
    if (!evidence) {
      return res.status(404).json({ error: 'EVIDENCE_NOT_FOUND' });
    }

    // Find previous evidence in chain
    const allChain = store.getEvidenceList(evidence.incident_id);
    const idx = allChain.findIndex(e => e.id === evidence.id);
    const prevEvidence = idx > 0 ? allChain[idx - 1] : undefined;
    const expectedPrevHash = prevEvidence ? prevEvidence.current_hash : undefined;

    const verification = EvidenceEngine.verifyEvidence(evidence, expectedPrevHash);

    store.addAuditEvent({
      actor_name: user.name,
      actor_role: user.role,
      action: 'EVIDENCE_VERIFIED',
      resource_type: 'EVIDENCE',
      resource_id: evidence.id,
      ip_address: req.ip || '127.0.0.1',
      result: verification.status === 'HASH_MATCH' ? 'SUCCESS' : 'FAILED',
      details: { verification_result: verification.status, tamper_detected: verification.tamper_detected }
    });

    res.json({
      evidence_id: evidence.id,
      incident_id: evidence.incident_id,
      ...verification,
    });
  });

  // Tamper Simulation Endpoint (for forensic test verification)
  app.post('/api/v1/evidence/:id/tamper', authMiddleware, (req, res) => {
    const { tampered } = req.body;
    const result = store.setEvidenceTampered(req.params.id, tampered !== false);
    if (!result) {
      return res.status(404).json({ error: 'EVIDENCE_NOT_FOUND' });
    }
    res.json({
      evidence_id: req.params.id,
      tampered: tampered !== false,
      message: tampered !== false
        ? 'Evidence payload altered in memory. Recalculated SHA-256 will now detect HASH_MISMATCH.'
        : 'Evidence restored to original sealed payload.',
    });
  });

  // ==================== BLOCKCHAIN ANCHOR ====================
  app.post('/api/v1/blockchain/anchor', authMiddleware, async (req, res) => {
    const user = (req as any).user as User;
    const { evidence_id, incident_id } = req.body;
    const evidence = store.getEvidenceById(evidence_id);
    if (!evidence) {
      return res.status(404).json({ error: 'EVIDENCE_NOT_FOUND' });
    }

    const settings = store.getSettings();
    const adapter = getBlockchainAdapter(settings.features.blockchain_mode);
    const anchor = await adapter.anchorEvidence(evidence, incident_id || evidence.incident_id);

    store.addBlockchainAnchor(anchor);

    store.addAuditEvent({
      actor_name: user.name,
      actor_role: user.role,
      action: 'BLOCKCHAIN_ANCHOR_CREATED',
      resource_type: 'BLOCKCHAIN_ANCHOR',
      resource_id: anchor.id,
      ip_address: req.ip || '127.0.0.1',
      result: 'SUCCESS',
      details: { tx_id: anchor.anchor_tx_id, mode: anchor.network_mode, block_number: anchor.block_number }
    });

    broadcastEvent('EVIDENCE_ANCHORED', { anchor });
    res.status(201).json(anchor);
  });

  app.post('/api/v1/blockchain/verify', authMiddleware, async (req, res) => {
    const { anchor_id } = req.body;
    const anchor = store.getBlockchainAnchorById(anchor_id);
    if (!anchor) {
      return res.status(404).json({ error: 'ANCHOR_NOT_FOUND' });
    }
    const evidence = store.getEvidenceById(anchor.evidence_id);
    if (!evidence) {
      return res.status(404).json({ error: 'EVIDENCE_NOT_FOUND' });
    }

    const adapter = getBlockchainAdapter(anchor.network_mode);
    const verification = await adapter.verifyAnchor(anchor, evidence);

    res.json({
      anchor,
      verification,
    });
  });

  // ==================== COMPLIANCE ====================
  app.get('/api/v1/compliance/rules', authMiddleware, (req, res) => {
    res.json(store.getComplianceRules());
  });

  app.get('/api/v1/compliance/checks', authMiddleware, (req, res) => {
    res.json(store.getComplianceChecks());
  });

  app.get('/api/v1/compliance/:booking_id', authMiddleware, (req, res) => {
    const checks = store.getComplianceChecks(req.params.booking_id);
    res.json(checks);
  });

  app.post('/api/v1/compliance/:booking_id/verify', authMiddleware, (req, res) => {
    const booking = store.getBookingById(req.params.booking_id);
    if (!booking) {
      return res.status(404).json({ error: 'BOOKING_NOT_FOUND' });
    }
    const shipper = store.getShipperById(booking.shipper_id);
    if (!shipper) {
      return res.status(404).json({ error: 'SHIPPER_NOT_FOUND' });
    }

    const checks = complianceEngine.evaluateBooking(booking, shipper);
    store.addComplianceChecks(checks);

    res.json({
      booking_id: booking.id,
      checks,
      overall_status: checks.some(c => c.status === 'FAIL') ? 'FAIL' : (checks.some(c => c.status === 'REVIEW') ? 'REVIEW' : 'PASS'),
    });
  });

  // ==================== REPORTS (GENUINE PDF GENERATION) ====================
  app.get('/api/v1/reports', authMiddleware, (req, res) => {
    res.json(store.getReports());
  });

  app.post('/api/v1/reports/fraud', authMiddleware, (req, res) => {
    const user = (req as any).user as User;
    const { incident_id } = req.body;
    const incident = store.getIncidentById(incident_id);
    if (!incident) {
      return res.status(404).json({ error: 'INCIDENT_NOT_FOUND' });
    }
    const booking = store.getBookingById(incident.booking_id);
    if (!booking) {
      return res.status(404).json({ error: 'BOOKING_NOT_FOUND' });
    }
    const shipper = store.getShipperById(booking.shipper_id);
    if (!shipper) {
      return res.status(404).json({ error: 'SHIPPER_NOT_FOUND' });
    }

    const assessment = store.getRiskAssessmentByBookingId(booking.id) || {
      id: 'RSK-GEN',
      booking_id: booking.id,
      identity_score: 80,
      behavior_score: 90,
      shipment_score: 85,
      payment_score: 80,
      destination_score: 75,
      compliance_score: 80,
      final_score: incident.risk_score,
      risk_level: 'HIGH',
      decision: incident.decision,
      digital_trust_score: 20,
      triggered_signals: [],
      ml_anomaly_score: 0.95,
      ml_status: 'ACTIVE',
      ml_model_version: 'FS-IForest-v1.4',
      fallback_level: 'LEVEL 1 — AI/ML DETECTION',
      explanation: 'Official fraud dossier compiled by forensic investigator.',
      explanation_source: 'DETERMINISTIC_RULES',
      created_at: new Date().toISOString(),
    };

    const timeline = store.getIncidentEvents(incident.id);
    const evidenceList = store.getEvidenceList(incident.id);
    const complianceChecks = store.getComplianceChecks(booking.id);
    const anchor = store.getBlockchainAnchors(incident.id)[0];
    const perm = store.getPermissionProfileByAccountId(booking.account_id);

    const report = reportEngine.generateFraudInvestigationReport(
      incident,
      booking,
      shipper,
      assessment,
      timeline,
      evidenceList,
      complianceChecks,
      anchor,
      perm
    );

    store.addReport(report);

    store.addAuditEvent({
      actor_name: user.name,
      actor_role: user.role,
      action: 'REPORT_GENERATED_FRAUD_DOSSIER',
      resource_type: 'REPORT',
      resource_id: report.id,
      ip_address: req.ip || '127.0.0.1',
      result: 'SUCCESS',
      details: { filename: report.filename, hash: report.sha256_hash }
    });

    res.status(201).json(report);
  });

  app.post('/api/v1/reports/compliance', authMiddleware, (req, res) => {
    const user = (req as any).user as User;
    const { booking_id } = req.body;
    const booking = store.getBookingById(booking_id);
    if (!booking) {
      return res.status(404).json({ error: 'BOOKING_NOT_FOUND' });
    }
    const shipper = store.getShipperById(booking.shipper_id);
    if (!shipper) {
      return res.status(404).json({ error: 'SHIPPER_NOT_FOUND' });
    }

    const checks = store.getComplianceChecks(booking.id);
    const assessment = store.getRiskAssessmentByBookingId(booking.id);

    const report = reportEngine.generateComplianceReport(booking, shipper, checks, assessment);
    store.addReport(report);

    store.addAuditEvent({
      actor_name: user.name,
      actor_role: user.role,
      action: 'REPORT_GENERATED_COMPLIANCE_RECORD',
      resource_type: 'REPORT',
      resource_id: report.id,
      ip_address: req.ip || '127.0.0.1',
      result: 'SUCCESS',
      details: { filename: report.filename }
    });

    res.status(201).json(report);
  });

  app.post('/api/v1/reports/evidence', authMiddleware, (req, res) => {
    const user = (req as any).user as User;
    const { incident_id } = req.body;
    const evidenceList = store.getEvidenceList(incident_id);
    const anchor = store.getBlockchainAnchors(incident_id)[0];

    const report = reportEngine.generateEvidenceManifest(incident_id, evidenceList, anchor);
    store.addReport(report);

    store.addAuditEvent({
      actor_name: user.name,
      actor_role: user.role,
      action: 'REPORT_GENERATED_EVIDENCE_MANIFEST',
      resource_type: 'REPORT',
      resource_id: report.id,
      ip_address: req.ip || '127.0.0.1',
      result: 'SUCCESS',
      details: { filename: report.filename }
    });

    res.status(201).json(report);
  });

  app.post('/api/v1/reports/shipper-approval', authMiddleware, (req, res) => {
    try {
      const user = (req as any).user as User;
      const { shipper_id } = req.body;
      const shipper = store.getShipperById(shipper_id);
      if (!shipper) {
        return res.status(404).json({ error: 'SHIPPER_NOT_FOUND' });
      }

      const permissions = store.getPermissionProfiles().filter(p => {
        const accounts = store.getAccounts().filter(a => a.shipper_id === shipper.id);
        return accounts.some(a => a.id === p.account_id);
      });

      const report = reportEngine.generateShipperApprovalCertificate(shipper, permissions);
      store.addReport(report);

      store.addAuditEvent({
        actor_name: user.name,
        actor_role: user.role,
        action: 'REPORT_GENERATED_SHIPPER_APPROVAL',
        resource_type: 'REPORT',
        resource_id: report.id,
        ip_address: req.ip || '127.0.0.1',
        result: 'SUCCESS',
        details: { filename: report.filename, shipper_id: shipper.id }
      });

      res.status(201).json(report);
    } catch (err: any) {
      console.error('Shipper approval error:', err);
      res.status(500).json({ error: err.message, stack: err.stack });
    }
  });

  app.get('/api/v1/reports/download/:filename', (req, res) => {
    const safeFilename = path.basename(req.params.filename);
    const reportsDir = path.resolve(process.cwd(), 'reports');
    const filepath = path.join(reportsDir, safeFilename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).send('Report PDF not found on disk.');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    fs.createReadStream(filepath).pipe(res);
  });

  // ==================== SETTINGS ====================
  app.get('/api/v1/settings', authMiddleware, (req, res) => {
    res.json(store.getSettings());
  });

  app.patch('/api/v1/settings', authMiddleware, requireRole(['ADMIN', 'FRAUD_ANALYST']), (req, res) => {
    const user = (req as any).user as User;
    const updated = store.updateSettings(req.body);

    store.addAuditEvent({
      actor_name: user.name,
      actor_role: user.role,
      action: 'SETTINGS_CONFIGURED',
      resource_type: 'SYSTEM_SETTINGS',
      resource_id: 'GLOBAL',
      ip_address: req.ip || '127.0.0.1',
      result: 'SUCCESS',
      details: req.body,
    });

    broadcastEvent('SETTINGS_UPDATED', { settings: updated });
    res.json(updated);
  });

  // ==================== AUDIT EVENTS ====================
  app.get('/api/v1/audit', authMiddleware, (req, res) => {
    res.json(store.getAuditEvents());
  });

  // ==================== DEMO SEED RESET ====================
  app.post('/api/v1/demo/reset', authMiddleware, (req, res) => {
    const user = (req as any).user as User;
    store.resetSeedData();

    store.addAuditEvent({
      actor_name: user.name,
      actor_role: user.role,
      action: 'DEMO_DATA_RESET',
      resource_type: 'SYSTEM',
      resource_id: 'DATABASE',
      ip_address: req.ip || '127.0.0.1',
      result: 'SUCCESS',
      details: { message: 'Reset database to pristine calibrated demo scenarios.' }
    });

    broadcastEvent('DEMO_RESET', { timestamp: new Date().toISOString() });
    res.json({ message: 'Seed data successfully reloaded.', timestamp: new Date().toISOString() });
  });

  // ==================== VITE CLIENT INTEGRATION ====================
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[FraudShield] Core Server operational on http://0.0.0.0:${PORT}`);
    console.log(`[FraudShield] WebSocket Live Feed: ws://0.0.0.0:${PORT}/ws/live`);
  });
}

bootstrap().catch(err => {
  console.error('Fatal bootstrap failure:', err);
  process.exit(1);
});
