import React, { useEffect, useState } from 'react';
import { X, Shield, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { AuditEvent } from '../types';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditEvents();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-stone-50 border border-stone-300 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-stone-100 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-base font-bold tracking-tight">Append-Only Security Audit Trail</h2>
              <p className="text-xs text-stone-400">Cryptographically verifiable log of all authentication, risk decisions, reports, and evidence actions</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="p-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs flex items-center space-x-1"
              title="Refresh Audit Log"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-stone-800 text-stone-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="p-6 overflow-y-auto flex-1 text-xs">
          {loading ? (
            <div className="py-12 text-center text-stone-500">Loading audit records...</div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-stone-500">No audit events recorded yet.</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-stone-300 text-left text-stone-600 font-semibold pb-2">
                  <th className="py-2 px-2">Timestamp</th>
                  <th className="py-2 px-2">Actor</th>
                  <th className="py-2 px-2">Action</th>
                  <th className="py-2 px-2">Resource</th>
                  <th className="py-2 px-2">IP Address</th>
                  <th className="py-2 px-2">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {logs.map((evt) => (
                  <tr key={evt.id} className="hover:bg-stone-100">
                    <td className="py-2.5 px-2 font-mono text-[11px] text-stone-600 whitespace-nowrap">
                      {new Date(evt.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="font-medium text-stone-900">{evt.actor_name}</div>
                      <div className="text-[10px] text-stone-500">{evt.actor_role}</div>
                    </td>
                    <td className="py-2.5 px-2 font-mono font-medium text-amber-900">
                      {evt.action}
                    </td>
                    <td className="py-2.5 px-2 text-stone-700">
                      <span className="font-semibold">{evt.resource_type}:</span> {evt.resource_id}
                    </td>
                    <td className="py-2.5 px-2 font-mono text-[11px] text-stone-500">
                      {evt.ip_address}
                    </td>
                    <td className="py-2.5 px-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        evt.result === 'SUCCESS'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-red-100 text-red-800 border border-red-300'
                      }`}>
                        {evt.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-stone-100 border-t border-stone-200 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-800 hover:bg-stone-700 text-white rounded text-xs font-medium cursor-pointer"
          >
            Close Audit Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
