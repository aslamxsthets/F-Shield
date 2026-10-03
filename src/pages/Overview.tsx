import React, { useEffect, useState } from 'react';
import {
  ShieldAlert, AlertTriangle, CheckCircle, ShieldCheck, IndianRupee,
  TrendingUp, ArrowRight, Eye, RefreshCw, AlertOctagon, Terminal
} from 'lucide-react';
import { api } from '../services/api';
import { DashboardMetrics, Incident } from '../types';

interface OverviewProps {
  onNavigate: (tab: string, incidentId?: string) => void;
}

export const Overview: React.FC<OverviewProps> = ({ onNavigate }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [m, inc] = await Promise.all([
        api.getMetrics(),
        api.getIncidents(),
      ]);
      setMetrics(m);
      setRecentIncidents(inc.slice(0, 5));
    } catch (err) {
      console.error('Failed to load overview data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const unsub = api.subscribeToWs((evt) => {
      if (evt.type === 'BOOKING_SCREENED' || evt.type === 'INCIDENT_CREATED' || evt.type === 'DEMO_RESET') {
        fetchData();
      }
    });
    return unsub;
  }, []);

  if (loading && !metrics) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-stone-500">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin text-amber-600 mb-3" />
        <p className="text-sm font-medium">Loading F-Shield intelligence metrics...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-stone-900 text-stone-100 p-6 rounded-2xl border border-stone-800 shadow-md">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded bg-amber-500 text-stone-950 text-xs font-bold uppercase tracking-wider">
              Operational Real-Time Pipeline
            </span>
            <span className="text-xs text-stone-400">Zero-Tolerance Pre-Shipment Interception</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-white mt-1">
            Enterprise Fraud & Forensic Intelligence Command
          </h1>
          <p className="text-sm text-stone-400 max-w-2xl mt-1">
            Real-time algorithmic risk scoring, privilege abuse detection, tamper-evident SHA-256 evidence chain of custody, and multi-regime customs compliance.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => onNavigate('live-booking')}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-white rounded-lg font-medium text-sm shadow-md transition cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Screen Live Consignment</span>
          </button>
          <button
            onClick={() => onNavigate('topology')}
            className="flex items-center space-x-2 px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg font-medium text-sm border border-stone-700 transition cursor-pointer"
          >
            <span>Inspect Graph Topology</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Total Screened */}
        <div className="bg-stone-50 border border-stone-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold uppercase">
            <span>Screened</span>
            <CheckCircle className="w-4 h-4 text-stone-400" />
          </div>
          <div className="mt-2 text-2xl font-serif font-bold text-stone-900">
            {metrics?.total_screened || 0}
          </div>
          <div className="mt-1 text-xs text-stone-500">100% pre-manifest</div>
        </div>

        {/* High Risk Count */}
        <div className="bg-stone-50 border border-amber-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-amber-800 text-xs font-semibold uppercase">
            <span>High Risk</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-serif font-bold text-amber-900">
            {metrics?.high_risk_count || 0}
          </div>
          <div className="mt-1 text-xs text-amber-700 font-medium">Risk Score &gt;= 70</div>
        </div>

        {/* Blocked Count */}
        <div className="bg-stone-50 border border-rose-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-rose-800 text-xs font-semibold uppercase">
            <span>Blocked</span>
            <AlertOctagon className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-serif font-bold text-rose-900">
            {metrics?.blocked_count || 0}
          </div>
          <div className="mt-1 text-xs text-rose-700 font-medium">Carrier dispatch locked</div>
        </div>

        {/* Held for Review */}
        <div className="bg-stone-50 border border-orange-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-orange-800 text-xs font-semibold uppercase">
            <span>Held / Review</span>
            <ShieldCheck className="w-4 h-4 text-orange-600" />
          </div>
          <div className="mt-2 text-2xl font-serif font-bold text-orange-900">
            {metrics?.held_count || 0}
          </div>
          <div className="mt-1 text-xs text-orange-700">Analyst holding queue</div>
        </div>

        {/* Fraud Prevented Value */}
        <div className="bg-stone-50 border border-emerald-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold uppercase">
            <span>Fraud Prevented</span>
            <IndianRupee className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-serif font-bold text-emerald-900">
            ₹{(metrics?.fraud_prevented_value_inr || (metrics?.fraud_prevented_value_usd ? metrics.fraud_prevented_value_usd * 83 : 0)).toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-xs text-emerald-700 font-medium">Protected consignment value</div>
        </div>

        {/* Active Incidents */}
        <div className="bg-stone-50 border border-stone-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-stone-600 text-xs font-semibold uppercase">
            <span>Active Incidents</span>
            <Terminal className="w-4 h-4 text-stone-500" />
          </div>
          <div className="mt-2 text-2xl font-serif font-bold text-stone-900">
            {metrics?.active_incidents || 0}
          </div>
          <div className="mt-1 text-xs text-stone-500">Forensic investigations</div>
        </div>
      </div>

      {/* Main Charts & Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Decision Distribution Bar */}
        <div className="bg-stone-50 border border-stone-200 p-6 rounded-xl shadow-xs">
          <h2 className="text-sm font-bold font-serif text-stone-900 uppercase tracking-wider">
            Decision Distribution
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">Automated algorithmic disposition of screened bookings</p>

          <div className="mt-6 space-y-4">
            {metrics?.decision_distribution.map((d) => (
              <div key={d.decision}>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className={
                    d.decision === 'ALLOW' ? 'text-emerald-700' :
                    d.decision === 'HOLD' ? 'text-amber-700' : 'text-rose-700'
                  }>
                    {d.decision}
                  </span>
                  <span className="text-stone-600 font-mono">
                    {d.count} ({d.percentage}%)
                  </span>
                </div>
                <div className="w-full h-3 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      d.decision === 'ALLOW' ? 'bg-emerald-600' :
                      d.decision === 'HOLD' ? 'bg-amber-500' : 'bg-rose-600'
                    }`}
                    style={{ width: `${d.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-4 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
            <span>Average Composite Risk Score:</span>
            <span className="font-mono font-bold text-stone-800 text-sm">{metrics?.average_risk_score}/100</span>
          </div>
        </div>

        {/* Top Fraud Signals Triggered */}
        <div className="bg-stone-50 border border-stone-200 p-6 rounded-xl shadow-xs">
          <h2 className="text-sm font-bold font-serif text-stone-900 uppercase tracking-wider">
            Critical Risk Signals Triggered
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">Heuristic, permission, and relationship alerts</p>

          <div className="mt-4 space-y-2.5">
            {metrics?.signal_frequency && metrics.signal_frequency.length > 0 ? (
              metrics.signal_frequency.map((sig) => (
                <div key={sig.signal} className="flex items-center justify-between p-2 rounded-lg bg-white border border-stone-200 text-xs">
                  <div>
                    <div className="font-mono font-bold text-stone-900">{sig.signal}</div>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 font-medium">
                      {sig.category}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded font-mono font-bold bg-amber-100 text-amber-900 text-xs">
                      {sig.count}x
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-stone-400 py-6 text-center">No anomalies detected in recent stream.</p>
            )}
          </div>
        </div>

        {/* Suspicious Infrastructure Highlights */}
        <div className="bg-stone-50 border border-stone-200 p-6 rounded-xl shadow-xs">
          <h2 className="text-sm font-bold font-serif text-stone-900 uppercase tracking-wider">
            Flagged Infrastructure & Destinations
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">Reused devices, Tor proxies, and non-approved ports</p>

          <div className="mt-4 space-y-3">
            <div>
              <div className="text-[11px] font-semibold text-stone-500 uppercase">Suspicious Devices:</div>
              <div className="mt-1 space-y-1.5">
                {metrics?.top_suspicious_devices.map((dev) => (
                  <div key={dev.device_id} className="p-2 bg-stone-100 rounded text-xs border border-stone-200">
                    <div className="font-mono font-bold text-rose-900 flex items-center justify-between">
                      <span>{dev.device_id}</span>
                      <span className="text-[10px] text-stone-500">{dev.count} accounts</span>
                    </div>
                    <div className="text-[11px] text-stone-600 truncate mt-0.5">{dev.flag}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-stone-200">
              <div className="text-[11px] font-semibold text-stone-500 uppercase">High-Risk Destination Corridors:</div>
              <div className="mt-1 space-y-1.5">
                {metrics?.top_suspicious_destinations.map((dest) => (
                  <div key={dest.destination} className="flex justify-between items-center p-1.5 bg-white rounded border border-stone-200 text-xs">
                    <span className="font-medium text-stone-800">{dest.destination}</span>
                    <span className="font-mono font-bold text-amber-800">Avg Risk {dest.risk_avg}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Forensic Incidents Table */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-stone-100 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold font-serif text-stone-900 uppercase tracking-wider">
              Active Forensic Incidents Requiring Investigation
            </h2>
            <p className="text-xs text-stone-500">Live quarantine holding list with attack path reconstruction</p>
          </div>
          <button
            onClick={() => onNavigate('incidents')}
            className="flex items-center space-x-1 text-xs font-semibold text-amber-700 hover:text-amber-900"
          >
            <span>View All Incidents</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-stone-600 font-semibold">
                <th className="py-3 px-4">Incident ID</th>
                <th className="py-3 px-4">Booking Ref</th>
                <th className="py-3 px-4">Shipper</th>
                <th className="py-3 px-4">Risk Score</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Decision</th>
                <th className="py-3 px-4">Assigned Analyst</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 bg-white">
              {recentIncidents.map((inc) => (
                <tr key={inc.id} className="hover:bg-amber-50/50 transition">
                  <td className="py-3 px-4 font-mono font-bold text-stone-900">{inc.incident_number}</td>
                  <td className="py-3 px-4 font-mono text-stone-600">{inc.booking?.booking_reference || inc.booking_id}</td>
                  <td className="py-3 px-4 font-medium text-stone-800">{inc.shipper?.company_name || inc.shipper_id}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
                      {inc.risk_score}/100
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      inc.severity === 'CRITICAL' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-stone-950'
                    }`}>
                      {inc.severity}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-rose-700">{inc.decision}</td>
                  <td className="py-3 px-4 text-stone-600">{inc.assigned_to || 'Unassigned'}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => onNavigate('incidents', inc.id)}
                      className="inline-flex items-center space-x-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium cursor-pointer shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Investigate</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
