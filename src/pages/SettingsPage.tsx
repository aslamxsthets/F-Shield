import React, { useEffect, useState } from 'react';
import { Settings, Save, RefreshCw, Cpu, Sparkles, Link2, ShieldAlert, Check } from 'lucide-react';
import { api } from '../services/api';
import { SystemSettings } from '../types';

interface SettingsPageProps {
  onSettingsUpdated: (newSettings: SystemSettings) => void;
  onResetDemo: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onSettingsUpdated, onResetDemo }) => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getSettings();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      onSettingsUpdated(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-stone-500">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin text-amber-600 mb-3" />
        <p className="text-sm font-medium">Loading FraudShield system configuration...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-bold text-stone-900">
          Fraud Engine & System Configuration
        </h1>
        <p className="text-sm text-stone-600">
          Calibrate risk weights, decision thresholds, AI/ML feature flags, and multi-level fallback policies.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-semibold flex items-center space-x-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Configuration saved successfully. Audit record created and real-time engine synchronized.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8 text-xs">
        {/* Risk Component Weights */}
        <div className="bg-stone-50 border border-stone-200 p-6 rounded-2xl shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold font-serif text-stone-900 uppercase tracking-wider">
              1. Risk Component Weight Calibration (Must sum to ~1.00)
            </h2>
            <p className="text-stone-500 text-[11px]">Normalized risk scoring aggregation weights</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Identity & Permission (20%)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.risk_weights.identity_permission}
                onChange={(e) => setSettings({
                  ...settings,
                  risk_weights: { ...settings.risk_weights, identity_permission: parseFloat(e.target.value) || 0 }
                })}
                className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 font-mono text-xs focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Behavioral Anomaly (20%)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.risk_weights.behavior_anomaly}
                onChange={(e) => setSettings({
                  ...settings,
                  risk_weights: { ...settings.risk_weights, behavior_anomaly: parseFloat(e.target.value) || 0 }
                })}
                className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 font-mono text-xs focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Shipment Anomaly (20%)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.risk_weights.shipment_anomaly}
                onChange={(e) => setSettings({
                  ...settings,
                  risk_weights: { ...settings.risk_weights, shipment_anomaly: parseFloat(e.target.value) || 0 }
                })}
                className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 font-mono text-xs focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Payment Risk (15%)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.risk_weights.payment_risk}
                onChange={(e) => setSettings({
                  ...settings,
                  risk_weights: { ...settings.risk_weights, payment_risk: parseFloat(e.target.value) || 0 }
                })}
                className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 font-mono text-xs focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Destination Risk (10%)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.risk_weights.destination_risk}
                onChange={(e) => setSettings({
                  ...settings,
                  risk_weights: { ...settings.risk_weights, destination_risk: parseFloat(e.target.value) || 0 }
                })}
                className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 font-mono text-xs focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Statutory Compliance (15%)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.risk_weights.policy_compliance}
                onChange={(e) => setSettings({
                  ...settings,
                  risk_weights: { ...settings.risk_weights, policy_compliance: parseFloat(e.target.value) || 0 }
                })}
                className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 font-mono text-xs focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Thresholds */}
        <div className="bg-stone-50 border border-stone-200 p-6 rounded-2xl shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold font-serif text-stone-900 uppercase tracking-wider">
              2. Algorithmic Decision Thresholds (0 - 100)
            </h2>
            <p className="text-stone-500 text-[11px]">Controls when consignments are ALLOWED, HELD, or BLOCKED</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3 bg-white border border-emerald-200 rounded-xl">
              <span className="font-bold text-emerald-800 uppercase block mb-1">ALLOW Ceiling</span>
              <input
                type="number"
                value={settings.thresholds.allow_max}
                onChange={(e) => setSettings({
                  ...settings,
                  thresholds: { ...settings.thresholds, allow_max: parseInt(e.target.value) || 0 }
                })}
                className="w-full bg-stone-50 border border-stone-300 rounded px-2 py-1 font-mono font-bold text-sm"
              />
              <span className="text-[10px] text-stone-500 mt-1 block">Scores 0 to {settings.thresholds.allow_max}: Auto Allow</span>
            </div>

            <div className="p-3 bg-white border border-amber-200 rounded-xl">
              <span className="font-bold text-amber-800 uppercase block mb-1">HOLD / REVIEW Ceiling</span>
              <input
                type="number"
                value={settings.thresholds.hold_max}
                onChange={(e) => setSettings({
                  ...settings,
                  thresholds: { ...settings.thresholds, hold_max: parseInt(e.target.value) || 0 }
                })}
                className="w-full bg-stone-50 border border-stone-300 rounded px-2 py-1 font-mono font-bold text-sm"
              />
              <span className="text-[10px] text-stone-500 mt-1 block">Scores {settings.thresholds.allow_max + 1} to {settings.thresholds.hold_max}: Manual Holding</span>
            </div>

            <div className="p-3 bg-white border border-rose-200 rounded-xl">
              <span className="font-bold text-rose-800 uppercase block mb-1">BLOCK Floor</span>
              <input
                type="number"
                value={settings.thresholds.block_min}
                onChange={(e) => setSettings({
                  ...settings,
                  thresholds: { ...settings.thresholds, block_min: parseInt(e.target.value) || 0 }
                })}
                className="w-full bg-stone-50 border border-stone-300 rounded px-2 py-1 font-mono font-bold text-sm"
              />
              <span className="text-[10px] text-stone-500 mt-1 block">Scores &gt;= {settings.thresholds.block_min}: Quarantined</span>
            </div>
          </div>
        </div>

        {/* Feature Flags & Fallback Overrides */}
        <div className="bg-stone-50 border border-stone-200 p-6 rounded-2xl shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold font-serif text-stone-900 uppercase tracking-wider">
              3. Feature Toggles & 3-Level Fallback Policy
            </h2>
            <p className="text-stone-500 text-[11px]">System never fails open. Disabling AI or ML activates Level 2 deterministic fallback.</p>
          </div>

          <div className="space-y-3">
            {/* ML Toggle */}
            <div className="flex items-center justify-between p-3 bg-white border border-stone-200 rounded-xl">
              <div className="flex items-center space-x-3">
                <Cpu className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="font-bold text-stone-900">Isolation Forest ML Anomaly Engine</div>
                  <div className="text-[11px] text-stone-500">
                    If disabled, system immediately operates under <strong>LEVEL 2 — RULE-BASED FALLBACK</strong>
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.features.ml_enabled}
                onChange={(e) => setSettings({
                  ...settings,
                  features: { ...settings.features, ml_enabled: e.target.checked }
                })}
                className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
              />
            </div>

            {/* GenAI Toggle */}
            <div className="flex items-center justify-between p-3 bg-white border border-stone-200 rounded-xl">
              <div className="flex items-center space-x-3">
                <Sparkles className="w-5 h-5 text-amber-600" />
                <div>
                  <div className="font-bold text-stone-900">Google GenAI Explanation Synthesis</div>
                  <div className="text-[11px] text-stone-500">
                    If disabled, system utilizes deterministic multi-factor explanation generator
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.features.genai_enabled}
                onChange={(e) => setSettings({
                  ...settings,
                  features: { ...settings.features, genai_enabled: e.target.checked }
                })}
                className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
              />
            </div>

            {/* Blockchain Mode */}
            <div className="flex items-center justify-between p-3 bg-white border border-stone-200 rounded-xl">
              <div className="flex items-center space-x-3">
                <Link2 className="w-5 h-5 text-sky-600" />
                <div>
                  <div className="font-bold text-stone-900">Cryptographic Blockchain Anchor Mode</div>
                  <div className="text-[11px] text-stone-500">
                    Select SIMULATED or configure real public RPC provider
                  </div>
                </div>
              </div>
              <select
                value={settings.features.blockchain_mode}
                onChange={(e) => setSettings({
                  ...settings,
                  features: { ...settings.features, blockchain_mode: e.target.value as 'SIMULATED' | 'REAL' }
                })}
                className="bg-stone-50 border border-stone-300 rounded px-3 py-1 font-mono font-bold text-xs"
              >
                <option value="SIMULATED">SIMULATED</option>
                <option value="REAL">REAL</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-stone-200">
          <button
            type="button"
            onClick={onResetDemo}
            className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl font-semibold text-xs transition cursor-pointer"
          >
            Reset Pristine Demo Data
          </button>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-white rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'SAVE SETTINGS'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
