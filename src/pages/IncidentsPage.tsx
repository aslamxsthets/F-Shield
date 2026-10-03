import React, { useEffect, useState } from 'react';
import { AlertTriangle, Filter, Search, ArrowRight, Eye, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { Incident } from '../types';

interface IncidentsPageProps {
  onSelectIncident: (id: string) => void;
}

export const IncidentsPage: React.FC<IncidentsPageProps> = ({ onSelectIncident }) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const data = await api.getIncidents();
      setIncidents(data);
    } catch (err) {
      console.error('Failed to load incidents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const unsub = api.subscribeToWs((evt) => {
      if (evt.type === 'INCIDENT_CREATED' || evt.type === 'INCIDENT_UPDATED' || evt.type === 'DEMO_RESET') {
        fetchIncidents();
      }
    });
    return unsub;
  }, []);

  const filtered = incidents.filter(inc => {
    const matchesSev = filterSeverity === 'ALL' || inc.severity === filterSeverity;
    const matchesStat = filterStatus === 'ALL' || inc.status === filterStatus;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      inc.incident_number.toLowerCase().includes(q) ||
      (inc.booking?.booking_reference || '').toLowerCase().includes(q) ||
      (inc.shipper?.company_name || '').toLowerCase().includes(q);
    return matchesSev && matchesStat && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-stone-900">
            Forensic Incident Investigations
          </h1>
          <p className="text-sm text-stone-600">
            Pre-shipment holds, carrier dispatch quarantine records, and attack path dossiers.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchIncidents()}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold border border-stone-300 transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-stone-50 border border-stone-200 p-4 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center space-x-3 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Incident, Booking Ref, or Shipper..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-stone-300 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <span className="text-stone-500 font-semibold">Severity:</span>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="bg-white border border-stone-300 rounded px-2 py-1 text-xs font-medium"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>

          <div className="flex items-center space-x-1">
            <span className="text-stone-500 font-semibold">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-white border border-stone-300 rounded px-2 py-1 text-xs font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">OPEN</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="FALSE_POSITIVE">FALSE_POSITIVE</option>
              <option value="ESCALATED">ESCALATED</option>
            </select>
          </div>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-100 text-stone-700 font-semibold">
                <th className="py-3 px-4">Incident ID</th>
                <th className="py-3 px-4">Booking Ref</th>
                <th className="py-3 px-4">Shipper</th>
                <th className="py-3 px-4">Risk Score</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Decision</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Assigned Analyst</th>
                <th className="py-3 px-4">Opened At</th>
                <th className="py-3 px-4 text-right">Investigation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 bg-white">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-stone-400">
                    No matching incidents found.
                  </td>
                </tr>
              ) : (
                filtered.map((inc) => (
                  <tr key={inc.id} className="hover:bg-amber-50/40 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-stone-900">{inc.incident_number}</td>
                    <td className="py-3.5 px-4 font-mono text-stone-700">
                      {inc.booking?.booking_reference || inc.booking_id}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-stone-900">
                      {inc.shipper?.company_name || inc.shipper_id}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                        inc.risk_score >= 70 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {inc.risk_score}/100
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        inc.severity === 'CRITICAL' ? 'bg-rose-600 text-white' :
                        inc.severity === 'HIGH' ? 'bg-amber-600 text-white' : 'bg-stone-200 text-stone-800'
                      }`}>
                        {inc.severity}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-rose-700">{inc.decision}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                        {inc.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-stone-600">{inc.assigned_to || 'Unassigned'}</td>
                    <td className="py-3.5 px-4 font-mono text-stone-500 whitespace-nowrap">
                      {new Date(inc.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onSelectIncident(inc.id)}
                        className="inline-flex items-center space-x-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
