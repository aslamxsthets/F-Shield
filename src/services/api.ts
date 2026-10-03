import {
  Booking, DashboardMetrics, Evidence, Incident, IncidentEvent,
  ReportRecord, Shipper, SystemSettings, TopologyEdge, TopologyNode, User,
  ComplianceCheck, ShipperHistoryEvent
} from '../types';

export interface AuthResponse {
  token?: string;
  user?: User;
  requires_totp_setup?: boolean;
  requires_totp?: boolean;
  setup_id?: string;
  setup_secret?: string;
  otpauth_url?: string;
}

class ApiService {
  private token: string | null = null;
  private ws: WebSocket | null = null;
  private wsListeners: Set<(event: { type: string; data?: any; timestamp: string }) => void> = new Set();
  private reconnectTimer: any = null;

  constructor() {
    this.token = localStorage.getItem('f-shield_token') || localStorage.getItem('fraudshield_token');
    if (this.token) localStorage.setItem('f-shield_token', this.token);
    this.initWebSocket();
  }

  public setToken(token: string) {
    this.token = token;
    localStorage.setItem('f-shield_token', token);
    localStorage.removeItem('fraudshield_token');
  }

  public clearToken() {
    this.token = null;
    localStorage.removeItem('f-shield_token');
    localStorage.removeItem('fraudshield_token');
  }

  public getToken(): string | null {
    return this.token;
  }

  private emitFeedbackEvent(name: string, detail?: Record<string, unknown>) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    }
  }

  private initWebSocket() {
    if (typeof window === 'undefined') return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/live`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          this.wsListeners.forEach(listener => listener(parsed));
        } catch (e) {
          console.warn('Failed to parse WebSocket message:', e);
        }
      };

      this.ws.onclose = () => {
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.initWebSocket();
          }, 3000);
        }
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch (err) {
      console.warn('WebSocket connection attempt error:', err);
    }
  }

  public subscribeToWs(listener: (event: { type: string; data?: any; timestamp: string }) => void) {
    this.wsListeners.add(listener);
    return () => {
      this.wsListeners.delete(listener);
    };
  }

  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    this.emitFeedbackEvent('f-shield:request', { state: 'start' });
    let notificationSent = false;
    try {
      const response = await fetch(endpoint, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errBody: any;
        try {
          errBody = await response.json();
        } catch {
          errBody = { message: response.statusText };
        }
        const message = errBody.message || `Request failed with HTTP ${response.status}`;
        if (!endpoint.startsWith('/api/v1/auth') && endpoint !== '/api/v1/ai/chat') {
          this.emitFeedbackEvent('f-shield:notification', { tone: 'error', title: 'Request failed', message });
          notificationSent = true;
        }
        throw new Error(message);
      }

      return await response.json();
    } catch (error: any) {
      if (!notificationSent && !endpoint.startsWith('/api/v1/auth') && endpoint !== '/api/v1/ai/chat') {
        this.emitFeedbackEvent('f-shield:notification', {
          tone: 'error',
          title: 'Connection problem',
          message: error.message || 'The request could not be completed. Check your connection and try again.',
        });
      }
      throw error;
    } finally {
      this.emitFeedbackEvent('f-shield:request', { state: 'end' });
    }
  }

  // Auth
  public async login(identifier: string, password: string, otp?: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, otp }),
    });
    if (res.token) this.setToken(res.token);
    return res;
  }

  public async register(payload: { name: string; username: string; email: string; phone: string; password: string }): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async completeTotpSetup(setupId: string, otp: string): Promise<{ token: string; user: User }> {
    const res = await this.request<{ token: string; user: User }>('/api/v1/auth/totp/complete-setup', {
      method: 'POST',
      body: JSON.stringify({ setup_id: setupId, otp }),
    });
    this.setToken(res.token);
    return res;
  }

  public async loginWithGoogle(credential: string, otp?: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/api/v1/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential, otp }),
    });
    if (res.token) this.setToken(res.token);
    return res;
  }

  public async logout(): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api/v1/auth/logout', { method: 'POST' });
  }

  public async getMe(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/api/v1/auth/me');
  }

  // Dashboard
  public async getMetrics(): Promise<DashboardMetrics> {
    return this.request<DashboardMetrics>('/api/v1/dashboard/metrics');
  }

  // Bookings
  public async screenBooking(payload: any): Promise<any> {
    return this.request<any>('/api/v1/bookings/screen', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getBookings(): Promise<Booking[]> {
    return this.request<Booking[]>('/api/v1/bookings');
  }

  public async getBooking(id: string): Promise<any> {
    return this.request<any>(`/api/v1/bookings/${id}`);
  }

  // Shippers
  public async getShippers(): Promise<Shipper[]> {
    return this.request<Shipper[]>('/api/v1/shippers');
  }

  public async getShipper(id: string): Promise<any> {
    return this.request<any>(`/api/v1/shippers/${id}`);
  }

  public async getShipperHistory(id: string): Promise<ShipperHistoryEvent[]> {
    return this.request<ShipperHistoryEvent[]>(`/api/v1/shippers/${id}/history`);
  }

  public async getCarrierDocs(): Promise<any[]> {
    return this.request<any[]>('/api/v1/carrier-docs');
  }

  // Incidents
  public async getIncidents(): Promise<Incident[]> {
    return this.request<Incident[]>('/api/v1/incidents');
  }

  public async getIncident(id: string): Promise<any> {
    return this.request<any>(`/api/v1/incidents/${id}`);
  }

  public async updateIncident(id: string, updates: Partial<Incident>): Promise<Incident> {
    return this.request<Incident>(`/api/v1/incidents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  public async getIncidentTimeline(id: string): Promise<IncidentEvent[]> {
    return this.request<IncidentEvent[]>(`/api/v1/incidents/${id}/timeline`);
  }

  public async getIncidentTopology(id: string): Promise<{ nodes: TopologyNode[]; edges: TopologyEdge[]; attack_path: any }> {
    return this.request<any>(`/api/v1/incidents/${id}/topology`);
  }

  public async replayIncident(id: string): Promise<any> {
    return this.request<any>(`/api/v1/incidents/${id}/replay`, { method: 'POST' });
  }

  // Topology Global
  public async getGlobalTopology(): Promise<{ nodes: TopologyNode[]; edges: TopologyEdge[] }> {
    return this.request<any>('/api/v1/topology');
  }

  // Evidence
  public async getEvidenceList(incidentId?: string): Promise<Evidence[]> {
    const url = incidentId ? `/api/v1/evidence?incident_id=${incidentId}` : '/api/v1/evidence';
    return this.request<Evidence[]>(url);
  }

  public async verifyEvidence(id: string): Promise<any> {
    return this.request<any>(`/api/v1/evidence/${id}/verify`, { method: 'POST' });
  }

  public async tamperEvidence(id: string, tampered: boolean): Promise<any> {
    return this.request<any>(`/api/v1/evidence/${id}/tamper`, {
      method: 'POST',
      body: JSON.stringify({ tampered }),
    });
  }

  // Blockchain
  public async anchorEvidence(evidenceId: string, incidentId?: string): Promise<any> {
    return this.request<any>('/api/v1/blockchain/anchor', {
      method: 'POST',
      body: JSON.stringify({ evidence_id: evidenceId, incident_id: incidentId }),
    });
  }

  public async verifyBlockchainAnchor(anchorId: string): Promise<any> {
    return this.request<any>('/api/v1/blockchain/verify', {
      method: 'POST',
      body: JSON.stringify({ anchor_id: anchorId }),
    });
  }

  // Compliance
  public async getComplianceRules(): Promise<any[]> {
    return this.request<any[]>('/api/v1/compliance/rules');
  }

  public async getAllComplianceChecks(): Promise<ComplianceCheck[]> {
    return this.request<ComplianceCheck[]>('/api/v1/compliance/checks');
  }

  public async getComplianceChecks(bookingId: string): Promise<any[]> {
    return this.request<any[]>(`/api/v1/compliance/${bookingId}`);
  }

  public async verifyCompliance(bookingId: string): Promise<any> {
    return this.request<any>(`/api/v1/compliance/${bookingId}/verify`, { method: 'POST' });
  }

  // Reports
  public async getReports(): Promise<ReportRecord[]> {
    return this.request<ReportRecord[]>('/api/v1/reports');
  }

  public async downloadReport(downloadUrl: string): Promise<Blob> {
    const headers: Record<string, string> = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    this.emitFeedbackEvent('f-shield:request', { state: 'start' });
    try {
      const response = await fetch(downloadUrl, { headers });
      if (!response.ok) throw new Error(`Report download failed with HTTP ${response.status}`);
      return await response.blob();
    } catch (error: any) {
      this.emitFeedbackEvent('f-shield:notification', { tone: 'error', title: 'Download failed', message: error.message });
      throw error;
    } finally {
      this.emitFeedbackEvent('f-shield:request', { state: 'end' });
    }
  }

  public async generateFraudReport(incidentId: string): Promise<ReportRecord> {
    return this.request<ReportRecord>('/api/v1/reports/fraud', {
      method: 'POST',
      body: JSON.stringify({ incident_id: incidentId }),
    });
  }

  public async generateComplianceReport(bookingId: string): Promise<ReportRecord> {
    return this.request<ReportRecord>('/api/v1/reports/compliance', {
      method: 'POST',
      body: JSON.stringify({ booking_id: bookingId }),
    });
  }

  public async generateEvidenceManifest(incidentId: string): Promise<ReportRecord> {
    return this.request<ReportRecord>('/api/v1/reports/evidence', {
      method: 'POST',
      body: JSON.stringify({ incident_id: incidentId }),
    });
  }

  public async generateShipperApprovalReport(shipperId: string): Promise<ReportRecord> {
    return this.request<ReportRecord>('/api/v1/reports/shipper-approval', {
      method: 'POST',
      body: JSON.stringify({ shipper_id: shipperId }),
    });
  }

  public async uploadReport(payload: { filename: string; title?: string; report_type?: string; content_base64: string }): Promise<ReportRecord> {
    return this.request<ReportRecord>('/api/v1/reports/upload', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async askAiAssistant(
    messages: { role: 'user' | 'assistant'; content: string }[]
  ): Promise<{ answer: string; model: string; provider: string; sources: string[]; attachments: { filename: string; title: string; download_url: string }[] }> {
    return this.request<{ answer: string; model: string; provider: string; sources: string[]; attachments: { filename: string; title: string; download_url: string }[] }>('/api/v1/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    });
  }

  // Settings
  public async getSettings(): Promise<SystemSettings> {
    return this.request<SystemSettings>('/api/v1/settings');
  }

  public async updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    return this.request<SystemSettings>('/api/v1/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  }

  // Audit
  public async getAuditEvents(): Promise<any[]> {
    return this.request<any[]>('/api/v1/audit');
  }

  // Reset Demo
  public async resetDemoData(): Promise<any> {
    return this.request<any>('/api/v1/demo/reset', { method: 'POST' });
  }
}

export const api = new ApiService();
