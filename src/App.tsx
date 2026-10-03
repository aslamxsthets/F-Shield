import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { StatusBanner } from './components/StatusBanner';
import { AuditLogModal } from './components/AuditLogModal';
import { Overview } from './pages/Overview';
import { DashboardPage } from './pages/DashboardPage';
import { LiveBooking } from './pages/LiveBooking';
import { TopologyPage } from './pages/TopologyPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { IncidentDetail } from './pages/IncidentDetail';
import { EvidencePage } from './pages/EvidencePage';
import { CompliancePage } from './pages/CompliancePage';
import { ShippersPage } from './pages/ShippersPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { api } from './services/api';
import { SystemSettings, User, UserRole } from './types';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'USR-01',
    name: 'Sarah Vance',
    email: 'sarah.vance@fraudshield.internal',
    role: 'ADMIN',
  });
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(true);
  const [isAuditOpen, setIsAuditOpen] = useState<boolean>(false);

  useEffect(() => {
    // Initial fetch of system settings and user
    const initApp = async () => {
      try {
        const s = await api.getSettings();
        setSettings(s);
        // Login default ADMIN session
        const auth = await api.login('sarah.vance@fraudshield.internal', 'ADMIN');
        setCurrentUser(auth.user);
      } catch (err) {
        console.warn('Initial session initialization:', err);
      }
    };
    initApp();

    const unsub = api.subscribeToWs((evt) => {
      setWsConnected(true);
      if (evt.type === 'SETTINGS_UPDATED') {
        setSettings(evt.data.settings);
      }
    });

    return unsub;
  }, []);

  const handleSwitchRole = async (newRole: UserRole) => {
    try {
      const emailMap: Record<UserRole, string> = {
        ADMIN: 'sarah.vance@fraudshield.internal',
        FRAUD_ANALYST: 'marcus.s@fraudshield.internal',
        COMPLIANCE_ANALYST: 'ananya.s@fraudshield.internal',
        AUDITOR: 'robert.chen@auditor.gov',
        VIEWER: 'elena.r@fraudshield.internal',
      };
      const res = await api.login(emailMap[newRole], newRole);
      setCurrentUser(res.user);
    } catch (err: any) {
      alert(`Role switch failed: ${err.message}`);
    }
  };

  const handleResetDemo = async () => {
    if (window.confirm('Reset all demo databases to pristine calibrated scenario data?')) {
      try {
        await api.resetDemoData();
        const s = await api.getSettings();
        setSettings(s);
        alert('Seed data successfully reloaded with pristine demo scenarios.');
        // Navigate to overview
        setCurrentTab('overview');
      } catch (err: any) {
        alert(`Reset failed: ${err.message}`);
      }
    }
  };

  const handleNavigate = (tab: string, incidentId?: string) => {
    if (incidentId) {
      setSelectedIncidentId(incidentId);
      setCurrentTab('incident-detail');
    } else {
      setCurrentTab(tab);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-900 font-sans antialiased flex flex-col selection:bg-amber-200">
      {/* Navigation Header */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setSelectedIncidentId(null);
          setCurrentTab(tab);
        }}
        currentUser={currentUser}
        onSwitchRole={handleSwitchRole}
        settings={settings}
        wsConnected={wsConnected}
        onResetDemo={handleResetDemo}
        onOpenAudit={() => setIsAuditOpen(true)}
      />

      {/* System Status Banner */}
      <StatusBanner
        settings={settings}
        onNavigateSettings={() => setCurrentTab('settings')}
        onResetDemo={handleResetDemo}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-16">
        {(currentTab === 'dashboard' || currentTab === 'overview') && (
          <DashboardPage onNavigate={handleNavigate} />
        )}

        {currentTab === 'live-booking' && (
          <LiveBooking
            onNavigateToIncident={(id) => {
              setSelectedIncidentId(id);
              setCurrentTab('incident-detail');
            }}
          />
        )}

        {currentTab === 'topology' && (
          <TopologyPage />
        )}

        {currentTab === 'incidents' && (
          <IncidentsPage
            onSelectIncident={(id) => {
              setSelectedIncidentId(id);
              setCurrentTab('incident-detail');
            }}
          />
        )}

        {currentTab === 'incident-detail' && selectedIncidentId && (
          <IncidentDetail
            incidentId={selectedIncidentId}
            onBack={() => {
              setSelectedIncidentId(null);
              setCurrentTab('incidents');
            }}
          />
        )}

        {currentTab === 'evidence' && (
          <EvidencePage />
        )}

        {currentTab === 'compliance' && (
          <CompliancePage />
        )}

        {currentTab === 'shippers' && (
          <ShippersPage />
        )}

        {currentTab === 'reports' && (
          <ReportsPage />
        )}

        {currentTab === 'settings' && (
          <SettingsPage
            onSettingsUpdated={setSettings}
            onResetDemo={handleResetDemo}
          />
        )}
      </main>

      {/* Append-Only Audit Log Modal */}
      <AuditLogModal
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
      />

      {/* Footer */}
      <footer className="bg-stone-900 border-t border-stone-800 text-stone-400 text-xs py-4 px-6 text-center">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong>FraudShield</strong> &copy; 2026. Pre-Shipment Forensic Fraud Detection & Statutory Compliance Intelligence Platform.
          </span>
          <span className="font-mono text-[11px] text-stone-500">
            SHA-256 Tamper-Evident Ledger &bull; Zero-Trust Verifier &bull; CBIC Statutory Engine
          </span>
        </div>
      </footer>
    </div>
  );
}
