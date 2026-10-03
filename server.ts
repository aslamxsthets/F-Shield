import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
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
const TOTP_ENCRYPTION_KEY = crypto.scryptSync(process.env.TOTP_ENCRYPTION_KEY || JWT_SECRET, 'fraudshield-totp-v1', 32);

const toBase32 = (value: string | Buffer) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let buffer = 0;
  let output = '';
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(buffer >> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(buffer << (5 - bits)) & 31];
  }

  return output;
};

const base32Decode = (value: string): Buffer => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let buffer = 0;
  const output: number[] = [];

  for (const char of value.toUpperCase()) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    buffer = (buffer << 5) | idx;
    bits += 5;
    while (bits >= 8) {
      output.push((buffer >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(output);
};

const encryptTotpSecret = (secret: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', TOTP_ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
};

const decryptTotpSecret = (value: string) => {
  const [iv, tag, encrypted] = value.split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', TOTP_ENCRYPTION_KEY, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
};

const verifyTotp = (secret: string, code: string) => {
  if (!/^\d{6}$/.test(code)) return false;
  const generated = generateTotp(secret, Date.now());
  return generated === code || generateTotp(secret, Date.now() - 30000) === code;
};

const generateTotp = (secret: string, timestamp: number) => {
  const decodedSecret = base32Decode(secret);
  let counter = BigInt(Math.floor(timestamp / 30000));
  const buffer = Buffer.alloc(8);
  for (let i = 7; i >= 0; i -= 1) {
    buffer[i] = Number(counter & 0xffn);
    counter >>= 8n;
  }

  const hash = crypto.createHmac('sha1', decodedSecret).update(buffer).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  const binary = ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  return String(Math.floor(binary % 1000000)).padStart(6, '0');
};

const carrierServiceDocs = [
  { name: 'FedEx', service: 'International Priority & Express', status: 'REFERENCE', url: 'https://www.fedex.com/en-in/shipping/international.html', notes: 'Carrier service reference; live tracking requires FedEx API credentials.' },
  { name: 'DHL', service: 'Express Worldwide', status: 'REFERENCE', url: 'https://www.dhl.com/discover/en-global/ship-with-dhl/services', notes: 'Carrier service reference; live tracking requires DHL API credentials.' },
  { name: 'UPS', service: 'Worldwide Express / Saver', status: 'REFERENCE', url: 'https://www.ups.com/in/en/support/shipping-support/shipping-services.page', notes: 'Carrier service reference; live tracking requires UPS API credentials.' },
];

async function bootstrap() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: '20mb' }));
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
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || !process.env.TOTP_ENCRYPTION_KEY)) {
    throw new Error('JWT_SECRET and TOTP_ENCRYPTION_KEY must be configured in production.');
  }
  await store.initializeSupabase();
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
        return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Authentication token is invalid or expired.' });
      }
    }
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'Sign in to access this resource.' });
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

  const pendingTotpSetups = new Map<string, { userId: string; secret: string; expiresAt: number }>();

  const toPublicUser = (user: User) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    phone: user.phone,
    role: user.role,
  });

  const findUserByIdentifier = (value: string) => {
    const identifier = value.trim().toLowerCase();
    const digits = identifier.replace(/\D/g, '');
    return store.getUsers().find(user =>
      user.email.toLowerCase() === identifier ||
      user.username?.toLowerCase() === identifier ||
      (digits.length >= 7 && user.phone?.replace(/\D/g, '') === digits)
    );
  };

  const createTotpSetup = (user: User) => {
    const setupId = crypto.randomBytes(24).toString('base64url');
    const secret = toBase32(crypto.randomBytes(20));
    pendingTotpSetups.set(setupId, { userId: user.id, secret, expiresAt: Date.now() + 10 * 60 * 1000 });
    const label = encodeURIComponent(`F-Shield:${user.email}`);
    return {
      requires_totp_setup: true,
      setup_id: setupId,
      setup_secret: secret,
      otpauth_url: `otpauth://totp/${label}?secret=${secret}&issuer=F-Shield&algorithm=SHA1&digits=6&period=30`,
      user: toPublicUser(user),
    };
  };

  const issueSession = (user: User, req: Request) => {
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
    });
    return { token, user: toPublicUser(user) };
  };

  const verifyUserTotp = (user: User, code: unknown) =>
    !!user.totp_secret && verifyTotp(decryptTotpSecret(user.totp_secret), String(code || ''));

  // ==================== HEALTH & SYSTEM ROUTES ====================
  app.get('/health', (req, res) => {
    res.json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'F-Shield Core Engine',
      database: 'CONNECTED',
      data_backend: store.getStorageMode(),
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
  app.post('/api/v1/auth/register', (req, res) => {
    const name = String(req.body.name || '').trim();
    const username = String(req.body.username || '').trim().toLowerCase();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim();
    const password = String(req.body.password || '');
    const phoneDigits = phone.replace(/\D/g, '');

    if (!name || !/^[a-z0-9._-]{3,32}$/.test(username) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phoneDigits.length < 7 || phoneDigits.length > 15 || password.length < 12) {
      return res.status(400).json({ error: 'INVALID_REGISTRATION', message: 'Enter a name, username (3-32 characters), valid email, phone number, and password of at least 12 characters.' });
    }

    const duplicate = store.getUsers().some(user =>
      user.email.toLowerCase() === email ||
      user.username?.toLowerCase() === username ||
      (phoneDigits.length && user.phone?.replace(/\D/g, '') === phoneDigits)
    );
    if (duplicate) {
      return res.status(409).json({ error: 'ACCOUNT_EXISTS', message: 'That username, email, or phone number is already registered.' });
    }

    const user: User = {
      id: `USR-${crypto.randomUUID()}`,
      name,
      username,
      email,
      phone,
      password_hash: bcrypt.hashSync(password, 12),
      role: 'VIEWER',
    };
    store.addUser(user);
    res.status(201).json(createTotpSetup(user));
  });

  app.post('/api/v1/auth/login', (req, res) => {
    const identifier = String(req.body.identifier || req.body.email || '');
    const password = String(req.body.password || '');
    const user = findUserByIdentifier(identifier);

    if (!user?.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Username, email, phone, or password is incorrect.' });
    }

    if (!user.totp_secret) {
      return res.json(createTotpSetup(user));
    }

    if (!req.body.otp) {
      return res.json({ requires_totp: true, user: toPublicUser(user) });
    }
    if (!verifyUserTotp(user, req.body.otp)) {
      return res.status(401).json({ error: 'INVALID_TOTP', message: 'Enter the current code from your enrolled authenticator app.' });
    }

    res.json(issueSession(user, req));
  });

  app.post('/api/v1/auth/totp/complete-setup', (req, res) => {
    const setupId = String(req.body.setup_id || '');
    const setup = pendingTotpSetups.get(setupId);
    if (!setup || setup.expiresAt < Date.now()) {
      pendingTotpSetups.delete(setupId);
      return res.status(401).json({ error: 'SETUP_EXPIRED', message: 'Authenticator setup expired. Sign in again to restart setup.' });
    }

    if (!verifyTotp(setup.secret, String(req.body.otp || ''))) {
      return res.status(401).json({ error: 'INVALID_TOTP', message: 'The authenticator code did not match. Check your device time and try again.' });
    }

    const user = store.getUsers().find(entry => entry.id === setup.userId);
    if (!user) {
      pendingTotpSetups.delete(setupId);
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Account no longer exists.' });
    }

    store.updateUserAuth(user.id, { totp_secret: encryptTotpSecret(setup.secret) });
    pendingTotpSetups.delete(setupId);
    res.json(issueSession(user, req));
  });

  app.post('/api/v1/auth/google', async (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(503).json({ error: 'GOOGLE_LOGIN_NOT_CONFIGURED', message: 'Set GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_ID to enable Google sign-in.' });
    }

    try {
      const credential = String(req.body.credential || '');
      const googleResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
      if (!credential || !googleResponse.ok) {
        return res.status(401).json({ error: 'INVALID_GOOGLE_CREDENTIAL', message: 'Google could not verify this sign-in.' });
      }

      const claims = await googleResponse.json() as { aud?: string; iss?: string; email?: string; email_verified?: string; name?: string; sub?: string };
      if (claims.aud !== clientId || !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss || '') || claims.email_verified !== 'true' || !claims.email) {
        return res.status(401).json({ error: 'INVALID_GOOGLE_CREDENTIAL', message: 'Google identity or verified email did not match this application.' });
      }

      let user = store.getUsers().find(entry => entry.email.toLowerCase() === claims.email!.toLowerCase());
      if (!user) {
        user = {
          id: `USR-${crypto.randomUUID()}`,
          name: claims.name || claims.email.split('@')[0],
          username: `${claims.email.split('@')[0].toLowerCase()}-${crypto.randomBytes(3).toString('hex')}`,
          email: claims.email.toLowerCase(),
          phone: '',
          password_hash: bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12),
          role: 'VIEWER',
        };
        store.addUser(user);
      }

      if (!user.totp_secret) {
        return res.json(createTotpSetup(user));
      }

      if (!req.body.otp) {
        return res.json({ requires_totp: true, user: toPublicUser(user) });
      }
      if (!verifyUserTotp(user, req.body.otp)) {
        return res.status(401).json({ error: 'INVALID_TOTP', message: 'Enter your authenticator code to complete Google sign-in.' });
      }

      res.json(issueSession(user, req));
    } catch (error) {
      console.error('Google sign-in verification failed:', error);
      res.status(502).json({ error: 'GOOGLE_VERIFICATION_FAILED', message: 'Google sign-in verification is temporarily unavailable.' });
    }
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

  app.get('/api/v1/carrier-docs', authMiddleware, (req, res) => {
    res.json(carrierServiceDocs);
  });

  app.post('/api/v1/ai/chat', authMiddleware, async (req, res) => {
    const incomingMessages = Array.isArray(req.body?.messages)
      ? req.body.messages
      : (req.body?.message ? [{ role: 'user', content: req.body.message }] : []);
    const messages: { role: 'user' | 'assistant'; content: string }[] = incomingMessages
      .filter((entry: any) => entry && ['user', 'assistant'].includes(entry.role) && typeof entry.content === 'string')
      .slice(-8)
      .map((entry: any) => ({ role: entry.role as 'user' | 'assistant', content: entry.content.trim().slice(0, 1600) }))
      .filter((entry: { content: string }) => entry.content.length > 0);
    const lastUserMessage = [...messages].reverse().find(message => message.role === 'user');
    if (!lastUserMessage) {
      return res.status(400).json({ error: 'EMPTY_MESSAGE', message: 'Ask a question about incidents, reports, or carrier telemetry.' });
    }
    const shipperDisplayNames: Record<string, string> = {
      'SHP-101': 'Apex Production Tools Ltd.',
      'SHP-202': 'Nexus BioLogistics',
      'SHP-303': 'Solis Robotics Inc.',
      'SHP-404': 'Orion Freight Logistics',
    };
    const shipperName = (shipperId: string) => {
      const shipper = store.getShipperById(shipperId);
      return shipper ? shipperDisplayNames[shipper.id] || shipper.company_name : shipperId;
    };
    const ignoredSearchTerms = new Set(['a', 'an', 'and', 'about', 'all', 'an', 'any', 'approval', 'approved', 'booking', 'bookings', 'can', 'case', 'cases', 'check', 'checks', 'compliance', 'could', 'detail', 'details', 'dossier', 'download', 'entity', 'entities', 'fetch', 'find', 'for', 'from', 'get', 'give', 'i', 'incident', 'incidents', 'information', 'latest', 'list', 'me', 'most', 'my', 'name', 'named', 'newest', 'of', 'please', 'recent', 'record', 'records', 'report', 'reports', 'search', 'shipment', 'shipments', 'shipper', 'shippers', 'show', 'tell', 'the', 'to', 'want', 'what', 'which', 'with', 'you']);
    const matchesSearch = (query: string, fields: unknown[], requireTerms = false) => {
      const terms = query.toLowerCase().split(/[^a-z0-9-]+/).filter(term => term.length > 1 && !ignoredSearchTerms.has(term));
      if (terms.length === 0) return !requireTerms;
      const searchable = fields.filter(Boolean).join(' ').toLowerCase();
      return terms.every(term => searchable.includes(term));
    };
    const findIncident = (identifier: string) => {
      const query = identifier.trim().toLowerCase();
      return store.getIncidents().find(incident => incident.id.toLowerCase() === query || incident.incident_number.toLowerCase() === query)
        || store.getIncidents().find(incident => matchesSearch(query, [incident.id, incident.incident_number, shipperName(incident.shipper_id)], true));
    };
    const findBooking = (identifier: string) => {
      const query = identifier.trim().toLowerCase();
      return store.getBookings().find(booking => booking.id.toLowerCase() === query || booking.booking_reference.toLowerCase() === query)
        || store.getBookings().find(booking => matchesSearch(query, [booking.id, booking.booking_reference, shipperName(booking.shipper_id)], true));
    };

    const toolDefinitions = [
      {
        type: 'function',
        function: {
          name: 'search_incidents',
          description: 'Search incident records by number, status, severity, or shipper name. Use for questions about incidents and cases.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Incident number, shipper name, or other search text.' },
              status: { type: 'string', enum: ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'FALSE_POSITIVE', 'ESCALATED'] },
              severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
            },
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_incident_details',
          description: 'Fetch one exact incident and its linked booking, assessment, timeline, evidence, and compliance checks.',
          parameters: { type: 'object', properties: { identifier: { type: 'string', description: 'Incident ID or incident number.' } }, required: ['identifier'], additionalProperties: false },
        },
      },
      {
        type: 'function',
        function: {
          name: 'search_reports',
          description: 'Find generated approval, compliance, fraud, or evidence reports. Use for requests to fetch or download reports.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Report title, shipper name, incident number, booking reference, or report ID.' },
              report_type: { type: 'string', enum: ['FRAUD_INVESTIGATION', 'COMPLIANCE_VERIFICATION', 'EVIDENCE_MANIFEST', 'SHIPPER_APPROVAL'] },
            },
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_entity_details',
          description: 'Look up a shipper, booking, account, device, or payment entity by exact ID, name, or booking reference.',
          parameters: { type: 'object', properties: { identifier: { type: 'string' } }, required: ['identifier'], additionalProperties: false },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_compliance_details',
          description: 'Fetch the compliance check results and applicable rules for a booking reference or booking ID.',
          parameters: { type: 'object', properties: { booking_identifier: { type: 'string' } }, required: ['booking_identifier'], additionalProperties: false },
        },
      },
    ];

    const executeReadTool = (name: string, args: Record<string, any>) => {
      if (name === 'search_incidents') {
        const query = String(args.query || '').trim();
        const found = store.getIncidents().filter(incident => {
          const matchesQuery = matchesSearch(query, [incident.id, incident.incident_number, incident.shipper_id, shipperName(incident.shipper_id), incident.status, incident.severity, incident.decision]);
          return matchesQuery && (!args.status || incident.status === args.status) && (!args.severity || incident.severity === args.severity);
        }).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 6);
        return found.map(incident => ({
          id: incident.id,
          incident_number: incident.incident_number,
          shipper: shipperName(incident.shipper_id),
          severity: incident.severity,
          risk_score: incident.risk_score,
          status: incident.status,
          decision: incident.decision,
          created_at: incident.created_at,
          booking: store.getBookingById(incident.booking_id)?.booking_reference || incident.booking_id,
        }));
      }

      if (name === 'get_incident_details') {
        const incident = findIncident(String(args.identifier || ''));
        if (!incident) return { found: false, message: 'No incident matched that identifier.' };
        const booking = store.getBookingById(incident.booking_id);
        return {
          found: true,
          incident: {
            id: incident.id,
            incident_number: incident.incident_number,
            shipper: shipperName(incident.shipper_id),
            severity: incident.severity,
            risk_score: incident.risk_score,
            status: incident.status,
            decision: incident.decision,
            assigned_to: incident.assigned_to,
            created_at: incident.created_at,
            updated_at: incident.updated_at,
            triggered_rules: incident.triggered_rules,
            resolution_notes: incident.resolution_notes,
          },
          booking: booking ? {
            id: booking.id,
            reference: booking.booking_reference,
            status: booking.status,
            origin: booking.origin,
            destination: booking.destination,
            weight_kg: booking.weight_kg,
            service_type: booking.service_type,
          } : undefined,
          assessment: booking ? (() => {
            const assessment = store.getRiskAssessmentByBookingId(booking.id);
            return assessment ? {
              final_score: assessment.final_score,
              risk_level: assessment.risk_level,
              decision: assessment.decision,
              explanation: assessment.explanation,
              signals: assessment.triggered_signals.slice(0, 8).map(signal => ({ code: signal.code, severity: signal.severity, description: signal.description })),
            } : undefined;
          })() : undefined,
          timeline: store.getIncidentEvents(incident.id).slice(0, 8).map(event => ({ step_order: event.step_order, title: event.title, description: event.description, timestamp: event.timestamp })),
          evidence: store.getEvidenceList(incident.id).slice(0, 6).map(evidence => ({ id: evidence.id, source_event: evidence.source_event, source_system: evidence.source_system, created_at: evidence.created_at, current_hash: evidence.current_hash, is_tampered: evidence.is_tampered })),
          compliance_checks: booking ? store.getComplianceChecks(booking.id).slice(0, 10) : [],
        };
      }

      if (name === 'search_reports') {
        const query = String(args.query || '').trim();
        const found = store.getReports().filter(report => {
          const matchesType = !args.report_type || report.report_type === args.report_type;
          const relatedNames = [
            report.title,
            report.filename,
            report.id,
            report.incident_id ? findIncident(report.incident_id)?.incident_number || '' : '',
            report.booking_id ? store.getBookingById(report.booking_id)?.booking_reference || '' : '',
            report.shipper_id ? shipperName(report.shipper_id) : '',
          ];
          return matchesType && matchesSearch(query, relatedNames);
        }).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 5);
        return found.map(report => ({
          id: report.id,
          title: report.title,
          report_type: report.report_type,
          filename: report.filename,
          created_at: report.created_at,
          creator: report.creator,
          sha256_hash: report.sha256_hash,
          download_url: report.download_url,
          linked_incident: report.incident_id ? findIncident(report.incident_id)?.incident_number : undefined,
          linked_booking: report.booking_id ? store.getBookingById(report.booking_id)?.booking_reference : undefined,
          linked_shipper: report.shipper_id ? shipperName(report.shipper_id) : undefined,
        }));
      }

      if (name === 'get_entity_details') {
        const query = String(args.identifier || '').trim();
        const shipper = store.getShippers().find(item =>
          item.id.toLowerCase() === query.toLowerCase() || matchesSearch(query, [item.id, item.company_name, shipperDisplayNames[item.id]], true)
        );
        if (shipper) {
          const accounts = store.getAccounts().filter(account => account.shipper_id === shipper.id);
          return {
            found: true,
            type: 'SHIPPER',
            shipper: { ...shipper, company_name: shipperName(shipper.id) },
            accounts,
            bookings: store.getBookings().filter(booking => booking.shipper_id === shipper.id).slice(0, 5).map(booking => ({ reference: booking.booking_reference, status: booking.status, origin: booking.origin, destination: booking.destination, weight_kg: booking.weight_kg })),
            incidents: store.getIncidents().filter(incident => incident.shipper_id === shipper.id).slice(0, 5).map(incident => ({ incident_number: incident.incident_number, severity: incident.severity, risk_score: incident.risk_score, status: incident.status })),
            history: store.getShipperHistory(shipper.id).slice(0, 8),
          };
        }

        const booking = findBooking(query);
        if (booking) {
          return { found: true, type: 'BOOKING', booking, shipper: shipperName(booking.shipper_id), assessment: store.getRiskAssessmentByBookingId(booking.id), incident: store.getIncidents().find(incident => incident.booking_id === booking.id) };
        }

        const account = store.getAccounts().find(item => item.id.toLowerCase() === query.toLowerCase() || item.account_number.toLowerCase() === query.toLowerCase())
          || store.getAccounts().find(item => matchesSearch(query, [item.id, item.account_number, shipperName(item.shipper_id)], true));
        if (account) return { found: true, type: 'ACCOUNT', account, shipper: shipperName(account.shipper_id), permissions: store.getPermissionProfileByAccountId(account.id) };

        const device = store.getDevices().find(item => item.id.toLowerCase() === query.toLowerCase())
          || store.getDevices().find(item => matchesSearch(query, [item.id, item.ip_address, item.device_fingerprint], true));
        if (device) return { found: true, type: 'DEVICE', device };

        const payment = store.getPaymentMethods().find(item => item.id.toLowerCase() === query.toLowerCase() || item.masked_number.toLowerCase() === query.toLowerCase())
          || store.getPaymentMethods().find(item => matchesSearch(query, [item.id, item.masked_number, item.payment_type, shipperName(item.shipper_id)], true));
        if (payment) return { found: true, type: 'PAYMENT', payment, shipper: shipperName(payment.shipper_id) };

        return { found: false, message: 'No shipper, booking, account, device, or payment matched that identifier.' };
      }

      if (name === 'get_compliance_details') {
        const booking = findBooking(String(args.booking_identifier || ''));
        if (!booking) return { found: false, message: 'No booking matched that reference, so compliance records could not be retrieved.' };
        const checks = store.getComplianceChecks(booking.id);
        const rules = new Map(store.getComplianceRules().map(rule => [rule.id, rule]));
        return {
          found: true,
          booking: { id: booking.id, reference: booking.booking_reference, shipper: shipperName(booking.shipper_id), status: booking.status, origin: booking.origin, destination: booking.destination },
          overall_status: checks.some(check => check.status === 'FAIL') ? 'FAIL' : checks.some(check => check.status === 'REVIEW') ? 'REVIEW' : checks.length ? 'PASS' : 'NOT_RUN',
          checks: checks.slice(0, 12).map(check => ({ id: check.id, status: check.status, authority: check.authority, law_regulation: check.law_regulation, section_rule: check.section_rule, evidence_summary: check.evidence_summary, verified_at: check.verified_at, rule: rules.get(check.rule_id) })),
        };
      }

      return { error: 'Unknown read tool.' };
    };

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'GROQ_NOT_CONFIGURED', message: 'Groq chat is not configured. Set GROQ_API_KEY in the server environment.' });
    }

    const tools = [
      {
        type: 'function',
        function: {
          name: 'search_incidents',
          description: 'Search current incident cases by incident number, shipper, status, or severity. Always use this for incident lookup questions.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Incident number, shipper, or search phrase.' },
              status: { type: 'string', enum: ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'FALSE_POSITIVE', 'ESCALATED'] },
              severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
            },
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_incident_details',
          description: 'Retrieve a full exact incident record, linked booking/risk assessment, timeline, evidence, and compliance results.',
          parameters: { type: 'object', properties: { identifier: { type: 'string' } }, required: ['identifier'], additionalProperties: false },
        },
      },
      {
        type: 'function',
        function: {
          name: 'search_reports',
          description: 'Search archived generated reports. Use for approval certificates, compliance reports, fraud dossiers, or evidence manifests; results include download links.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Report ID/title, shipper, incident number, or booking reference.' },
              report_type: { type: 'string', enum: ['FRAUD_INVESTIGATION', 'COMPLIANCE_VERIFICATION', 'EVIDENCE_MANIFEST', 'SHIPPER_APPROVAL'] },
            },
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_entity_details',
          description: 'Retrieve the exact current details of a shipper, booking, account, device, or payment by name, ID, or booking reference.',
          parameters: { type: 'object', properties: { identifier: { type: 'string' } }, required: ['identifier'], additionalProperties: false },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_compliance_details',
          description: 'Retrieve compliance checks and linked regulations for an exact booking ID or reference.',
          parameters: { type: 'object', properties: { booking_identifier: { type: 'string' } }, required: ['booking_identifier'], additionalProperties: false },
        },
      },
    ];

    const conversation: any[] = [
      {
        role: 'system',
        content: [
          'You are F-Shield Chat, a direct, helpful conversational assistant.',
          'Use the conversation history to resolve references such as it, that incident, or the report you just found.',
          'For questions about incidents, approval/compliance reports, or entity records, call the relevant read-only tool before answering. Do not guess from memory.',
          'Keep ordinary answers concise. Give a concise factual summary and key fields; include more detail only when the user asks for it.',
          'For report requests, search by the user-provided shipper, incident, booking, or report kind. If found, include its title, date, and make clear that a download link is available.',
          'Answer greetings normally. If a lookup returns no match, say so and ask for the exact name, reference, or ID that would disambiguate it.',
          'Do not claim that you generated a report or changed any record. Tools are read-only.',
          'Carrier entries are service references, not live tracking data.',
        ].join(' '),
      },
      ...messages,
    ];
    const sources = new Set<string>();
    const attachmentMap = new Map<string, { filename: string; title: string; download_url: string }>();
    let toolCallCount = 0;
    const collectReportAttachments = (value: any) => {
      if (Array.isArray(value)) {
        value.forEach(collectReportAttachments);
        return;
      }
      if (!value || typeof value !== 'object') return;
      if (typeof value.download_url === 'string' && value.download_url.startsWith('/api/v1/reports/download/')) {
        attachmentMap.set(value.download_url, {
          filename: String(value.filename || 'report.pdf'),
          title: String(value.title || value.filename || 'Report'),
          download_url: value.download_url,
        });
      }
      Object.values(value).forEach(collectReportAttachments);
    };

    try {
      const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
      let answer = '';
      for (let turn = 0; turn < 4; turn += 1) {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: conversation,
            tools,
            tool_choice: 'auto',
            temperature: 0.2,
            max_tokens: 900,
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({})) as any;
          const retryAfter = response.headers.get('retry-after');
          const rateLimitMessage = response.status === 429
            ? `Groq rate limit reached${retryAfter ? `. Retry in ${retryAfter} seconds` : ''}. Please try again shortly.`
            : '';
          throw new Error(rateLimitMessage || errorBody.error?.message || `Groq API returned HTTP ${response.status}`);
        }

        const payload = await response.json() as any;
        const assistantMessage = payload.choices?.[0]?.message;
        if (!assistantMessage) throw new Error('Groq returned an empty response.');
        const toolCalls = Array.isArray(assistantMessage.tool_calls) ? assistantMessage.tool_calls : [];
        if (toolCalls.length === 0) {
          answer = typeof assistantMessage.content === 'string' ? assistantMessage.content.trim() : '';
          break;
        }

        toolCallCount += toolCalls.length;
        if (toolCallCount > 8) throw new Error('The requested lookup required too many tool calls. Please narrow the question.');
        conversation.push({
          role: 'assistant',
          content: assistantMessage.content ?? null,
          tool_calls: toolCalls.map((toolCall: any) => ({
            id: String(toolCall.id || ''),
            type: 'function',
            function: {
              name: String(toolCall.function?.name || ''),
              arguments: typeof toolCall.function?.arguments === 'string'
                ? toolCall.function.arguments
                : JSON.stringify(toolCall.function?.arguments || {}),
            },
          })),
        });
        for (const toolCall of toolCalls) {
          const toolName = String(toolCall.function?.name || '');
          let args: Record<string, any> = {};
          try {
            const rawArgs = toolCall.function?.arguments;
            const parsedArgs = typeof rawArgs === 'string' ? JSON.parse(rawArgs || '{}') : rawArgs;
            if (parsedArgs && typeof parsedArgs === 'object' && !Array.isArray(parsedArgs)) args = parsedArgs;
          } catch {
            args = {};
          }
          const result = executeReadTool(toolName, args);
          if (toolName === 'search_incidents' || toolName === 'get_incident_details') sources.add('incidents');
          if (toolName === 'search_reports') {
            sources.add('reports');
            collectReportAttachments(result);
          }
          if (toolName === 'get_entity_details') sources.add('entities');
          if (toolName === 'get_compliance_details') sources.add('compliance');
          conversation.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result).slice(0, 14000),
          });
        }
      }

      res.json({
        answer,
        model,
        provider: 'GROQ',
        sources: Array.from(sources),
        attachments: Array.from(attachmentMap.values()),
      });
    } catch (err: any) {
      console.error('Groq chat/tool request failed:', err.message);
      const isRateLimited = /rate limit/i.test(err.message);
      res.status(isRateLimited ? 429 : 502).json({
        error: isRateLimited ? 'GROQ_RATE_LIMITED' : 'GROQ_CHAT_FAILED',
        message: isRateLimited ? err.message : 'The assistant could not complete the record lookup. Please retry or provide a more exact ID/reference.',
      });
    }
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
    broadcastEvent('REPORT_UPDATED', { report });

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
    broadcastEvent('REPORT_UPDATED', { report });

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
    broadcastEvent('REPORT_UPDATED', { report });

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
      broadcastEvent('REPORT_UPDATED', { report });

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

  app.get('/api/v1/reports/download/:filename', authMiddleware, (req, res) => {
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

  app.post('/api/v1/reports/upload', authMiddleware, (req, res) => {
    const { filename, title, report_type, content_base64 } = req.body || {};
    if (!filename || !content_base64) {
      return res.status(400).json({ error: 'INVALID_UPLOAD', message: 'Provide a filename and base64 content.' });
    }

    const safeFilename = path.basename(filename);
    const reportsDir = path.resolve(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const buffer = Buffer.from(content_base64, 'base64');
    const filepath = path.join(reportsDir, safeFilename);
    fs.writeFileSync(filepath, buffer);

    const report = {
      id: `RPT-UPLOAD-${Date.now().toString(36).toUpperCase()}`,
      report_type: (report_type || 'EVIDENCE_MANIFEST') as any,
      title: title || safeFilename,
      filename: safeFilename,
      filepath,
      file_size_bytes: buffer.length,
      sha256_hash: crypto.createHash('sha256').update(buffer).digest('hex'),
      created_at: new Date().toISOString(),
      creator: (req as any).user?.name || 'Analyst',
      download_url: `/api/v1/reports/download/${encodeURIComponent(safeFilename)}`,
    };

    store.addReport(report as any);
    broadcastEvent('REPORT_UPDATED', { report });
    res.status(201).json(report);
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
    console.log(`[F-Shield] Core Server operational on http://0.0.0.0:${PORT}`);
    console.log(`[F-Shield] WebSocket Live Feed: ws://0.0.0.0:${PORT}/ws/live`);
  });
}

bootstrap().catch(err => {
  console.error('Fatal bootstrap failure:', err);
  process.exit(1);
});
