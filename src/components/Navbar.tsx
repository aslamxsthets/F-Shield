import React from 'react';
import {
  ShieldAlert, Activity, GitBranch, AlertTriangle, FileText,
  Scale, Users, Settings, Database, Cpu, Lock, Link2, RefreshCw,
  ScrollText, Sparkles
} from 'lucide-react';
import { SystemSettings, User, UserRole } from '../types';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  currentUser: User;
  onSwitchRole: (role: UserRole) => void;
  settings: SystemSettings | null;
  wsConnected: boolean;
  onResetDemo: () => void;
  onOpenAudit: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  onSwitchRole,
  settings,
  wsConnected,
  onResetDemo,
  onOpenAudit,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'live-booking', label: 'Live Bookings', icon: ShieldAlert, highlight: true },
    { id: 'topology', label: 'Topology', icon: GitBranch },
    { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
    { id: 'evidence', label: 'Evidence', icon: Lock },
    { id: 'compliance', label: 'Compliance', icon: Scale },
    { id: 'shippers', label: 'Shippers', icon: Users },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="bg-stone-900 border-b border-stone-800 text-stone-100 sticky top-0 z-50 shadow-md">
      {/* Top Utility Bar with System Status Indicators */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex flex-wrap items-center justify-between text-xs border-b border-stone-800/80">
        <div className="flex items-center space-x-3 text-stone-400">
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-mono text-[11px] text-stone-300">CORE v2.4</span>
          </span>

          <span className="text-stone-700">|</span>

          {/* AI Status */}
          <span className="flex items-center space-x-1" title="Gemini GenAI Explanation Engine">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>AI:</span>
            <span className={`font-semibold ${settings?.features.genai_enabled ? 'text-amber-400' : 'text-stone-400'}`}>
              {settings?.features.genai_enabled ? 'ONLINE' : 'OFFLINE'}
            </span>
          </span>

          {/* ML Status */}
          <span className="flex items-center space-x-1" title="Isolation Forest Multivariate Anomaly Engine">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>ML:</span>
            <span className={`font-semibold ${settings?.features.ml_enabled ? 'text-blue-400' : 'text-stone-400'}`}>
              {settings?.features.ml_enabled ? 'ENABLED' : 'DISABLED'}
            </span>
          </span>

          {/* Fallback Level */}
          <span className="flex items-center space-x-1">
            <span className="text-stone-400">Policy:</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
              !settings?.features.ml_enabled
                ? 'bg-amber-900/60 text-amber-300 border border-amber-700/60'
                : 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
            }`}>
              {!settings?.features.ml_enabled ? 'LEVEL 2 FALLBACK' : 'LEVEL 1 AI/ML'}
            </span>
          </span>

          {/* Blockchain Anchor Mode */}
          <span className="flex items-center space-x-1" title="Forensic cryptographic anchor state">
            <Link2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Chain:</span>
            <span className="font-semibold text-sky-400 font-mono text-[11px]">
              {settings?.features.blockchain_mode === 'SIMULATED' ? 'SIMULATED' : 'CONNECTED'}
            </span>
          </span>

          {/* Database */}
          <span className="hidden md:flex items-center space-x-1">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400">DB CONNECTED</span>
          </span>

          {/* WebSocket */}
          <span className="hidden lg:flex items-center space-x-1">
            <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
            <span className={wsConnected ? 'text-stone-300' : 'text-amber-400'}>
              {wsConnected ? 'LIVE FEED' : 'RECONNECTING'}
            </span>
          </span>
        </div>

        {/* Right side controls: Role Switcher & Audit & Reset */}
        <div className="flex items-center space-x-2 mt-1 sm:mt-0">
          <button
            onClick={onOpenAudit}
            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] border border-stone-700 transition"
            title="View Tamper-Evident Audit Trail"
          >
            <ScrollText className="w-3 h-3 text-stone-400" />
            <span>Audit Trail</span>
          </button>

          <button
            onClick={onResetDemo}
            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-amber-300 text-[11px] border border-stone-700 transition"
            title="Reset pristine seed data & scenarios"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset Demo</span>
          </button>

          {/* Role Switcher */}
          <div className="flex items-center space-x-1.5 pl-2 border-l border-stone-800">
            <span className="text-stone-400">Role:</span>
            <select
              value={currentUser.role}
              onChange={(e) => onSwitchRole(e.target.value as UserRole)}
              className="bg-stone-800 border border-stone-700 text-stone-200 text-xs rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
            >
              <option value="ADMIN">ADMIN ({currentUser.role === 'ADMIN' ? 'Active' : 'Dr. Vance'})</option>
              <option value="FRAUD_ANALYST">FRAUD_ANALYST (Marcus S.)</option>
              <option value="COMPLIANCE_ANALYST">COMPLIANCE_ANALYST (Ananya S.)</option>
              <option value="AUDITOR">AUDITOR (Robert Chen)</option>
              <option value="VIEWER">VIEWER (Read-Only)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectTab('dashboard')}>
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-600 to-orange-700 flex items-center justify-center shadow-inner border border-amber-500/30">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-lg tracking-tight font-bold text-stone-100 font-sans">FraudShield</span>
                <span className="px-1.5 py-0.2 rounded bg-amber-900/60 text-amber-400 text-[10px] font-semibold border border-amber-700/50">
                  ENTERPRISE
                </span>
              </div>
              <p className="text-[10px] text-stone-400 leading-none">Pre-Shipment Forensic Intelligence</p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id || (item.id === 'dashboard' && currentTab === 'overview');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-600 text-white shadow-xs font-bold'
                      : item.highlight
                      ? 'text-amber-400 hover:bg-stone-800 hover:text-amber-300'
                      : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.highlight ? 'text-amber-400' : 'text-stone-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};
