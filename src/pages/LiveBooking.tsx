import React, { useState } from 'react';
import {
  ShieldAlert, CheckCircle, AlertTriangle, AlertOctagon,
  ArrowRight, Sparkles, Scale, Cpu, ShieldCheck, RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import { RiskAssessment } from '../types';

interface LiveBookingProps {
  onNavigateToIncident?: (incidentId: string) => void;
}

export const LiveBooking: React.FC<LiveBookingProps> = ({ onNavigateToIncident }) => {
  const [formData, setFormData] = useState({
    shipper_id: 'SHP-202',
    account_id: 'ACC-202',
    payment_id: 'PM-888',
    device_id: 'DEV-999',
    origin: 'IN-DEL-DELHI',
    destination: 'DE-FRA-FRANKFURT',
    weight_kg: '180.0',
    service_type: 'AIR_EXPRESS_PRIORITY',
    package_category: 'CHEMICALS_HIGH_DENSITY',
    declared_value_inr: '2800000',
  });

  const [screening, setScreening] = useState(false);
  const [lastResult, setLastResult] = useState<{
    booking: any;
    assessment: RiskAssessment;
    incident?: any;
    processing_ms: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Scenarios A-F Presets
  const applyPreset = (scenario: string) => {
    setErrorMessage(null);
    if (scenario === 'A') {
      // Legitimate
      setFormData({
        shipper_id: 'SHP-101',
        account_id: 'ACC-101',
        payment_id: 'PM-101',
        device_id: 'DEV-101',
        origin: 'IN-BOM-MUMBAI',
        destination: 'IN-BLR-BENGALURU',
        weight_kg: '6.2',
        service_type: 'STANDARD_GROUND',
        package_category: 'MACHINERY_PARTS',
        declared_value_inr: '70000',
      });
    } else if (scenario === 'B') {
      // Account Takeover / 180kg Privilege Abuse
      setFormData({
        shipper_id: 'SHP-202',
        account_id: 'ACC-202',
        payment_id: 'PM-888',
        device_id: 'DEV-999',
        origin: 'IN-DEL-DELHI',
        destination: 'DE-FRA-FRANKFURT',
        weight_kg: '180.0',
        service_type: 'AIR_EXPRESS_PRIORITY',
        package_category: 'CHEMICALS_HIGH_DENSITY',
        declared_value_inr: '2800000',
      });
    } else if (scenario === 'C') {
      // Cold Start
      setFormData({
        shipper_id: 'SHP-303',
        account_id: 'ACC-303',
        payment_id: 'PM-303',
        device_id: 'DEV-303',
        origin: 'IN-BLR-BENGALURU',
        destination: 'IN-HYD-HYDERABAD',
        weight_kg: '8.0',
        service_type: 'STANDARD_GROUND',
        package_category: 'ELECTRONICS_CONSUMER',
        declared_value_inr: '95000',
      });
    } else if (scenario === 'D') {
      // Suspicious Device Infrastructure (DEV-404 linked to blocked sybil)
      setFormData({
        shipper_id: 'SHP-404',
        account_id: 'ACC-404',
        payment_id: 'PM-404',
        device_id: 'DEV-404',
        origin: 'IN-MAA-CHENNAI',
        destination: 'IN-COK-KOCHI',
        weight_kg: '48.0',
        service_type: 'STANDARD_GROUND',
        package_category: 'TEXTILES_COMMERCIAL',
        declared_value_inr: '360000',
      });
    } else if (scenario === 'E') {
      // Level 2 Fallback Test (High risk booking while ML is disabled)
      setFormData({
        shipper_id: 'SHP-202',
        account_id: 'ACC-202',
        payment_id: 'PM-888',
        device_id: 'DEV-999',
        origin: 'IN-DEL-DELHI',
        destination: 'AE-DXB-DUBAI',
        weight_kg: '120.0',
        service_type: 'AIR_EXPRESS_PRIORITY',
        package_category: 'PHARMA_CRITICAL',
        declared_value_inr: '1500000',
      });
    } else if (scenario === 'F') {
      // Compliance Check Consignment (High value courier declaration)
      setFormData({
        shipper_id: 'SHP-101',
        account_id: 'ACC-101',
        payment_id: 'PM-101',
        device_id: 'DEV-101',
        origin: 'IN-BOM-MUMBAI',
        destination: 'SG-SIN-SINGAPORE',
        weight_kg: '78.5',
        service_type: 'AIR_EXPRESS_PRIORITY',
        package_category: 'PRECISION_OPTICS',
        declared_value_inr: '1200000',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setScreening(true);
    setErrorMessage(null);

    try {
      const res = await api.screenBooking({
        ...formData,
        weight_kg: parseFloat(formData.weight_kg),
        declared_value_inr: parseFloat(formData.declared_value_inr),
      });
      setLastResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Screening request failed');
    } finally {
      setScreening(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-bold text-stone-900">
          Live Booking Fraud & Risk Screening Engine
        </h1>
        <p className="text-sm text-stone-600">
          Pre-shipment verification pipeline. Evaluates behavioral anomalies, privilege bounds, device fingerprints, and statutory compliance.
        </p>
      </div>

      {/* Scenario Presets Bar */}
      <div className="bg-stone-50 border border-stone-200 p-4 rounded-xl shadow-xs">
        <div className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
          One-Click Operational Demonstration Scenarios:
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <button
            type="button"
            onClick={() => applyPreset('A')}
            className="p-2 text-left bg-white border border-stone-300 hover:border-emerald-600 rounded-lg text-xs transition group cursor-pointer"
          >
            <div className="font-bold text-emerald-800 flex items-center justify-between">
              <span>Scenario A</span>
              <span className="text-[10px] px-1 bg-emerald-100 text-emerald-800 rounded">ALLOW</span>
            </div>
            <div className="text-[11px] text-stone-600 truncate mt-0.5">Legitimate Domestic (6kg)</div>
          </button>

          <button
            type="button"
            onClick={() => applyPreset('B')}
            className="p-2 text-left bg-white border border-stone-300 hover:border-rose-600 rounded-lg text-xs transition group cursor-pointer"
          >
            <div className="font-bold text-rose-800 flex items-center justify-between">
              <span>Scenario B</span>
              <span className="text-[10px] px-1 bg-rose-100 text-rose-800 rounded">BLOCK</span>
            </div>
            <div className="text-[11px] text-stone-600 truncate mt-0.5">Account Takeover (180kg)</div>
          </button>

          <button
            type="button"
            onClick={() => applyPreset('C')}
            className="p-2 text-left bg-white border border-stone-300 hover:border-blue-600 rounded-lg text-xs transition group cursor-pointer"
          >
            <div className="font-bold text-blue-800 flex items-center justify-between">
              <span>Scenario C</span>
              <span className="text-[10px] px-1 bg-blue-100 text-blue-800 rounded">COLD START</span>
            </div>
            <div className="text-[11px] text-stone-600 truncate mt-0.5">Fresh Account (Verified KYC)</div>
          </button>

          <button
            type="button"
            onClick={() => applyPreset('D')}
            className="p-2 text-left bg-white border border-stone-300 hover:border-amber-600 rounded-lg text-xs transition group cursor-pointer"
          >
            <div className="font-bold text-amber-800 flex items-center justify-between">
              <span>Scenario D</span>
              <span className="text-[10px] px-1 bg-amber-100 text-amber-800 rounded">HOLD/FLAG</span>
            </div>
            <div className="text-[11px] text-stone-600 truncate mt-0.5">Reused Sybil Device Terminal</div>
          </button>

          <button
            type="button"
            onClick={() => applyPreset('E')}
            className="p-2 text-left bg-white border border-stone-300 hover:border-stone-800 rounded-lg text-xs transition group cursor-pointer"
          >
            <div className="font-bold text-stone-800 flex items-center justify-between">
              <span>Scenario E</span>
              <span className="text-[10px] px-1 bg-stone-200 text-stone-800 rounded">LEVEL 2</span>
            </div>
            <div className="text-[11px] text-stone-600 truncate mt-0.5">AI Failure / Rule Fallback</div>
          </button>

          <button
            type="button"
            onClick={() => applyPreset('F')}
            className="p-2 text-left bg-white border border-stone-300 hover:border-purple-600 rounded-lg text-xs transition group cursor-pointer"
          >
            <div className="font-bold text-purple-800 flex items-center justify-between">
              <span>Scenario F</span>
              <span className="text-[10px] px-1 bg-purple-100 text-purple-800 rounded">CUSTOMS</span>
            </div>
            <div className="text-[11px] text-stone-600 truncate mt-0.5">Courier Regs / High Value</div>
          </button>
        </div>
      </div>

      {/* Booking Form and Live Result Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Panel (5 cols) */}
        <div className="lg:col-span-5 bg-stone-50 border border-stone-200 p-6 rounded-2xl shadow-xs">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Shipper ID</label>
                <input
                  type="text"
                  value={formData.shipper_id}
                  onChange={(e) => setFormData({ ...formData, shipper_id: e.target.value })}
                  className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-amber-500 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Account ID</label>
                <input
                  type="text"
                  value={formData.account_id}
                  onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                  className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-amber-500 font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Device ID / Terminal</label>
                <input
                  type="text"
                  value={formData.device_id}
                  onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                  className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-amber-500 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Payment Method ID</label>
                <input
                  type="text"
                  value={formData.payment_id}
                  onChange={(e) => setFormData({ ...formData, payment_id: e.target.value })}
                  className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-amber-500 font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Origin Port/Hub</label>
                <input
                  type="text"
                  value={formData.origin}
                  onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                  className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-amber-500 font-medium"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Destination Port/Hub</label>
                <input
                  type="text"
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-amber-500 font-medium"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Consignment Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.weight_kg}
                  onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })}
                  className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-amber-500 font-mono font-bold"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Declared Value (₹ INR)</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-stone-500 font-bold">₹</span>
                  <input
                    type="number"
                    value={formData.declared_value_inr}
                    onChange={(e) => setFormData({ ...formData, declared_value_inr: e.target.value })}
                    className="w-full bg-white border border-stone-300 rounded pl-7 pr-2.5 py-1.5 focus:ring-1 focus:ring-amber-500 font-mono font-bold"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Service Tier</label>
                <select
                  value={formData.service_type}
                  onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                  className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-amber-500"
                >
                  <option value="STANDARD_GROUND">STANDARD_GROUND</option>
                  <option value="EXPRESS_SAVER">EXPRESS_SAVER</option>
                  <option value="AIR_EXPRESS_PRIORITY">AIR_EXPRESS_PRIORITY</option>
                  <option value="COLD_CHAIN_STANDARD">COLD_CHAIN_STANDARD</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Cargo Category</label>
                <select
                  value={formData.package_category}
                  onChange={(e) => setFormData({ ...formData, package_category: e.target.value })}
                  className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-amber-500"
                >
                  <option value="GENERAL_MERCHANDISE">GENERAL_MERCHANDISE</option>
                  <option value="MACHINERY_PARTS">MACHINERY_PARTS</option>
                  <option value="ELECTRONICS_CONSUMER">ELECTRONICS_CONSUMER</option>
                  <option value="CHEMICALS_HIGH_DENSITY">CHEMICALS_HIGH_DENSITY</option>
                  <option value="PHARMA_CRITICAL">PHARMA_CRITICAL</option>
                </select>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={screening}
              className="w-full mt-4 flex items-center justify-center space-x-2 py-3 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-white rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              {screening ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Evaluating Risk Telemetry...</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  <span>SCREEN CONSIGNMENT</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Live Result Panel (7 cols) */}
        <div className="lg:col-span-7 bg-stone-50 border border-stone-200 p-6 rounded-2xl shadow-xs">
          {lastResult ? (
            <div className="space-y-6">
              {/* Decision Header */}
              <div className="flex flex-wrap items-center justify-between pb-4 border-b border-stone-200">
                <div>
                  <div className="text-xs text-stone-500 font-medium">Screening Completed in {lastResult.processing_ms} ms</div>
                  <h2 className="text-xl font-serif font-bold text-stone-900 mt-0.5">
                    Consignment {lastResult.booking.booking_reference}
                  </h2>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className="text-[10px] text-stone-500 font-semibold uppercase">Risk Score</div>
                    <div className={`text-2xl font-serif font-bold ${
                      lastResult.assessment.final_score >= 70 ? 'text-rose-700' :
                      lastResult.assessment.final_score >= 30 ? 'text-amber-700' : 'text-emerald-700'
                    }`}>
                      {lastResult.assessment.final_score} / 100
                    </div>
                  </div>

                  <span className={`px-4 py-2 rounded-xl text-sm font-bold shadow-xs ${
                    lastResult.assessment.decision === 'BLOCK' ? 'bg-rose-600 text-white' :
                    lastResult.assessment.decision === 'HOLD' ? 'bg-amber-500 text-stone-950' : 'bg-emerald-600 text-white'
                  }`}>
                    {lastResult.assessment.decision}
                  </span>
                </div>
              </div>

              {/* Status Badges: Detection Level, Trust Score, ML Model */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 bg-white border border-stone-200 rounded-lg">
                  <div className="text-[10px] text-stone-500 font-semibold uppercase flex items-center space-x-1">
                    <Cpu className="w-3 h-3 text-stone-400" />
                    <span>Detection Policy</span>
                  </div>
                  <div className="font-mono font-bold text-stone-900 mt-0.5 text-[11px] truncate">
                    {lastResult.assessment.fallback_level}
                  </div>
                </div>

                <div className="p-2.5 bg-white border border-stone-200 rounded-lg">
                  <div className="text-[10px] text-stone-500 font-semibold uppercase flex items-center space-x-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>Digital Trust Index</span>
                  </div>
                  <div className="font-mono font-bold text-emerald-800 mt-0.5 text-sm">
                    {lastResult.assessment.digital_trust_score} / 100
                  </div>
                </div>

                <div className="p-2.5 bg-white border border-stone-200 rounded-lg">
                  <div className="text-[10px] text-stone-500 font-semibold uppercase flex items-center space-x-1">
                    <Scale className="w-3 h-3 text-stone-400" />
                    <span>ML Anomaly Score</span>
                  </div>
                  <div className="font-mono font-bold text-stone-800 mt-0.5 text-[11px]">
                    {lastResult.assessment.ml_anomaly_score.toFixed(3)} ({lastResult.assessment.ml_status})
                  </div>
                </div>
              </div>

              {/* Component Scores Breakdown */}
              <div>
                <div className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                  Risk Component Breakdown (0 - 100)
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                  <div className="p-2 bg-white rounded border border-stone-200">
                    <div className="text-[10px] text-stone-500 font-medium">Identity</div>
                    <div className="font-mono font-bold text-stone-800 mt-0.5">{lastResult.assessment.identity_score}</div>
                  </div>
                  <div className="p-2 bg-white rounded border border-stone-200">
                    <div className="text-[10px] text-stone-500 font-medium">Behavior</div>
                    <div className="font-mono font-bold text-stone-800 mt-0.5">{lastResult.assessment.behavior_score}</div>
                  </div>
                  <div className="p-2 bg-white rounded border border-stone-200">
                    <div className="text-[10px] text-stone-500 font-medium">Shipment</div>
                    <div className="font-mono font-bold text-stone-800 mt-0.5">{lastResult.assessment.shipment_score}</div>
                  </div>
                  <div className="p-2 bg-white rounded border border-stone-200">
                    <div className="text-[10px] text-stone-500 font-medium">Payment</div>
                    <div className="font-mono font-bold text-stone-800 mt-0.5">{lastResult.assessment.payment_score}</div>
                  </div>
                  <div className="p-2 bg-white rounded border border-stone-200">
                    <div className="text-[10px] text-stone-500 font-medium">Destination</div>
                    <div className="font-mono font-bold text-stone-800 mt-0.5">{lastResult.assessment.destination_score}</div>
                  </div>
                  <div className="p-2 bg-white rounded border border-stone-200">
                    <div className="text-[10px] text-stone-500 font-medium">Compliance</div>
                    <div className="font-mono font-bold text-stone-800 mt-0.5">{lastResult.assessment.compliance_score}</div>
                  </div>
                </div>
              </div>

              {/* GenAI / Deterministic Explanation */}
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1.5">
                <div className="flex items-center space-x-1.5 font-bold text-amber-900">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Explainable Decision Synthesis ({lastResult.assessment.explanation_source})</span>
                </div>
                <p className="text-stone-800 leading-relaxed italic">
                  "{lastResult.assessment.explanation}"
                </p>
              </div>

              {/* Authorized vs Observed Matrix */}
              {lastResult.assessment.authorized_vs_observed && (
                <div>
                  <div className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                    Privilege Integrity: Authorized vs Observed Matrix
                  </div>
                  <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-200 text-xs">
                    <div className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-stone-700">Destination: </span>
                        <span className="text-stone-900 font-mono">{lastResult.assessment.authorized_vs_observed.destination.observed}</span>
                        <span className="text-stone-400 text-[10px] block">
                          Permitted: {lastResult.assessment.authorized_vs_observed.destination.authorized.join(', ')}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        lastResult.assessment.authorized_vs_observed.destination.matches
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {lastResult.assessment.authorized_vs_observed.destination.matches ? 'MATCH' : 'VIOLATION'}
                      </span>
                    </div>

                    <div className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-stone-700">Weight: </span>
                        <span className="text-stone-900 font-mono font-bold">{lastResult.assessment.authorized_vs_observed.weight.observed} kg</span>
                        <span className="text-stone-400 text-[10px] block">
                          Ceiling: {lastResult.assessment.authorized_vs_observed.weight.authorized_max} kg (Multiple: {lastResult.assessment.authorized_vs_observed.weight.multiple}x)
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        lastResult.assessment.authorized_vs_observed.weight.matches
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {lastResult.assessment.authorized_vs_observed.weight.matches ? 'COMPLIANT' : 'EXCEEDED'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Incident Call to Action */}
              {lastResult.incident && onNavigateToIncident && (
                <div className="pt-2">
                  <button
                    onClick={() => onNavigateToIncident(lastResult.incident.id)}
                    className="w-full flex items-center justify-center space-x-2 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
                  >
                    <span>Open Investigation Workspace ({lastResult.incident.incident_number})</span>
                    <ArrowRight className="w-4 h-4 text-amber-500" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-24 text-center text-stone-400 space-y-3">
              <ShieldAlert className="w-12 h-12 mx-auto text-stone-300" />
              <div>
                <p className="text-sm font-semibold text-stone-600">Awaiting Consignment Telemetry</p>
                <p className="text-xs text-stone-400 max-w-sm mx-auto mt-1">
                  Select a test scenario preset or fill out the shipment manifest to run algorithmic risk detection.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
