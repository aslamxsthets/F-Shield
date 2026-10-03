import React, { useEffect, useState } from 'react';
import { Scale, CheckCircle, AlertTriangle, AlertCircle, FileText, ExternalLink, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { ComplianceCheck, ComplianceRule } from '../types';

export const CompliancePage: React.FC = () => {
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [checks, setChecks] = useState<ComplianceCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [generatingReport, setGeneratingReport] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [r, c] = await Promise.all([
        api.getComplianceRules(),
        api.getAllComplianceChecks(),
      ]);
      setRules(r);
      setChecks(c);
    } catch (err) {
      console.error('Failed to load compliance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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

  const handleGenerateReport = async (bookingId: string) => {
    setGeneratingReport(true);
    try {
      const report = await api.generateComplianceReport(bookingId);
      triggerDownload(report.download_url, report.filename);
    } catch (err: any) {
      alert(`Report compilation failed: ${err.message}`);
    } finally {
      setGeneratingReport(false);
    }
  };

  const filteredChecks = checks.filter(c => filterStatus === 'ALL' || c.status === filterStatus);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-stone-900">
            Statutory Shipping & Customs Regulatory Compliance Engine
          </h1>
          <p className="text-sm text-stone-600">
            Automated statutory pre-shipment clearance checks under CBIC, Merchant Shipping Act, and FEMA rules.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold border border-stone-300 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Records</span>
        </button>
      </div>

      {/* Statutory Disclaimer Notice */}
      <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-start space-x-3">
        <Scale className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold uppercase tracking-wider block mb-0.5">Automated Compliance Verification Notice</span>
          <p className="text-stone-700 leading-relaxed">
            This module generates an <strong>Automated Compliance Verification Record</strong> for enterprise carrier due diligence. 
            All checks reference verified statutory regulations. <em>This is an automated compliance verification record and is not a government-issued approval.</em>
          </p>
        </div>
      </div>

      {/* Regulatory Knowledge Base */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold font-serif text-stone-900 uppercase tracking-wider">
            Verified Statutory Knowledge Base
          </h2>
          <p className="text-xs text-stone-500">Government authorities, applicable acts, and legal requirements</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((rule) => (
            <div key={rule.id} className="p-4 bg-white border border-stone-200 rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-900 font-serif text-sm">
                  {rule.law_regulation}
                </span>
                <span className="px-2 py-0.5 rounded font-mono font-bold bg-stone-100 text-stone-700 text-[10px]">
                  {rule.section_rule}
                </span>
              </div>
              <div className="text-[11px] text-stone-500 font-semibold">{rule.authority}</div>
              <p className="text-stone-700 leading-relaxed text-[11px]">{rule.requirement}</p>
              <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-400">
                <span>Version: {rule.version}</span>
                <a
                  href={rule.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1 text-amber-700 hover:text-amber-900 font-medium"
                >
                  <span>Statute Source</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pre-Shipment Verification Records Table */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 bg-stone-100 border-b border-stone-200 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div>
            <h2 className="font-bold font-serif text-stone-900 uppercase tracking-wider">
              Automated Pre-Shipment Compliance Records
            </h2>
            <p className="text-stone-500 text-[11px]">Audit trail of statutory evaluations across screened bookings</p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-stone-500 font-semibold">Filter:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-white border border-stone-300 rounded px-2.5 py-1 text-xs font-medium"
            >
              <option value="ALL">All Outcomes</option>
              <option value="PASS">PASS</option>
              <option value="REVIEW">REVIEW</option>
              <option value="FAIL">FAIL</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-stone-600 font-semibold">
                <th className="py-3 px-4">Booking ID</th>
                <th className="py-3 px-4">Statute & Section</th>
                <th className="py-3 px-4">Requirement</th>
                <th className="py-3 px-4">Evidence Finding</th>
                <th className="py-3 px-4">Disposition</th>
                <th className="py-3 px-4 text-right">PDF Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 bg-white">
              {filteredChecks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400">
                    No compliance records found.
                  </td>
                </tr>
              ) : (
                filteredChecks.map((chk) => (
                  <tr key={chk.id} className="hover:bg-stone-50">
                    <td className="py-3 px-4 font-mono font-bold text-stone-900">{chk.booking_id}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-stone-800">{chk.law_regulation}</div>
                      <div className="text-[10px] font-mono text-stone-500">{chk.section_rule}</div>
                    </td>
                    <td className="py-3 px-4 text-stone-600 max-w-xs text-[11px] truncate" title={chk.requirement}>
                      {chk.requirement}
                    </td>
                    <td className="py-3 px-4 text-stone-800 font-medium max-w-sm text-[11px]">
                      {chk.evidence_summary}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        chk.status === 'PASS' ? 'bg-emerald-100 text-emerald-800' :
                        chk.status === 'REVIEW' ? 'bg-amber-100 text-amber-900' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {chk.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleGenerateReport(chk.booking_id)}
                        disabled={generatingReport}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold cursor-pointer shadow-xs"
                      >
                        <FileText className="w-3 h-3" />
                        <span>PDF Report</span>
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
