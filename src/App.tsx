import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { AppFeedback, AppNotice } from './components/AppFeedback';
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
import { LoginPage } from './components/LoginPage';
import { SystemSettings, User } from './types';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(true);
  const [isAuditOpen, setIsAuditOpen] = useState<boolean>(false);
  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string; provider?: string; model?: string; attachments?: { filename: string; title: string; download_url: string }[] }[]>([
    { role: 'assistant', content: 'Hi! How can I help?' },
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [notices, setNotices] = useState<AppNotice[]>([]);
  const noticeIdRef = useRef(0);
  const lastApiErrorAtRef = useRef(0);

  const pushNotice = (message: string, tone: AppNotice['tone'] = 'error', title?: string) => {
    const id = ++noticeIdRef.current;
    const noticeTitle = title || (tone === 'error' ? 'Something went wrong' : tone === 'success' ? 'Completed' : 'F-Shield');
    setNotices(current => [...current, { id, title: noticeTitle, message, tone }].slice(-4));
    window.setTimeout(() => setNotices(current => current.filter(notice => notice.id !== id)), tone === 'error' ? 7000 : 4000);
  };

  const dismissNotice = (id: number) => setNotices(current => current.filter(notice => notice.id !== id));

  useLayoutEffect(() => {
    let pendingRequests = 0;
    let loadingTimer: number | undefined;
    const onRequest = (event: Event) => {
      const state = (event as CustomEvent<{ state?: string }>).detail?.state;
      if (state === 'start') {
        pendingRequests += 1;
        if (pendingRequests === 1) {
          loadingTimer = window.setTimeout(() => setGlobalLoading(true), 250);
        }
      } else if (state === 'end') {
        pendingRequests = Math.max(0, pendingRequests - 1);
        if (pendingRequests === 0) {
          if (loadingTimer !== undefined) window.clearTimeout(loadingTimer);
          loadingTimer = undefined;
          setGlobalLoading(false);
        }
      }
    };
    const onNotification = (event: Event) => {
      const detail = (event as CustomEvent<{ tone?: AppNotice['tone']; title?: string; message?: string }>).detail;
      if (!detail?.message) return;
      if (detail.tone === 'error') lastApiErrorAtRef.current = Date.now();
      pushNotice(detail.message, detail.tone || 'error', detail.title);
    };
    const onWindowError = (event: ErrorEvent) => {
      if (event.message) pushNotice(event.message, 'error', 'Unexpected error');
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason || 'An unexpected operation failed.');
      pushNotice(message, 'error', 'Unexpected error');
    };
    const nativeAlert = window.alert.bind(window);
    window.alert = (message?: unknown) => {
      if (Date.now() - lastApiErrorAtRef.current < 250) return;
      const text = String(message || '');
      const isError = /failed|error|unable|could not|invalid/i.test(text);
      pushNotice(text, isError ? 'error' : 'info', isError ? 'Request failed' : undefined);
    };

    window.addEventListener('f-shield:request', onRequest);
    window.addEventListener('f-shield:notification', onNotification);
    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('f-shield:request', onRequest);
      window.removeEventListener('f-shield:notification', onNotification);
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.alert = nativeAlert;
      if (loadingTimer !== undefined) window.clearTimeout(loadingTimer);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore server-side logout issues in demo mode.
    } finally {
      api.clearToken();
      setCurrentUser(null);
      setSettings(null);
      setCurrentTab('dashboard');
    }
  };

  const handleAskAi = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || !currentUser || chatLoading) return;

    const userMessage = { role: 'user' as const, content: trimmed };
    const conversation = [...chatMessages, userMessage].map(({ role, content }) => ({ role, content }));
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await api.askAiAssistant(conversation);
      setChatMessages((prev) => [...prev, { role: 'assistant', content: res.answer, provider: res.provider, model: res.model, attachments: res.attachments }]);
    } catch (err: any) {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: `I could not complete that request: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  const downloadChatAttachment = async (attachment: { filename: string; title: string; download_url: string }) => {
    try {
      const blob = await api.downloadReport(attachment.download_url);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = attachment.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error: any) {
      alert(`Could not download ${attachment.filename}: ${error.message}`);
    }
  };

  useEffect(() => {
    if (!chatOpen || !chatScrollRef.current) return;
    chatScrollRef.current.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages, chatLoading, chatOpen]);

  useEffect(() => {
    if (!api.getToken()) return;
    api.getMe().then(({ user }) => setCurrentUser(user)).catch(() => api.clearToken());
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const initApp = async () => {
      try {
        const s = await api.getSettings();
        setSettings(s);
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
  }, [currentUser]);

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

  if (!currentUser) {
    return <>
      <LoginPage onAuthenticated={setCurrentUser} />
      <AppFeedback loading={globalLoading} notices={notices} onDismiss={dismissNotice} />
    </>;
  }

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
        settings={settings}
        wsConnected={wsConnected}
        onResetDemo={handleResetDemo}
        onOpenAudit={() => setIsAuditOpen(true)}
        onLogout={handleLogout}
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

      <AppFeedback loading={globalLoading} notices={notices} onDismiss={dismissNotice} />

      {chatOpen && (
        <div className="fixed bottom-24 right-4 z-40 w-[calc(100vw-2rem)] max-w-[360px] rounded-2xl border border-stone-200 bg-white shadow-2xl sm:right-6">
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 text-sm font-bold text-stone-800">
            <span>F-Shield Chat</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setChatMessages([{ role: 'assistant', content: 'Hi! How can I help?' }])} className="text-xs font-medium text-stone-500 hover:text-stone-800">New chat</button>
              <button type="button" onClick={() => setChatOpen(false)} className="text-stone-500 hover:text-stone-800" aria-label="Close chat">Close</button>
            </div>
          </div>
          <div ref={chatScrollRef} className="max-h-80 min-h-48 space-y-3 overflow-y-auto px-4 py-3 text-sm">
            {chatMessages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`rounded-xl px-3 py-2 ${message.role === 'user' ? 'ml-8 bg-stone-900 text-white' : 'mr-8 bg-stone-100 text-stone-800'}`}>
                {message.provider && <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-stone-500">{message.provider === 'GROQ' ? message.model : 'Local data mode'}</div>}
                {message.content}
                {message.attachments?.map((attachment) => (
                  <button
                    key={attachment.download_url}
                    type="button"
                    onClick={() => void downloadChatAttachment(attachment)}
                    className="mt-2 flex w-full items-center gap-2 rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <span className="truncate">{attachment.title}</span>
                  </button>
                ))}
              </div>
            ))}
            {chatLoading && <div className="mr-8 rounded-xl bg-stone-100 px-3 py-2 text-stone-500">Thinking...</div>}
          </div>
          <div className="border-t border-stone-200 p-3">
            <div className="flex items-center gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleAskAi();
                  }
                }}
                className="flex-1 rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                placeholder="Message F-Shield..."
              />
              <button type="button" onClick={() => void handleAskAi()} disabled={chatLoading} className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-stone-900 disabled:opacity-60">
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setChatOpen((open) => !open)}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-stone-900 px-4 py-3 text-sm font-bold text-white shadow-xl transition hover:bg-stone-800"
      >
        {chatOpen ? 'Hide AI' : 'F-Shield AI'}
      </button>

      {/* Footer */}
      <footer className="bg-stone-900 border-t border-stone-800 text-stone-400 text-xs py-4 px-6 text-center">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong>F-Shield</strong> &copy; 2026. Pre-Shipment Forensic Fraud Detection & Statutory Compliance Intelligence Platform.
          </span>
          <span className="font-mono text-[11px] text-stone-500">
            SHA-256 Tamper-Evident Ledger &bull; Zero-Trust Verifier &bull; CBIC Statutory Engine
          </span>
        </div>
      </footer>
    </div>
  );
}
