import React, { useEffect, useState } from 'react';
import {
  FileText, Download, ShieldCheck, RefreshCw, FileCheck, ExternalLink,
  ChevronDown, AlertTriangle, Building2, Lock, CheckCircle, ArrowRight,
  Filter, Sparkles, Award
} from 'lucide-react';
import { api } from '../services/api';
import { ReportRecord, Incident, Booking, Shipper } from '../types';

export const ReportsPage: React.FC = () => {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [shippers, setShippers] = useState<Shipper[]>([]);
  const [loading, setLoading] = useState(true);
  const [compilingType, setCompilingType] = useState<string | null>(null);

  // Selected entities for report compilation
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('');
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [selectedShipperId, setSelectedShipperId] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  const fetchData = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const [reps, incs, bkgs, shps] = await Promise.all([
        api.getReports(),
        api.getIncidents(),
        api.getBookings(),
        api.getShippers(),
      ]);
      setReports(reps);
      setIncidents(incs);
      setBookings(bkgs);
      setShippers(shps);

      if (incs.length > 0 && !selectedIncidentId) {
        setSelectedIncidentId(incs[0].id);
      }
      if (bkgs.length > 0 && !selectedBookingId) {
        setSelectedBookingId(bkgs[0].id);
      }
      const approvedShp = shps.find(s => s.status === 'ACTIVE' || s.kyc_status === 'VERIFIED');
      if (approvedShp && !selectedShipperId) {
        setSelectedShipperId(approvedShp.id);
      } else if (shps.length > 0 && !selectedShipperId) {
        setSelectedShipperId(shps[0].id);
      }
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);
  }, []);

  const triggerDownload = (url: string, filename?: string) => {
    const link = document.createElement('a');
    link.href = url;
    if (filename) link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compile Fraud Report for Selected Incident
  const handleCompileFraudReport = async () => {
    if (!selectedIncidentId) {
      alert('Please select an incident case to compile.');
      return;
    }
    setCompilingType('FRAUD');
    try {
      const rep = await api.generateFraudReport(selectedIncidentId);
      await fetchData(false);
      triggerDownload(rep.download_url, rep.filename);
    } catch (err: any) {
      alert(`Fraud report compilation failed: ${err.message}`);
    } finally {
      setCompilingType(null);
    }
  };

  // Compile Compliance Report for Selected Booking / Case
  const handleCompileComplianceReport = async () => {
    if (!selectedBookingId) {
      alert('Please select a consignment case to compile.');
      return;
    }
    setCompilingType('COMPLIANCE');
    try {
      const rep = await api.generateComplianceReport(selectedBookingId);
      await fetchData(false);
      triggerDownload(rep.download_url, rep.filename);
    } catch (err: any) {
      alert(`Compliance report compilation failed: ${err.message}`);
    } finally {
      setCompilingType(null);
    }
  };

  // Compile Shipper Approval Certificate for Selected Approved Shipper
  const handleCompileShipperApproval = async () => {
    if (!selectedShipperId) {
      alert('Please select an approved shipper to compile the accreditation certificate.');
      return;
    }
    setCompilingType('SHIPPER_APPROVAL');
    try {
      const rep = await api.generateShipperApprovalReport(selectedShipperId);
      await fetchData(false);
      triggerDownload(rep.download_url, rep.filename);
    } catch (err: any) {
      alert(`Shipper approval certificate generation failed: ${err.message}`);
    } finally {
      setCompilingType(null);
    }
  };

  const filteredReports = activeFilter === 'ALL'
    ? reports
    : reports.filter(r => r.report_type === activeFilter);

  const approvedShippersList = shippers.filter(s => s.status === 'ACTIVE' || s.kyc_status === 'VERIFIED');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 flex items-center space-x-2">
            <span>Forensic & Statutory Dossier Compiler</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-200 text-stone-700 font-mono font-bold">
              {reports.length} Sealed PDFs
            </span>
          </h1>
          <p className="text-sm text-stone-600 mt-0.5">
            Select any incident investigation case, consignment booking, or approved shipper to compile official PDF audit dossiers.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchData(false)}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold border border-stone-300 transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Archive</span>
        </button>
      </div>

      {/* Interactive Report Compilation Control Center */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Fraud Investigation Dossier */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-rose-800">
              <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center">
                <FileText className="w-4 h-4 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-stone-900">Fraud Investigation Dossier</h3>
                <span className="text-[10px] text-stone-500 font-mono">CRIMINAL FORENSIC RECORD</span>
              </div>
            </div>
            <p className="text-xs text-stone-600 leading-snug">
              Complete reconstruction with cryptographic evidence timeline, ML anomaly scores, and decision rationale.
            </p>

            {/* Choose Incident Dropdown */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                Select Incident / Case
              </label>
              <select
                value={selectedIncidentId}
                onChange={(e) => setSelectedIncidentId(e.target.value)}
                className="w-full bg-stone-50 border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-1 focus:ring-amber-500 font-mono"
              >
                {incidents.map((inc) => (
                  <option key={inc.id} value={inc.id}>
                    {inc.incident_number} — {inc.shipper_id} (Risk {inc.risk_score}/100, {inc.decision})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCompileFraudReport}
            disabled={compilingType !== null || incidents.length === 0}
            className="w-full py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer mt-2"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>{compilingType === 'FRAUD' ? 'Compiling PDF...' : 'Download Fraud Dossier PDF'}</span>
          </button>
        </div>

        {/* Card 2: Regulatory Compliance Verification Report */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-purple-800">
              <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center">
                <FileCheck className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-stone-900">Customs Compliance Report</h3>
                <span className="text-[10px] text-stone-500 font-mono">CUSTOMS ACT & COURIER REGS</span>
              </div>
            </div>
            <p className="text-xs text-stone-600 leading-snug">
              Statutory port customs declaration evaluation under Courier Regulations 1998 and FEMA reporting limits.
            </p>

            {/* Choose Booking / Consignment Dropdown */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                Select Consignment / Case
              </label>
              <select
                value={selectedBookingId}
                onChange={(e) => setSelectedBookingId(e.target.value)}
                className="w-full bg-stone-50 border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-1 focus:ring-amber-500 font-mono"
              >
                {bookings.map((bkg) => (
                  <option key={bkg.id} value={bkg.id}>
                    {bkg.booking_reference} — {bkg.destination.split('-')[1]} ({bkg.weight_kg}kg, ₹{(bkg.declared_value_inr || (bkg.declared_value_usd ? bkg.declared_value_usd * 83 : 0)).toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCompileComplianceReport}
            disabled={compilingType !== null || bookings.length === 0}
            className="w-full py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer mt-2"
          >
            <Download className="w-3.5 h-3.5 text-amber-300" />
            <span>{compilingType === 'COMPLIANCE' ? 'Compiling PDF...' : 'Download Compliance Report PDF'}</span>
          </button>
        </div>

        {/* Card 3: Approved Shipper Accreditation Certificate */}
        <div className="bg-white border border-emerald-200 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-emerald-800">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <Award className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-stone-900">Shipper Approval Certificate</h3>
                <span className="text-[10px] text-emerald-700 font-mono font-bold">KYC ACCREDITATION REPORT</span>
              </div>
            </div>
            <p className="text-xs text-stone-600 leading-snug">
              Official carrier dispatch clearance certificate verifying authorized corridors, weight baselines, and KYC IEC credentials.
            </p>

            {/* Choose Approved Shipper Dropdown */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                Select Approved Shipper
              </label>
              <select
                value={selectedShipperId}
                onChange={(e) => setSelectedShipperId(e.target.value)}
                className="w-full bg-emerald-50/50 border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-1 focus:ring-emerald-500 font-mono"
              >
                {approvedShippersList.map((shp) => (
                  <option key={shp.id} value={shp.id}>
                    {shp.company_name} — {shp.id} ({shp.trust_score}/100 Trust &bull; {shp.kyc_status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCompileShipperApproval}
            disabled={compilingType !== null || approvedShippersList.length === 0}
            className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer mt-2"
          >
            <Download className="w-3.5 h-3.5 text-amber-300" />
            <span>{compilingType === 'SHIPPER_APPROVAL' ? 'Compiling PDF...' : 'Download Approval Report PDF'}</span>
          </button>
        </div>
      </div>

      {/* Reports Table & Archive */}
      <div className="bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Table Header with Filter Tabs */}
        <div className="px-6 py-4 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-stone-900">Compiled PDF Dossier Archive</h3>
            <p className="text-xs text-stone-500">
              Cryptographically verified PDF documents generated on-demand with SHA-256 integrity signatures.
            </p>
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs">
            {['ALL', 'FRAUD_INVESTIGATION', 'COMPLIANCE_VERIFICATION', 'SHIPPER_APPROVAL', 'EVIDENCE_MANIFEST'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveFilter(tab)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeFilter === tab
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {tab === 'ALL' ? 'All Records' :
                 tab === 'FRAUD_INVESTIGATION' ? 'Fraud' :
                 tab === 'COMPLIANCE_VERIFICATION' ? 'Compliance' :
                 tab === 'SHIPPER_APPROVAL' ? 'Shipper Approval' : 'Evidence'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-stone-600 font-semibold">
                <th className="py-3 px-4">Report Title</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Sealed SHA-256 Hash</th>
                <th className="py-3 px-4">File Size</th>
                <th className="py-3 px-4">Generated At</th>
                <th className="py-3 px-4 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-stone-400">
                    <FileText className="w-8 h-8 mx-auto text-stone-300 mb-2" />
                    <p className="font-semibold text-stone-700">No Reports Match the Filter</p>
                    <p className="text-xs text-stone-400 mt-0.5">Use the compilation cards above to generate a new PDF.</p>
                  </td>
                </tr>
              ) : (
                filteredReports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-amber-50/30 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-stone-900">{rep.title}</div>
                      <div className="font-mono text-[10px] text-stone-500">{rep.filename}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        rep.report_type === 'FRAUD_INVESTIGATION' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                        rep.report_type === 'COMPLIANCE_VERIFICATION' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                        rep.report_type === 'SHIPPER_APPROVAL' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        'bg-sky-100 text-sky-800 border border-sky-200'
                      }`}>
                        {rep.report_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[10px] text-stone-600">
                      {rep.sha256_hash.substring(0, 24)}...
                    </td>
                    <td className="py-3 px-4 font-mono text-stone-600">
                      {Math.round(rep.file_size_bytes / 1024)} KB
                    </td>
                    <td className="py-3 px-4 text-stone-500">
                      {new Date(rep.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={rep.download_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-400" />
                        <span>Download PDF</span>
                      </a>
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
