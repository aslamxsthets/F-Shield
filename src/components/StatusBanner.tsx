import React from 'react';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import { SystemSettings } from '../types';

interface StatusBannerProps {
  settings: SystemSettings | null;
  onNavigateSettings: () => void;
  onResetDemo: () => void;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({
  settings,
  onNavigateSettings,
  onResetDemo,
}) => {
  const isMlDisabled = settings?.features.ml_enabled === false;
  const isFallbackLevel2 = settings?.fallback_policy === 'FORCE_LEVEL_2' || isMlDisabled;
  const isSimulatedBlockchain = settings?.features.blockchain_mode === 'SIMULATED';

  return (
    <div className="bg-stone-100 border-b border-stone-200 text-stone-800 text-xs px-4 py-2 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1.5 font-medium">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong className="text-stone-900">SIMULATED DEMO DATA ACTIVE:</strong> Real-time algorithms running against authenticated baseline database.
          </span>
        </div>

        {isFallbackLevel2 && (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-semibold">
            <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
            <span>LEVEL 2 — RULE-BASED FALLBACK ACTIVE (ML Disabled)</span>
          </span>
        )}

        {isSimulatedBlockchain && (
          <span className="hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200">
            <CheckCircle className="w-3.5 h-3.5 text-sky-600" />
            <span>BLOCKCHAIN MODE: SIMULATED (Zero-trust off-chain anchor)</span>
          </span>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={onNavigateSettings}
          className="text-stone-600 hover:text-stone-900 underline font-medium cursor-pointer"
        >
          Configure Engine Weights & Policies
        </button>
        <span className="text-stone-300">|</span>
        <button
          onClick={onResetDemo}
          className="text-amber-800 hover:text-amber-950 font-medium cursor-pointer"
        >
          Reload Pristine Scenarios
        </button>
      </div>
    </div>
  );
};
