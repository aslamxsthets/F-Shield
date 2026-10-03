import React, { useEffect, useState } from 'react';
import { Lock, ShieldCheck, AlertTriangle, CheckCircle, RefreshCw, FileText, Link2, Eye, X } from 'lucide-react';
import { api } from '../services/api';
import { Evidence } from '../types';

export const EvidencePage: React.FC = () => {
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verificationModal, setVerificationModal] = useState<any | null>(null);
  const [selectedContent, setSelectedContent] = useState<Evidence | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  const fetchEvidence = async (isInitial = false) => {
    try {
      if (isInitial && !evidenceList.length) setLoading(true);
      const data = await api.getEvidenceList();
      setEvidenceList(data);
    } catch (err) {
      console.error('Failed to load evidence:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvidence(true);
    const unsub = api.subscribeToWs((evt) => {
      if (evt.type === 'EVIDENCE_SEALED' || evt.type === 'EVIDENCE_ANCHORED' || evt.type === 'DEMO_RESET') {
        fetchEvidence(false);
      }
    });
    return unsub;
  }, []);

  const handleVerify = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setVerifyingId(id);
    try {
      const res = await api.verifyEvidence(id);
      setVerificationModal(res);
      fetchEvidence(false);
    } catch (err: any) {
      alert(`Verification failed: ${err.message}`);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleTamperToggle = async (ev: Evidence, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      // Optimistic update
      setEvidenceList(prev => prev.map(item => 
        item.id === ev.id ? { ...item, is_tampered: !item.is_tampered } : item
      ));
      await api.tamperEvidence(ev.id, !ev.is_tampered);
      await fetchEvidence(false);
    } catch (err: any) {
      alert(`Tamper operation failed: ${err.message}`);
      fetchEvidence(false);
    }
  };

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

  const handleGenerateManifest = async () => {
    if (evidenceList.length === 0) return;
    setGeneratingReport(true);
    try {
      const firstIncidentId = evidenceList[0].incident_id;
      const report = await api.generateEvidenceManifest(firstIncidentId);
      triggerDownload(report.download_url, report.filename);
    } catch (err: any) {
      alert(`Manifest generation failed: ${err.message}`);
    } finally {
      setGeneratingReport(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-stone-900">
            Forensic Evidence Ledger & Chain of Custody
          </h1>
          <p className="text-sm text-stone-600">
            Tamper-evident SHA-256 cryptographic chain. Every inspection, risk assessment, and quarantine decision sealed sequentially.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => fetchEvidence(false)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold border border-stone-300 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Ledger</span>
          </button>

          <button
            onClick={handleGenerateManifest}
            disabled={generatingReport || evidenceList.length === 0}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>{generatingReport ? 'Compiling PDF...' : 'Download Evidence Manifest PDF'}</span>
          </button>
        </div>
      </div>

      {/* Verification Result Modal */}
      {verificationModal && (
        <div className="p-4 bg-stone-50 border border-stone-300 rounded-xl shadow-md text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 font-bold text-sm">
              {verificationModal.status === 'HASH_MATCH' ? (
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              )}
              <span className={verificationModal.status === 'HASH_MATCH' ? 'text-emerald-900' : 'text-rose-900'}>
                CRYPTOGRAPHIC VERIFICATION: {verificationModal.status}
              </span>
            </div>
            <button
              onClick={() => setVerificationModal(null)}
              className="p-1 hover:bg-stone-200 rounded text-stone-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="font-medium text-stone-700">{verificationModal.details}</p>
          <div className="p-2.5 bg-white rounded border border-stone-200 font-mono text-[10px] space-y-1 text-stone-600">
            <div>Evidence ID: <span className="font-bold text-stone-900">{verificationModal.evidence_id}</span></div>
            <div>Recomputed SHA-256: <span className="font-bold text-stone-900">{verificationModal.computed_hash}</span></div>
            <div>Sealed SHA-256: <span className="font-bold text-stone-900">{verificationModal.stored_hash}</span></div>
            <div>Previous Anchor Hash: {verificationModal.previous_hash}</div>
            <div>Chain Continuity: {verificationModal.previous_hash_match ? 'CONTINUOUS' : 'BROKEN'}</div>
          </div>
        </div>
      )}

      {/* Evidence Table */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-100 text-stone-700 font-semibold">
                <th className="py-3 px-4">Evidence ID</th>
                <th className="py-3 px-4">Incident ID</th>
                <th className="py-3 px-4">Source Event</th>
                <th className="py-3 px-4">Source System</th>
                <th className="py-3 px-4">Current SHA-256 Hash</th>
                <th className="py-3 px-4">Previous Chain Hash</th>
                <th className="py-3 px-4">Tamper Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 bg-white">
              {evidenceList.map((ev) => (
                <tr key={ev.id} className="hover:bg-amber-50/30 transition">
                  <td className="py-3 px-4 font-mono font-bold text-stone-900">{ev.id}</td>
                  <td className="py-3 px-4 font-mono text-stone-700">{ev.incident_id}</td>
                  <td className="py-3 px-4 font-medium text-stone-800">{ev.source_event}</td>
                  <td className="py-3 px-4 text-stone-500 text-[11px]">{ev.source_system}</td>
                  <td className="py-3 px-4 font-mono text-[10px] text-stone-700">
                    {ev.current_hash.substring(0, 24)}...
                  </td>
                  <td className="py-3 px-4 font-mono text-[10px] text-stone-400">
                    {ev.previous_hash.substring(0, 16)}...
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      ev.is_tampered
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}>
                      {ev.is_tampered ? 'TAMPERED' : 'VERIFIED'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setSelectedContent(ev)}
                      className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded text-[10px] font-semibold border border-stone-300 cursor-pointer transition"
                      title="View structured evidence payload"
                    >
                      Inspect
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleVerify(ev.id, e)}
                      disabled={verifyingId === ev.id}
                      className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold cursor-pointer shadow-xs transition disabled:opacity-50"
                    >
                      {verifyingId === ev.id ? 'Verifying...' : 'Verify Hash'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleTamperToggle(ev, e)}
                      className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded text-[10px] font-medium border border-stone-300 cursor-pointer transition"
                      title="Mutate payload in memory to test tamper detection"
                    >
                      {ev.is_tampered ? 'Restore' : 'Tamper'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evidence Content Drawer */}
      {selectedContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-stone-300 w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden text-xs">
            <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
              <div>
                <div className="font-bold text-sm">Sealed Evidence Payload: {selectedContent.id}</div>
                <div className="text-[11px] text-stone-400">{selectedContent.source_event}</div>
              </div>
              <button onClick={() => setSelectedContent(null)} className="p-1 hover:bg-stone-800 rounded text-stone-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-3 font-mono text-[11px]">
              <div>
                <span className="text-stone-400 block text-[10px] uppercase font-bold">SHA-256 Hash</span>
                <span className="text-stone-900 font-bold">{selectedContent.current_hash}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Previous Hash</span>
                <span className="text-stone-700">{selectedContent.previous_hash}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Raw Payload Data</span>
                <pre className="p-3 bg-stone-50 border border-stone-200 rounded text-stone-800 overflow-x-auto text-[10px]">
                  {JSON.stringify(selectedContent.content_data, null, 2)}
                </pre>
              </div>
            </div>
            <div className="px-6 py-3 bg-stone-100 border-t border-stone-200 text-right">
              <button
                onClick={() => setSelectedContent(null)}
                className="px-4 py-1.5 bg-stone-800 hover:bg-stone-700 text-white rounded text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
