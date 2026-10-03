import React, { useEffect, useState } from 'react';
import {
  ShieldAlert, AlertTriangle, CheckCircle, ShieldCheck, IndianRupee,
  TrendingUp, ArrowRight, Eye, RefreshCw, AlertOctagon, Terminal,
  Cpu, Sparkles, Lock, Link2, Compass, Layers, FileText, Activity,
  ChevronRight, ExternalLink, Filter, X, Box, Building2, Scale
} from 'lucide-react';
import { api } from '../services/api';
import { DashboardMetrics, Incident, Booking } from '../types';

interface DashboardProps {
  onNavigate: (tab: string, incidentId?: string) => void;
}

export const DashboardPage: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBookingPreview, setSelectedBookingPreview] = useState<Booking | null>(null);
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | '30d'>('24h');

  const formatPort = (portCode: string) => {
    if (!portCode) return 'UNKNOWN';
    const parts = portCode.split('-');
    return parts.length >= 2 ? parts[1] : portCode;
  };

  const fetchData = async (isInitial = false) => {
    try {
      if (isInitial && !metrics) setLoading(true);
      const [m, inc, bkg] = await Promise.all([
        api.getMetrics(),
        api.getIncidents(),
        api.getBookings(),
      ]);
      setMetrics(m);
      setRecentIncidents(inc.slice(0, 5));
      setRecentBookings(bkg.slice(0, 6));
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);
    const unsub = api.subscribeToWs((evt) => {
      if (evt.type === 'BOOKING_SCREENED' || evt.type === 'INCIDENT_CREATED' || evt.type === 'DEMO_RESET') {
        fetchData(false);
      }
    });
    return unsub;
  }, []);

  const totalScreened = metrics?.total_screened || 0;
  const blockedCount = metrics?.blocked_count || 0;
  const heldCount = metrics?.held_count || 0;
  const allowedCount = metrics?.allowed_count || 0;
  const preventedRupees = metrics?.fraud_prevented_value_inr || (metrics?.fraud_prevented_value_usd ? metrics.fraud_prevented_value_usd * 83 : 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner: Executive Title & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-mono font-bold text-stone-500 uppercase tracking-wider">
              OPERATIONAL COMMAND & FORENSIC INTELLIGENCE
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 mt-0.5">
            Security Overview & Consignment Dashboard
          </h1>
          <p className="text-sm text-stone-600">
            Real-time pre-shipment risk screening, automated customs compliance, and cryptographic integrity monitoring.
          </p>
        </div>

        {/* Action strip & Time filter */}
        <div className="flex items-center space-x-2">
          {/* Time range selector */}
          <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-xs">
            <button
              type="button"
              onClick={() => setTimeFilter('24h')}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                timeFilter === '24h' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Last 24h
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('7d')}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                timeFilter === '7d' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('30d')}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                timeFilter === '30d' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchData(false)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold border border-stone-300 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
        {/* Total Screened */}
        <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold uppercase tracking-wider">
            <span>Screened</span>
            <Activity className="w-4 h-4 text-stone-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-stone-900">{totalScreened}</div>
          <div className="text-[11px] text-stone-500">Total consignments</div>
        </div>

        {/* Carrier Dispatch Blocked */}
        <div className="bg-white border border-rose-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-rose-800 text-[11px] font-bold uppercase tracking-wider">
            <span>Blocked Cargo</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-900">{blockedCount}</div>
          <div className="text-[11px] text-rose-700 font-medium">Carrier manifest locked</div>
        </div>

        {/* Quarantined / Held for Review */}
        <div className="bg-white border border-amber-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-amber-800 text-[11px] font-bold uppercase tracking-wider">
            <span>Held / Review</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-900">{heldCount}</div>
          <div className="text-[11px] text-amber-700">Analyst review queue</div>
        </div>

        {/* Cleared / Allowed */}
        <div className="bg-white border border-emerald-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-emerald-800 text-[11px] font-bold uppercase tracking-wider">
            <span>Allowed</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-900">{allowedCount}</div>
          <div className="text-[11px] text-emerald-700">Dispatched safely</div>
        </div>

        {/* Fraud Prevented Value (In Rupees ₹) */}
        <div className="bg-white border border-emerald-300 p-4 rounded-2xl shadow-xs space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-emerald-800 text-[11px] font-bold uppercase tracking-wider">
            <span>Fraud Intercepted</span>
            <IndianRupee className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-900 truncate">
            ₹{preventedRupees.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium">Protected cargo value</div>
        </div>

        {/* Active Incidents */}
        <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-xs space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-stone-600 text-[11px] font-bold uppercase tracking-wider">
            <span>Incidents</span>
            <Terminal className="w-4 h-4 text-stone-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-stone-900">
            {metrics?.active_incidents || 0}
          </div>
          <div className="text-[11px] text-stone-500">Forensic cases open</div>
        </div>
      </div>

      {/* Main Grid: Live Consignment Stream & Corridor Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Recent Screened Consignments & Attack Path CTA */}
        <div className="lg:col-span-8 space-y-6">
          {/* Quick Operator Action Strip */}
          <div className="p-4 bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 rounded-2xl text-white shadow-md flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center space-x-1.5 text-xs text-amber-400 font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Pre-Shipment Interception Terminal</span>
              </div>
              <h3 className="font-bold text-base text-white">Consignment Screening & Threat Correlation</h3>
              <p className="text-xs text-stone-300">
                Run immediate risk profiling or trace multidimensional entity relationship topologies.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => onNavigate('live-booking')}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center space-x-1"
              >
                <span>Screen Consignment</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('topology')}
                className="px-3.5 py-2 bg-stone-700/80 hover:bg-stone-700 text-white rounded-xl text-xs font-semibold transition border border-stone-600 cursor-pointer flex items-center space-x-1"
              >
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>View Topology</span>
              </button>
            </div>
          </div>

          {/* Screened Consignments Feed Table */}
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-stone-900 flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-amber-600" />
                  <span>Real-Time Consignment Screening Stream</span>
                </h3>
                <p className="text-xs text-stone-500">
                  Pre-shipment verification decisions evaluated before carrier loading.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('live-booking')}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center space-x-1 cursor-pointer"
              >
                <span>Launch Screener</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-stone-600 font-semibold">
                    <th className="py-2.5 px-4">Booking Ref</th>
                    <th className="py-2.5 px-4">Shipper / Account</th>
                    <th className="py-2.5 px-4">Corridor Route</th>
                    <th className="py-2.5 px-4">Weight</th>
                    <th className="py-2.5 px-4">Value (₹)</th>
                    <th className="py-2.5 px-4">Disposition</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {recentBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-amber-50/30 transition">
                      <td className="py-3 px-4 font-mono font-bold text-stone-900">{b.booking_reference}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-stone-800">{b.shipper_id}</div>
                        <div className="font-mono text-[10px] text-stone-500">{b.account_id}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-stone-700">
                        {formatPort(b.origin)} &rarr; {formatPort(b.destination)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-stone-900">{b.weight_kg} kg</td>
                      <td className="py-3 px-4 font-mono text-stone-700">
                        ₹{(b.declared_value_inr || (b.declared_value_usd ? b.declared_value_usd * 83 : 0)).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.status === 'BLOCKED'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : b.status === 'HELD'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedBookingPreview(b)}
                          className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md font-semibold text-[11px] transition border border-stone-300 cursor-pointer"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Active Threats, Corridors, and System Health */}
        <div className="lg:col-span-4 space-y-6">
          {/* Active Forensic Incidents */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="font-bold text-sm text-stone-900 flex items-center space-x-1.5">
                <AlertOctagon className="w-4 h-4 text-rose-600" />
                <span>Active Forensic Cases</span>
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-50 text-rose-800 font-bold border border-rose-200">
                {recentIncidents.length} Under Investigation
              </span>
            </div>

            <div className="space-y-2.5">
              {recentIncidents.map((inc) => (
                <div
                  key={inc.id}
                  onClick={() => onNavigate('incidents', inc.id)}
                  className="p-3 bg-stone-50 hover:bg-amber-50/50 rounded-xl border border-stone-200 cursor-pointer transition space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-stone-900 text-xs">{inc.incident_number}</span>
                    <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                      Risk {inc.risk_score}/100
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-600 truncate">
                    Shipper: {inc.shipper_id} &bull; Booking: {inc.booking_id}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-stone-500 pt-1 border-t border-stone-200/50">
                    <span className="font-mono font-semibold text-rose-700">{inc.severity} SEVERITY</span>
                    <span className="text-amber-700 font-semibold flex items-center space-x-0.5">
                      <span>Open Workspace</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onNavigate('incidents')}
              className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition border border-stone-300 flex items-center justify-center space-x-1 cursor-pointer"
            >
              <span>View All Investigation Incidents</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* High-Risk Corridors Radar */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-stone-900 flex items-center space-x-1.5 border-b border-stone-200 pb-3">
              <Compass className="w-4 h-4 text-stone-600" />
              <span>Transit Corridor Risk Radar</span>
            </h3>

            <div className="space-y-2 text-xs">
              {(metrics?.top_suspicious_destinations || []).map((dest) => (
                <div key={dest.destination} className="p-2.5 bg-stone-50 rounded-lg border border-stone-200 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-mono font-bold text-stone-800">{dest.destination}</span>
                    <div className="text-[10px] text-stone-500">{dest.count} shipments monitored</div>
                  </div>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                    dest.risk_avg >= 70 ? 'bg-rose-100 text-rose-800' :
                    dest.risk_avg >= 40 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {dest.risk_avg} Avg Risk
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Booking Quick-Inspect Modal */}
      {selectedBookingPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-300 w-full max-w-lg overflow-hidden text-xs">
            <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                  CONSIGNMENT DOSSIER
                </span>
                <h3 className="font-bold text-base mt-0.5">
                  Ref: {selectedBookingPreview.booking_reference}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBookingPreview(null)}
                className="p-1 hover:bg-stone-800 rounded text-stone-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-stone-200 pb-2">
                <span className="text-stone-500">Shipper ID:</span>
                <span className="font-bold text-stone-900">{selectedBookingPreview.shipper_id}</span>
              </div>
              <div className="flex justify-between border-b border-stone-200 pb-2">
                <span className="text-stone-500">Origin &rarr; Destination:</span>
                <span className="font-bold text-stone-900">{selectedBookingPreview.origin} &rarr; {selectedBookingPreview.destination}</span>
              </div>
              <div className="flex justify-between border-b border-stone-200 pb-2">
                <span className="text-stone-500">Consignment Weight:</span>
                <span className="font-bold text-stone-900">{selectedBookingPreview.weight_kg} kg</span>
              </div>
              <div className="flex justify-between border-b border-stone-200 pb-2">
                <span className="text-stone-500">Declared Value:</span>
                <span className="font-bold text-stone-900">
                  ₹{(selectedBookingPreview.declared_value_inr || (selectedBookingPreview.declared_value_usd ? selectedBookingPreview.declared_value_usd * 83 : 0)).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between border-b border-stone-200 pb-2">
                <span className="text-stone-500">Service Tier:</span>
                <span className="font-bold text-stone-900">{selectedBookingPreview.service_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Quarantine Status:</span>
                <span className={`font-bold ${
                  selectedBookingPreview.status === 'BLOCKED' ? 'text-rose-700' : 'text-emerald-700'
                }`}>
                  {selectedBookingPreview.status}
                </span>
              </div>
            </div>

            <div className="px-6 py-3 bg-stone-100 border-t border-stone-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setSelectedBookingPreview(null);
                  onNavigate('compliance');
                }}
                className="px-3 py-1.5 bg-white hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold border border-stone-300 transition cursor-pointer"
              >
                Inspect Compliance Rules
              </button>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBookingPreview(null);
                    onNavigate('live-booking');
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Screen Similar Cargo
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBookingPreview(null)}
                  className="px-4 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
