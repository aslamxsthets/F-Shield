import React, { useEffect, useRef, useState } from 'react';
import cytoscape, { Core } from 'cytoscape';
import {
  ShieldAlert, Play, Pause, RotateCcw, SkipForward,
  CheckCircle, AlertTriangle, ShieldCheck, Link2,
  Lock, Scale, FileText, ArrowLeft, RefreshCw, Sparkles, Download, Check
} from 'lucide-react';
import { api } from '../services/api';
import { Incident, IncidentEvent, Evidence, BlockchainAnchor, ComplianceCheck, RiskAssessment, Shipper, Booking, PermissionProfile } from '../types';

interface IncidentDetailProps {
  incidentId: string;
  onBack: () => void;
}

export const IncidentDetail: React.FC<IncidentDetailProps> = ({ incidentId, onBack }) => {
  const [data, setData] = useState<{
    incident: Incident;
    booking: Booking;
    shipper: Shipper;
    assessment: RiskAssessment;
    timeline: IncidentEvent[];
    evidenceList: Evidence[];
    blockchainAnchor?: BlockchainAnchor;
    complianceChecks: ComplianceCheck[];
    permission?: PermissionProfile;
    attackPath: any;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [verifyingEvidenceId, setVerifyingEvidenceId] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);
  const [anchoring, setAnchoring] = useState(false);
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);

  // Forensic Timeline Replay State
  const [replayStep, setReplayStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const timerRef = useRef<any>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const fetchIncidentData = async (isInitial = false) => {
    try {
      if (isInitial && !data) setLoading(true);
      const res = await api.getIncident(incidentId);
      setData(res);
      if (isInitial) {
        setReplayStep(res.timeline.length); // default show full state
      }
    } catch (err) {
      console.error('Failed to load incident detail:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidentData(true);
  }, [incidentId]);

  // Cytoscape initialization for incident topology
  useEffect(() => {
    if (!containerRef.current || !data) return;

    const bkg = data.booking;
    const inc = data.incident;
    const destId = `DEST-${bkg.destination.replace(/[^a-zA-Z0-9]/g, '_')}`;

    const elements = [
      // Nodes
      { data: { id: bkg.shipper_id, label: data.shipper.company_name, type: 'SHIPPER', status: data.shipper.status } },
      { data: { id: bkg.account_id, label: `Account: ${bkg.account_id}`, type: 'ACCOUNT' } },
      { data: { id: bkg.device_id, label: `Device: ${bkg.device_id}`, type: 'DEVICE', status: 'SUSPICIOUS' } },
      { data: { id: bkg.payment_id, label: `Payment: ${bkg.payment_id}`, type: 'PAYMENT', status: 'SUSPICIOUS' } },
      { data: { id: bkg.id, label: `Booking: ${bkg.booking_reference} (${bkg.weight_kg}kg)`, type: 'BOOKING', status: 'BLOCKED' } },
      { data: { id: destId, label: `Dest: ${bkg.destination}`, type: 'DESTINATION' } },
      { data: { id: data.assessment?.id || 'RSK-NODE', label: `Risk: ${inc.risk_score}/100`, type: 'FRAUD_ENGINE' } },
      { data: { id: `DEC-${inc.decision}`, label: `Decision: ${inc.decision}`, type: 'DECISION', status: 'BLOCKED' } },
      { data: { id: inc.id, label: `Incident: ${inc.incident_number}`, type: 'INCIDENT', status: 'BLOCKED' } },

      // Edges
      { data: { id: 'e-shp-acc', source: bkg.shipper_id, target: bkg.account_id, label: 'OWNS' } },
      { data: { id: 'e-acc-dev', source: bkg.account_id, target: bkg.device_id, label: 'ACCESSED_VIA', is_suspicious: true } },
      { data: { id: 'e-acc-pm', source: bkg.account_id, target: bkg.payment_id, label: 'PAID_WITH', is_suspicious: true } },
      { data: { id: 'e-acc-bkg', source: bkg.account_id, target: bkg.id, label: 'BOOKED', is_suspicious: true } },
      { data: { id: 'e-dev-bkg', source: bkg.device_id, target: bkg.id, label: 'SUBMITTED', is_suspicious: true } },
      { data: { id: 'e-pm-bkg', source: bkg.payment_id, target: bkg.id, label: 'FUNDED', is_suspicious: true } },
      { data: { id: 'e-bkg-dest', source: bkg.id, target: destId, label: 'SHIPPED_TO', is_suspicious: true } },
      { data: { id: 'e-bkg-rsk', source: bkg.id, target: data.assessment?.id || 'RSK-NODE', label: 'EVALUATED' } },
      { data: { id: 'e-rsk-dec', source: data.assessment?.id || 'RSK-NODE', target: `DEC-${inc.decision}`, label: 'ENFORCED' } },
      { data: { id: 'e-dec-inc', source: `DEC-${inc.decision}`, target: inc.id, label: 'OPENED' } },
    ];

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'font-size': '10px',
            'font-family': 'Plus Jakarta Sans, sans-serif',
            'font-weight': 600,
            'color': '#f8fafc',
            'text-outline-color': '#020617',
            'text-outline-width': 2,
            'text-background-color': '#0f172a',
            'text-background-opacity': 0.85,
            'text-background-padding': '3px',
            'text-background-shape': 'roundrectangle',
            'text-wrap': 'wrap',
            'text-max-width': '100px',
            'background-color': '#78716c',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'width': 32,
            'height': 32,
          }
        },
        {
          selector: 'node[type = "SHIPPER"]',
          style: { 'background-color': '#0284c7', 'shape': 'round-rectangle', 'width': 34, 'height': 34 }
        },
        {
          selector: 'node[type = "DEVICE"]',
          style: { 'background-color': '#d97706', 'shape': 'diamond', 'width': 32, 'height': 32 }
        },
        {
          selector: 'node[type = "PAYMENT"]',
          style: { 'background-color': '#9333ea', 'shape': 'hexagon', 'width': 30, 'height': 30 }
        },
        {
          selector: 'node[type = "BOOKING"]',
          style: { 'background-color': '#ea580c', 'shape': 'ellipse', 'width': 36, 'height': 36 }
        },
        {
          selector: 'node[type = "FRAUD_ENGINE"]',
          style: { 'background-color': '#b45309', 'shape': 'octagon', 'width': 36, 'height': 36 }
        },
        {
          selector: 'node[type = "DECISION"]',
          style: { 'background-color': '#dc2626', 'shape': 'star', 'width': 38, 'height': 38 }
        },
        {
          selector: 'node[type = "INCIDENT"]',
          style: { 'background-color': '#991b1b', 'shape': 'triangle', 'width': 40, 'height': 40 }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#d6d3d1',
            'target-arrow-color': '#d6d3d1',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '8px',
            'color': '#78716c',
            'text-rotation': 'autorotate',
          }
        },
        {
          selector: 'edge[is_suspicious]',
          style: {
            'line-color': '#dc2626',
            'target-arrow-color': '#dc2626',
            'line-style': 'dashed',
            'width': 2.5,
          }
        },
        {
          selector: '.step-active',
          style: {
            'border-width': 4,
            'border-color': '#f59e0b',
            'background-color': '#ea580c',
          }
        }
      ],
      layout: {
        name: 'breadthfirst',
        directed: true,
        padding: 50,
        spacingFactor: 2.0,
      }
    });

    cyRef.current = cy;
  }, [data]);

  // Replay Control Logic
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setReplayStep(prev => {
        if (!data || prev >= data.timeline.length) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1800);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, data]);

  // Step highlight in graph during replay
  useEffect(() => {
    if (!cyRef.current || !data) return;
    const cy = cyRef.current;
    cy.elements().removeClass('step-active');

    if (replayStep > 0 && replayStep <= data.timeline.length) {
      const currentEvt = data.timeline[replayStep - 1];
      const targetNode = cy.getElementById(currentEvt.entity_id);
      if (targetNode.length > 0) {
        targetNode.addClass('step-active');
      }
    }
  }, [replayStep, data]);

  // Verify Evidence Handler
  const handleVerifyEvidence = async (evidenceId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setVerifyingEvidenceId(evidenceId);
    try {
      const res = await api.verifyEvidence(evidenceId);
      setVerificationResult(res);
      // Silent sync without page unmounting
      fetchIncidentData(false);
    } catch (err: any) {
      alert(`Verification failed: ${err.message}`);
    } finally {
      setVerifyingEvidenceId(null);
    }
  };

  // Tamper Simulation Handler
  const handleTamperToggle = async (evidence: Evidence, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      // Optimistic update so UI toggles immediately without flicker
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          evidenceList: prev.evidenceList.map(ev => 
            ev.id === evidence.id ? { ...ev, is_tampered: !ev.is_tampered } : ev
          )
        };
      });
      await api.tamperEvidence(evidence.id, !evidence.is_tampered);
      fetchIncidentData(false);
      setVerificationResult(null);
    } catch (err: any) {
      alert(`Tamper action failed: ${err.message}`);
      fetchIncidentData(false);
    }
  };

  // Anchor to Blockchain Handler
  const handleAnchorEvidence = async (evidenceId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setAnchoring(true);
    try {
      await api.anchorEvidence(evidenceId, incidentId);
      fetchIncidentData(false);
      alert('Forensic proof anchored to blockchain ledger in SIMULATED mode.');
    } catch (err: any) {
      alert(`Anchor failed: ${err.message}`);
    } finally {
      setAnchoring(false);
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

  // Report Generators
  const handleGenerateReport = async (type: 'FRAUD' | 'COMPLIANCE' | 'EVIDENCE') => {
    setGeneratingReport(type);
    setReportSuccess(null);
    try {
      let r: any;
      if (type === 'FRAUD') {
        r = await api.generateFraudReport(incidentId);
      } else if (type === 'COMPLIANCE' && data?.booking) {
        r = await api.generateComplianceReport(data.booking.id);
      } else {
        r = await api.generateEvidenceManifest(incidentId);
      }
      setReportSuccess(`Generated: ${r.filename}`);
      triggerDownload(r.download_url, r.filename);
    } catch (err: any) {
      alert(`Report compilation failed: ${err.message}`);
    } finally {
      setGeneratingReport(null);
    }
  };

  // Status Updater
  const handleStatusUpdate = async (status: any) => {
    try {
      await api.updateIncident(incidentId, { status });
      fetchIncidentData();
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  if (loading || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-stone-500">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin text-amber-600 mb-3" />
        <p className="text-sm font-medium">Reconstructing forensic dossier for {incidentId}...</p>
      </div>
    );
  }

  const { incident, booking, shipper, assessment, timeline, evidenceList, blockchainAnchor, complianceChecks } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header Bar */}
      <div className="bg-stone-50 border border-stone-200 p-6 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-2 bg-white hover:bg-stone-100 rounded-lg border border-stone-300 text-stone-700 transition"
              title="Return to Incidents"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-serif font-bold text-xl text-stone-900">
                  Forensic Dossier: {incident.incident_number}
                </span>
                <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                  incident.decision === 'BLOCK' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-stone-950'
                }`}>
                  {incident.decision}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-stone-200 text-stone-800">
                  {incident.severity}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Booking: <span className="font-mono text-stone-800 font-semibold">{booking.booking_reference}</span> |
                Shipper: <span className="font-medium text-stone-800">{shipper.company_name}</span> |
                Opened: {new Date(incident.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Status Selector */}
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="text-stone-500 font-medium">Status:</span>
              <select
                value={incident.status}
                onChange={(e) => handleStatusUpdate(e.target.value)}
                className="bg-white border border-stone-300 rounded px-2.5 py-1 text-xs font-bold text-stone-800 focus:outline-none"
              >
                <option value="OPEN">OPEN</option>
                <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="FALSE_POSITIVE">FALSE_POSITIVE</option>
                <option value="ESCALATED">ESCALATED</option>
              </select>
            </div>

            {/* Quick PDF Reports Menu */}
            <button
              onClick={() => handleGenerateReport('FRAUD')}
              disabled={generatingReport !== null}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>{generatingReport === 'FRAUD' ? 'Compiling PDF...' : 'Download Dossier PDF'}</span>
            </button>
          </div>
        </div>

        {reportSuccess && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center justify-between">
            <span className="font-medium">{reportSuccess}</span>
            <span className="text-[11px] text-emerald-600 font-mono">Real PDF Compiled</span>
          </div>
        )}
      </div>

      {/* 3-Column Core Investigation Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Chronological Database Timeline (3 cols) */}
        <div className="lg:col-span-3 bg-stone-50 border border-stone-200 p-4 rounded-xl shadow-xs space-y-3 flex flex-col">
          <div className="flex items-center justify-between pb-2 border-b border-stone-200">
            <h2 className="text-xs font-bold font-serif text-stone-900 uppercase tracking-wider">
              Chronological Timeline
            </h2>
            <span className="text-[11px] font-mono text-stone-500">{timeline.length} Steps</span>
          </div>

          <div className="overflow-y-auto space-y-3 flex-1 pr-1 max-h-[500px]">
            {timeline.map((evt, idx) => {
              const isSelectedStep = replayStep === evt.step_order;
              return (
                <div
                  key={evt.id}
                  onClick={() => setReplayStep(evt.step_order)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                    isSelectedStep
                      ? 'bg-amber-100 border-amber-400 shadow-xs'
                      : 'bg-white border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900 text-[11px]">
                      Step {evt.step_order}: {evt.title}
                    </span>
                    {evt.risk_delta > 0 && (
                      <span className="text-[10px] px-1 bg-rose-100 text-rose-800 font-mono font-bold rounded">
                        +{evt.risk_delta}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-600 mt-1 leading-snug">{evt.description}</p>
                  <div className="text-[9px] text-stone-400 font-mono mt-1">
                    {new Date(evt.timestamp).toLocaleTimeString()} &bull; {evt.entity_type}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center: Cytoscape Graph & Incident Replay Bar (6 cols) */}
        <div className="lg:col-span-6 bg-stone-50 border border-stone-200 p-4 rounded-xl shadow-xs space-y-3 flex flex-col">
          <div className="flex items-center justify-between pb-2 border-b border-stone-200">
            <div>
              <h2 className="text-xs font-bold font-serif text-stone-900 uppercase tracking-wider">
                Reconstructed Attack Topology & Incident Replay
              </h2>
              <p className="text-[11px] text-stone-500">Step-by-step forensic execution replay</p>
            </div>

            {/* Replay Controls */}
            <div className="flex items-center space-x-1 bg-white border border-stone-300 rounded-lg p-1">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-1 hover:bg-stone-100 rounded text-stone-800"
                title={isPlaying ? 'Pause' : 'Play Timeline'}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-600" /> : <Play className="w-3.5 h-3.5 text-emerald-600" />}
              </button>
              <button
                onClick={() => {
                  setIsPlaying(false);
                  setReplayStep(1);
                }}
                className="p-1 hover:bg-stone-100 rounded text-stone-800"
                title="Restart to Step 1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setIsPlaying(false);
                  setReplayStep(prev => Math.min(timeline.length, prev + 1));
                }}
                className="p-1 hover:bg-stone-100 rounded text-stone-800"
                title="Next Event"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono text-stone-500 px-1.5 border-l border-stone-200">
                {replayStep}/{timeline.length}
              </span>
            </div>
          </div>

          {/* Canvas */}
          <div className="relative bg-stone-100 border border-stone-300 rounded-xl h-[450px] overflow-hidden">
            <div ref={containerRef} className="w-full h-full" />

            {/* Replay Overlay Status */}
            {replayStep > 0 && replayStep <= timeline.length && (
              <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-xs p-2.5 rounded-lg border border-amber-300 shadow-sm max-w-xs text-xs">
                <div className="font-bold text-amber-900 text-[11px] flex items-center space-x-1">
                  <span>Replaying Step {replayStep}:</span>
                  <span className="text-stone-900">{timeline[replayStep - 1].title}</span>
                </div>
                <div className="text-[10px] text-stone-600 mt-0.5">{timeline[replayStep - 1].description}</div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Risk Breakdown & Explanation & Privileges (3 cols) */}
        <div className="lg:col-span-3 bg-stone-50 border border-stone-200 p-4 rounded-xl shadow-xs space-y-4 text-xs">
          <div>
            <h2 className="text-xs font-bold font-serif text-stone-900 uppercase tracking-wider pb-1 border-b border-stone-200">
              Risk Decisioning & Reasoning
            </h2>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-stone-500 font-medium">Risk Score:</span>
              <span className="font-mono font-bold text-rose-800 text-lg">{incident.risk_score} / 100</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-stone-500 font-medium">Policy Level:</span>
              <span className="font-mono text-[10px] font-semibold text-stone-800">{assessment?.fallback_level}</span>
            </div>
          </div>

          {/* GenAI / Deterministic Explanation */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
            <div className="flex items-center space-x-1 font-bold text-amber-900 text-[11px]">
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>Evidence Reasoning ({assessment?.explanation_source})</span>
            </div>
            <p className="text-[11px] text-stone-800 italic leading-snug">
              "{assessment?.explanation}"
            </p>
          </div>

          {/* Component Score Bars */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold text-stone-500 uppercase">Component Breakdown</div>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between"><span>Identity/Perm:</span> <span className="font-mono font-bold">{assessment?.identity_score}</span></div>
              <div className="flex justify-between"><span>Behavior:</span> <span className="font-mono font-bold">{assessment?.behavior_score}</span></div>
              <div className="flex justify-between"><span>Shipment:</span> <span className="font-mono font-bold">{assessment?.shipment_score}</span></div>
              <div className="flex justify-between"><span>Payment:</span> <span className="font-mono font-bold">{assessment?.payment_score}</span></div>
              <div className="flex justify-between"><span>Destination:</span> <span className="font-mono font-bold">{assessment?.destination_score}</span></div>
              <div className="flex justify-between"><span>Compliance:</span> <span className="font-mono font-bold">{assessment?.compliance_score}</span></div>
            </div>
          </div>

          {/* Authorized vs Observed */}
          {assessment?.authorized_vs_observed && (
            <div className="pt-2 border-t border-stone-200">
              <div className="text-[10px] font-semibold text-stone-500 uppercase mb-1">Privilege Breach Matrix</div>
              <div className="p-2 bg-white rounded border border-stone-200 space-y-1 text-[11px]">
                <div>
                  <span className="text-stone-400">Weight: </span>
                  <span className="font-bold text-rose-800 font-mono">{assessment.authorized_vs_observed.weight.observed}kg</span>
                  <span className="text-stone-500 text-[10px]"> (Max {assessment.authorized_vs_observed.weight.authorized_max}kg)</span>
                </div>
                <div>
                  <span className="text-stone-400">Destination: </span>
                  <span className="font-bold text-rose-800">{assessment.authorized_vs_observed.destination.observed}</span>
                  <span className="text-stone-500 text-[10px] block truncate">Auth: {assessment.authorized_vs_observed.destination.authorized.join(', ')}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: Evidence Chain Ledger & Blockchain Proof */}
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-stone-200">
          <div>
            <div className="flex items-center space-x-2">
              <Lock className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-bold font-serif text-stone-900">
                Tamper-Evident SHA-256 Forensic Evidence Ledger
              </h2>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Cryptographically chained digital artifacts with off-chain zero-trust verification
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleGenerateReport('EVIDENCE')}
              disabled={generatingReport !== null}
              className="px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-100 rounded-lg text-xs font-semibold text-stone-800 transition cursor-pointer"
            >
              Export Manifest PDF
            </button>
            <button
              onClick={() => handleGenerateReport('COMPLIANCE')}
              disabled={generatingReport !== null}
              className="px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-100 rounded-lg text-xs font-semibold text-stone-800 transition cursor-pointer"
            >
              Export Compliance PDF
            </button>
          </div>
        </div>

        {/* Evidence Verification Alert Banner if active */}
        {verificationResult && (
          <div className={`p-4 rounded-xl text-xs border ${
            verificationResult.status === 'HASH_MATCH'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-bold text-sm">
                {verificationResult.status === 'HASH_MATCH' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                )}
                <span>VERIFICATION RESULT: {verificationResult.status}</span>
              </div>
              <span className="font-mono text-[10px]">{verificationResult.verification_timestamp}</span>
            </div>
            <p className="mt-1 font-medium">{verificationResult.details}</p>
            <div className="mt-2 font-mono text-[10px] space-y-0.5">
              <div>Computed SHA-256: {verificationResult.computed_hash}</div>
              <div>Stored SHA-256: {verificationResult.stored_hash}</div>
              <div>Previous Hash Match: {verificationResult.previous_hash_match ? 'TRUE' : 'FALSE'}</div>
            </div>
          </div>
        )}

        {/* Evidence Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-300 text-stone-600 font-semibold bg-stone-100">
                <th className="py-2.5 px-3">Evidence ID</th>
                <th className="py-2.5 px-3">Source Event</th>
                <th className="py-2.5 px-3">Sealed SHA-256 Hash</th>
                <th className="py-2.5 px-3">Previous Chain Hash</th>
                <th className="py-2.5 px-3">Tamper Status</th>
                <th className="py-2.5 px-3 text-right">Verification & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 bg-white">
              {evidenceList.map((ev) => (
                <tr key={ev.id} className="hover:bg-stone-50">
                  <td className="py-3 px-3 font-mono font-bold text-stone-900">{ev.id}</td>
                  <td className="py-3 px-3 text-stone-800 font-medium">{ev.source_event}</td>
                  <td className="py-3 px-3 font-mono text-[10px] text-stone-600">
                    {ev.current_hash.substring(0, 24)}...
                  </td>
                  <td className="py-3 px-3 font-mono text-[10px] text-stone-400">
                    {ev.previous_hash.substring(0, 16)}...
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      ev.is_tampered ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {ev.is_tampered ? 'TAMPERED' : 'UNBROKEN'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right space-x-1.5">
                    <button
                      type="button"
                      onClick={(e) => handleVerifyEvidence(ev.id, e)}
                      disabled={verifyingEvidenceId === ev.id}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold cursor-pointer transition shadow-xs disabled:opacity-50"
                    >
                      {verifyingEvidenceId === ev.id ? 'Recalculating...' : 'Verify Hash'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleTamperToggle(ev, e)}
                      className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded text-[10px] font-medium border border-stone-300 cursor-pointer transition"
                      title="Simulate tamper injection to test detection"
                    >
                      {ev.is_tampered ? 'Restore Payload' : 'Inject Tamper'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleAnchorEvidence(ev.id, e)}
                      disabled={anchoring}
                      className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded text-[10px] font-medium border border-sky-300 cursor-pointer transition disabled:opacity-50"
                      title="Anchor off-chain cryptographic state to blockchain"
                    >
                      Anchor Proof
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Blockchain Anchor Card */}
        {blockchainAnchor ? (
          <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-xl text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-bold text-sky-950 text-sm">
                <Link2 className="w-4 h-4 text-sky-600" />
                <span>BLOCKCHAIN EVIDENCE ANCHOR ({blockchainAnchor.network_mode})</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-sky-200 text-sky-900 font-mono text-[10px] font-bold">
                {blockchainAnchor.state}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px] text-stone-700">
              <div>Block Number: <span className="font-bold text-stone-900">#{blockchainAnchor.block_number}</span></div>
              <div className="truncate">Tx ID: <span className="font-bold text-stone-900">{blockchainAnchor.anchor_tx_id}</span></div>
              <div className="truncate">Merkle Root: <span className="font-bold text-stone-900">{blockchainAnchor.merkle_root}</span></div>
            </div>
            <p className="text-[11px] text-stone-500">
              Off-chain evidence hash anchored with cryptographic timestamp. Real payload remains confidential and compliant with statutory privacy standards.
            </p>
          </div>
        ) : (
          <div className="p-3 bg-stone-100 rounded-xl text-xs text-stone-500 flex items-center justify-between">
            <span>No blockchain anchor recorded for this incident bundle yet.</span>
            <button
              onClick={() => evidenceList[0] && handleAnchorEvidence(evidenceList[0].id)}
              disabled={anchoring}
              className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded font-bold text-xs cursor-pointer"
            >
              Anchor Sealed Bundle
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
