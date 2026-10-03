import React, { useEffect, useState } from 'react';
import {
  Users, ShieldCheck, AlertTriangle, Eye, X, RefreshCw,
  ChevronLeft, ChevronRight, Building2, CreditCard, Smartphone,
  Scale, Lock, ShieldAlert, CheckCircle, ExternalLink, ArrowRight,
  TrendingUp, Compass, Calendar, AlertOctagon, Sparkles, Download,
  History, Clock, Tag, MapPin, FileCheck, Check, Filter,
  ArrowLeftRight, GitCompare, Plus, Columns, Minimize2, Maximize2,
  TrendingDown, FileSpreadsheet, ArrowUpRight, ArrowDownRight, Layers
} from 'lucide-react';
import { api } from '../services/api';
import { Shipper, ShipperHistoryEvent } from '../types';

interface ShippersPageProps {
  onNavigate?: (tab: string, shipperId?: string) => void;
}

export const ShippersPage: React.FC<ShippersPageProps> = ({ onNavigate }) => {
  const [shippers, setShippers] = useState<Shipper[]>([]);
  const [loading, setLoading] = useState(true);

  // Dual-Slot State
  const [slot1Index, setSlot1Index] = useState<number>(0);
  const [slot2Index, setSlot2Index] = useState<number | null>(null);
  const [slot1Detail, setSlot1Detail] = useState<any | null>(null);
  const [slot2Detail, setSlot2Detail] = useState<any | null>(null);
  const [slot2SelectorOpen, setSlot2SelectorOpen] = useState(false);

  // View States
  const [viewMode, setViewMode] = useState<'SINGLE' | 'COMPARISON'>('SINGLE');
  const [activeProfileTab, setActiveProfileTab] = useState<'BASELINES' | 'HISTORY'>('BASELINES');
  const [comparisonTab, setComparisonTab] = useState<'METRICS' | 'CORRIDORS' | 'HISTORY' | 'ACCOUNTS'>('METRICS');
  const [historyFilter, setHistoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'DETAILS' | 'HISTORY'>('DETAILS');

  const fetchShippers = async (isInitial = false) => {
    try {
      if (isInitial && shippers.length === 0) setLoading(true);
      const data = await api.getShippers();
      setShippers(data);
      if (data.length > 0) {
        loadSlot1Detail(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load shippers:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const loadSlot1Detail = async (shipperId: string) => {
    try {
      const res = await api.getShipper(shipperId);
      setSlot1Detail(res);
    } catch (err) {
      console.error('Failed to load slot 1 detail:', err);
    }
  };

  const loadSlot2Detail = async (shipperId: string) => {
    try {
      const res = await api.getShipper(shipperId);
      setSlot2Detail(res);
    } catch (err) {
      console.error('Failed to load slot 2 detail:', err);
    }
  };

  useEffect(() => {
    fetchShippers(true);
  }, []);

  const handleSelectSlot1 = (index: number) => {
    setSlot1Index(index);
    if (shippers[index]) {
      loadSlot1Detail(shippers[index].id);
    }
  };

  const handleSelectSlot2 = (index: number | null) => {
    setSlot2Index(index);
    setSlot2SelectorOpen(false);
    if (index !== null && shippers[index]) {
      loadSlot2Detail(shippers[index].id);
      setViewMode('COMPARISON');
    } else {
      setSlot2Detail(null);
      setViewMode('SINGLE');
    }
  };

  const handleSwapSlots = () => {
    if (slot2Index === null) return;
    const tempIdx = slot1Index;
    const tempDetail = slot1Detail;
    setSlot1Index(slot2Index);
    setSlot1Detail(slot2Detail);
    setSlot2Index(tempIdx);
    setSlot2Detail(tempDetail);
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

  const openFullModal = (tab: 'DETAILS' | 'HISTORY' = 'DETAILS') => {
    setModalTab(tab);
    setModalOpen(true);
  };

  const filteredShippers = shippers.filter(s => {
    const q = searchQuery.toLowerCase();
    return !q ||
      s.company_name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      s.country.toLowerCase().includes(q);
  });

  const slot1Shipper: Shipper | undefined = shippers[slot1Index];
  const slot2Shipper: Shipper | undefined = slot2Index !== null ? shippers[slot2Index] : undefined;

  const slot1History: ShipperHistoryEvent[] = slot1Detail?.history || [];
  const slot2History: ShipperHistoryEvent[] = slot2Detail?.history || [];

  const filterHistoryList = (list: ShipperHistoryEvent[]) => {
    return list.filter(evt => {
      if (historyFilter === 'ALL') return true;
      if (historyFilter === 'SECURITY' && evt.category === 'SECURITY_FLAG') return true;
      if (historyFilter === 'KYC' && (evt.category === 'KYC_AUDIT' || evt.category === 'REGISTRATION')) return true;
      if (historyFilter === 'CUSTOMS' && (evt.category === 'CUSTOMS_CLEARANCE' || evt.category === 'CORRIDOR_APPROVAL' || evt.category === 'INSPECTION')) return true;
      return true;
    });
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'SECURITY_FLAG':
        return { bg: 'bg-rose-100 text-rose-800 border-rose-200', icon: AlertOctagon };
      case 'KYC_AUDIT':
        return { bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: ShieldCheck };
      case 'REGISTRATION':
        return { bg: 'bg-blue-100 text-blue-800 border-blue-200', icon: Building2 };
      case 'CUSTOMS_CLEARANCE':
        return { bg: 'bg-cyan-100 text-cyan-800 border-cyan-200', icon: FileCheck };
      case 'CORRIDOR_APPROVAL':
        return { bg: 'bg-purple-100 text-purple-800 border-purple-200', icon: Compass };
      case 'CREDIT_LIMIT':
        return { bg: 'bg-amber-100 text-amber-800 border-amber-200', icon: CreditCard };
      case 'INSPECTION':
        return { bg: 'bg-orange-100 text-orange-800 border-orange-200', icon: Scale };
      case 'DEVICE_BIND':
        return { bg: 'bg-stone-100 text-stone-800 border-stone-200', icon: Smartphone };
      default:
        return { bg: 'bg-stone-100 text-stone-700 border-stone-200', icon: Tag };
    }
  };

  // Comparative calculations
  const trustDelta = (slot1Shipper && slot2Shipper) ? (slot1Shipper.trust_score - slot2Shipper.trust_score) : 0;
  const weightAvgDelta = (slot1Shipper && slot2Shipper) ? (slot1Shipper.average_weight_kg - slot2Shipper.average_weight_kg) : 0;
  const maxWeightDelta = (slot1Shipper && slot2Shipper) ? (slot1Shipper.max_weight_kg - slot2Shipper.max_weight_kg) : 0;
  const incidentDelta = (slot1Shipper && slot2Shipper) ? (slot1Shipper.historical_incidents_count - slot2Shipper.historical_incidents_count) : 0;

  // Corridor comparisons
  const sharedOrigins = (slot1Shipper && slot2Shipper)
    ? slot1Shipper.common_origins.filter(orig => slot2Shipper.common_origins.includes(orig))
    : [];
  const sharedDestinations = (slot1Shipper && slot2Shipper)
    ? slot1Shipper.common_destinations.filter(dest => slot2Shipper.common_destinations.includes(dest))
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-stone-900 flex items-center space-x-2">
            <span>Shippers & Consignor Identity Registry</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-200 text-stone-700 font-mono font-bold">
              {shippers.length} Registered
            </span>
          </h1>
          <p className="text-sm text-stone-600">
            Multi-slot entity benchmarking, risk differential analysis, and chronological audit histories.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* View Mode Toggle */}
          {slot2Shipper && (
            <div className="bg-stone-100 p-1 rounded-xl flex items-center border border-stone-300 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('SINGLE')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center space-x-1 ${
                  viewMode === 'SINGLE' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Single View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('COMPARISON')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center space-x-1 ${
                  viewMode === 'COMPARISON' ? 'bg-amber-600 text-stone-950 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>Side-by-Side Compare</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => fetchShippers(false)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold border border-stone-300 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* DUAL-SLOT BENCHMARK SELECTION CONTROL BAR */}
      <div className="bg-stone-900 text-white p-4 rounded-2xl shadow-sm border border-stone-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800 pb-2.5">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-mono uppercase tracking-wider font-bold text-stone-300">
              Comparative Analysis Console
            </span>
          </div>
          <div className="text-[11px] text-stone-400 font-mono flex items-center space-x-3">
            <span>Slot 1: <strong className="text-amber-300">{slot1Shipper?.company_name || 'None'}</strong></span>
            <span>&bull;</span>
            <span>Slot 2: <strong className={slot2Shipper ? 'text-sky-300' : 'text-stone-500'}>{slot2Shipper?.company_name || 'Unassigned'}</strong></span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Slot 1 Box (5 cols) */}
          <div className="md:col-span-5 bg-stone-800/90 border border-stone-700 rounded-xl p-3 flex items-center justify-between">
            <div className="space-y-0.5 truncate pr-2">
              <div className="flex items-center space-x-1.5">
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  SLOT 1 • SUBJECT
                </span>
                <span className="font-mono text-[10px] text-stone-400">{slot1Shipper?.id}</span>
              </div>
              <div className="font-bold text-sm text-white truncate">
                {slot1Shipper?.company_name}
              </div>
              <div className="text-[11px] text-stone-400 flex items-center space-x-2 font-mono">
                <span>Trust: <strong className={slot1Shipper && slot1Shipper.trust_score >= 70 ? 'text-emerald-400' : 'text-rose-400'}>{slot1Shipper?.trust_score}/100</strong></span>
                <span>&bull;</span>
                <span>Max: {slot1Shipper?.max_weight_kg}kg</span>
              </div>
            </div>

            <select
              value={slot1Index}
              onChange={(e) => handleSelectSlot1(Number(e.target.value))}
              className="bg-stone-900 border border-stone-600 rounded-lg px-2 py-1 text-xs text-stone-200 cursor-pointer focus:outline-hidden"
            >
              {shippers.map((s, idx) => (
                <option key={s.id} value={idx}>
                  Change: {s.id}
                </option>
              ))}
            </select>
          </div>

          {/* Center Connector / Swap (2 cols) */}
          <div className="md:col-span-2 flex items-center justify-center">
            {slot2Shipper ? (
              <div className="flex items-center space-x-1.5 bg-stone-800 p-1.5 rounded-xl border border-stone-700">
                <button
                  type="button"
                  onClick={handleSwapSlots}
                  title="Swap Slot 1 and Slot 2"
                  className="p-1.5 hover:bg-stone-700 rounded-lg text-amber-400 transition cursor-pointer"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>
                <span className="font-mono font-bold text-[10px] text-stone-400 px-1">VS</span>
                <button
                  type="button"
                  onClick={() => handleSelectSlot2(null)}
                  title="Clear Slot 2 Comparison"
                  className="p-1.5 hover:bg-stone-700 rounded-lg text-rose-400 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="px-3 py-1 bg-stone-800/50 rounded-full border border-stone-700 text-[11px] font-mono font-bold text-stone-400">
                VS
              </div>
            )}
          </div>

          {/* Slot 2 Box (5 cols) */}
          <div className="md:col-span-5">
            {slot2Shipper ? (
              <div className="bg-stone-800/90 border border-sky-800/60 rounded-xl p-3 flex items-center justify-between">
                <div className="space-y-0.5 truncate pr-2">
                  <div className="flex items-center space-x-1.5">
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                      SLOT 2 • BENCHMARK
                    </span>
                    <span className="font-mono text-[10px] text-stone-400">{slot2Shipper.id}</span>
                  </div>
                  <div className="font-bold text-sm text-white truncate">
                    {slot2Shipper.company_name}
                  </div>
                  <div className="text-[11px] text-stone-400 flex items-center space-x-2 font-mono">
                    <span>Trust: <strong className={slot2Shipper.trust_score >= 70 ? 'text-emerald-400' : 'text-rose-400'}>{slot2Shipper.trust_score}/100</strong></span>
                    <span>&bull;</span>
                    <span>Max: {slot2Shipper.max_weight_kg}kg</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => setSlot2SelectorOpen(true)}
                    className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectSlot2(null)}
                    className="p-1 hover:bg-stone-700 text-stone-400 hover:text-rose-400 rounded transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-stone-700 hover:border-amber-500/60 bg-stone-800/40 rounded-xl p-2.5 flex items-center justify-between transition">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-stone-300 flex items-center space-x-1.5">
                    <GitCompare className="w-3.5 h-3.5 text-amber-400" />
                    <span>Choose 2nd Slot to Compare With</span>
                  </div>
                  <div className="text-[11px] text-stone-400">
                    Benchmark against another enterprise, cold-start, or quarantined profile.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSlot2SelectorOpen(true)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center space-x-1 shrink-0 ml-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Choose Slot 2</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quick Comparison Presets if Slot 2 not assigned */}
        {!slot2Shipper && shippers.length > 1 && (
          <div className="pt-2 border-t border-stone-800/60 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-stone-400 font-mono text-[11px]">Recommended Benchmarks:</span>
            {shippers.filter((_, idx) => idx !== slot1Index).slice(0, 3).map((s) => {
              const actualIdx = shippers.findIndex(item => item.id === s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectSlot2(actualIdx)}
                  className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-[11px] font-semibold border border-stone-700 transition cursor-pointer flex items-center space-x-1"
                >
                  <span>+ {s.company_name.split(' ')[0]} ({s.id})</span>
                  <span className={`text-[10px] px-1 rounded ${
                    s.status === 'BLOCKED' ? 'bg-rose-900/60 text-rose-300' : 'bg-emerald-900/60 text-emerald-300'
                  }`}>
                    {s.trust_score}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Dual-Pane Navigation: Selector List on Left, Comprehensive Profile/Comparison on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (4 cols): Searchable Shipper Selector */}
        <div className="lg:col-span-4 bg-white border border-stone-200 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Consignor Directory ({shippers.length})
            </span>
            <span className="text-[11px] font-mono text-stone-500">
              Active: {slot1Index + 1}/{shippers.length}
            </span>
          </div>

          {/* Search box */}
          <input
            type="text"
            placeholder="Search company, ID, or country..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-1.5 text-xs focus:outline-hidden focus:ring-1 focus:ring-amber-500"
          />

          {/* List of entities */}
          <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1 pt-1">
            {filteredShippers.map((s) => {
              const actualIdx = shippers.findIndex(item => item.id === s.id);
              const isSlot1 = actualIdx === slot1Index;
              const isSlot2 = actualIdx === slot2Index;
              return (
                <div
                  key={s.id}
                  onClick={() => handleSelectSlot1(actualIdx)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition space-y-2 ${
                    isSlot1
                      ? 'bg-amber-50/90 border-amber-400 shadow-xs ring-1 ring-amber-400'
                      : isSlot2
                      ? 'bg-sky-50/90 border-sky-400 shadow-xs ring-1 ring-sky-400'
                      : 'bg-stone-50/50 hover:bg-stone-100 border-stone-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-0.5 truncate pr-2">
                      <div className="flex items-center space-x-1.5">
                        {isSlot1 && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500 text-stone-950 font-mono">
                            SLOT 1
                          </span>
                        )}
                        {isSlot2 && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-600 text-white font-mono">
                            SLOT 2
                          </span>
                        )}
                        <span className="font-bold text-stone-900 truncate">{s.company_name}</span>
                      </div>
                      <div className="font-mono text-[11px] text-stone-500">{s.id} &bull; {s.country}</div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className={`font-mono font-bold text-[11px] ${
                        s.trust_score >= 75 ? 'text-emerald-700' : s.trust_score >= 45 ? 'text-amber-700' : 'text-rose-700'
                      }`}>
                        {s.trust_score} Trust
                      </div>
                      <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        s.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                        s.status === 'BLOCKED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {s.status}
                      </span>
                    </div>
                  </div>

                  {/* Entity Card Actions */}
                  <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between text-[11px]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectSlot1(actualIdx);
                        setActiveProfileTab('HISTORY');
                        setViewMode('SINGLE');
                      }}
                      className="inline-flex items-center space-x-1 text-stone-600 hover:text-stone-900 font-semibold cursor-pointer"
                    >
                      <History className="w-3 h-3 text-amber-600" />
                      <span>History</span>
                    </button>

                    {!isSlot1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSlot2) {
                            handleSelectSlot2(null);
                          } else {
                            handleSelectSlot2(actualIdx);
                          }
                        }}
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded font-semibold transition cursor-pointer ${
                          isSlot2
                            ? 'bg-sky-100 text-sky-800 border border-sky-300'
                            : 'bg-stone-200/70 hover:bg-stone-300 text-stone-700'
                        }`}
                      >
                        <GitCompare className="w-3 h-3" />
                        <span>{isSlot2 ? 'Remove Slot 2' : '+ Compare as Slot 2'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center / Right Column: Focused Workspace (Single or Dual Comparative) */}
        <div className="lg:col-span-8 space-y-6">
          {/* ===================== COMPARATIVE ANALYSIS VIEW ===================== */}
          {viewMode === 'COMPARISON' && slot1Shipper && slot2Shipper ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-6">
              {/* Comparative Analysis Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-5">
                <div>
                  <div className="flex items-center space-x-2">
                    <GitCompare className="w-5 h-5 text-amber-600" />
                    <h2 className="text-xl font-bold text-stone-900">
                      Dual-Entity Comparative Risk Dossier
                    </h2>
                  </div>
                  <p className="text-xs text-stone-500 font-mono mt-0.5">
                    Direct benchmark comparison between <strong>{slot1Shipper.company_name}</strong> vs <strong>{slot2Shipper.company_name}</strong>
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      // Trigger download of official comparative report
                      alert(`Comparative dossier compiled for ${slot1Shipper.id} vs ${slot2Shipper.id}.`);
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition border border-stone-300 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-stone-600" />
                    <span>Export Comparative Audit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('SINGLE')}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Close Comparison</span>
                  </button>
                </div>
              </div>

              {/* Comparative Executive KPI Differential Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {/* Digital Trust Variance */}
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                  <div className="text-[10px] font-bold text-stone-400 uppercase">Trust Score Variance</div>
                  <div className="flex items-baseline space-x-1.5">
                    <span className={`text-2xl font-bold font-mono ${
                      trustDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {trustDelta >= 0 ? `+${trustDelta}` : trustDelta}
                    </span>
                    <span className="text-[11px] text-stone-500 font-mono">pts</span>
                  </div>
                  <div className="text-[11px] text-stone-500 truncate">
                    {slot1Shipper.trust_score} vs {slot2Shipper.trust_score}
                  </div>
                </div>

                {/* Max Permitted Weight Variance */}
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                  <div className="text-[10px] font-bold text-stone-400 uppercase">Ceiling Weight Gap</div>
                  <div className="flex items-baseline space-x-1.5">
                    <span className={`text-2xl font-bold font-mono ${
                      maxWeightDelta === 0 ? 'text-stone-800' : 'text-amber-700'
                    }`}>
                      {maxWeightDelta > 0 ? `+${maxWeightDelta}` : maxWeightDelta}
                    </span>
                    <span className="text-[11px] text-stone-500 font-mono">kg</span>
                  </div>
                  <div className="text-[11px] text-stone-500 truncate">
                    {slot1Shipper.max_weight_kg}kg vs {slot2Shipper.max_weight_kg}kg
                  </div>
                </div>

                {/* Historical Incident Disparity */}
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                  <div className="text-[10px] font-bold text-stone-400 uppercase">Incidents Differential</div>
                  <div className="flex items-baseline space-x-1.5">
                    <span className={`text-2xl font-bold font-mono ${
                      incidentDelta > 0 ? 'text-rose-700' : incidentDelta < 0 ? 'text-emerald-700' : 'text-stone-700'
                    }`}>
                      {incidentDelta > 0 ? `+${incidentDelta}` : incidentDelta}
                    </span>
                    <span className="text-[11px] text-stone-500 font-mono">cases</span>
                  </div>
                  <div className="text-[11px] text-stone-500 truncate">
                    {slot1Shipper.historical_incidents_count} vs {slot2Shipper.historical_incidents_count} cases
                  </div>
                </div>

                {/* KYC Statutory Alignment */}
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                  <div className="text-[10px] font-bold text-stone-400 uppercase">KYC Alignment</div>
                  <div className="font-bold text-stone-900 flex items-center space-x-1 mt-1">
                    {slot1Shipper.kyc_status === slot2Shipper.kyc_status ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    )}
                    <span className="text-sm">
                      {slot1Shipper.kyc_status === slot2Shipper.kyc_status ? 'Aligned' : 'Divergent'}
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-500 truncate">
                    {slot1Shipper.kyc_status} vs {slot2Shipper.kyc_status}
                  </div>
                </div>
              </div>

              {/* Comparison Tabs */}
              <div className="flex items-center space-x-2 border-b border-stone-200 pb-3 text-xs">
                <button
                  type="button"
                  onClick={() => setComparisonTab('METRICS')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                    comparisonTab === 'METRICS'
                      ? 'bg-amber-600 text-stone-950 shadow-xs'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>Side-by-Side Baselines</span>
                </button>

                <button
                  type="button"
                  onClick={() => setComparisonTab('CORRIDORS')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                    comparisonTab === 'CORRIDORS'
                      ? 'bg-amber-600 text-stone-950 shadow-xs'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Corridors & Route Overlap</span>
                </button>

                <button
                  type="button"
                  onClick={() => setComparisonTab('HISTORY')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                    comparisonTab === 'HISTORY'
                      ? 'bg-amber-600 text-stone-950 shadow-xs'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Audit History Comparison</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-stone-200 text-stone-800">
                    {slot1History.length} vs {slot2History.length}
                  </span>
                </button>
              </div>

              {/* COMPARISON TAB 1: SIDE-BY-SIDE BASELINES */}
              {comparisonTab === 'METRICS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Slot 1 Column */}
                  <div className="bg-stone-50 border-2 border-amber-300 rounded-xl p-5 space-y-4 text-xs">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700">
                          SLOT 1 • SUBJECT
                        </span>
                        <h3 className="font-bold text-sm text-stone-900">{slot1Shipper.company_name}</h3>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        slot1Shipper.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {slot1Shipper.status}
                      </span>
                    </div>

                    <div className="space-y-2 font-mono">
                      <div className="flex justify-between py-1 border-b border-stone-200/60">
                        <span className="text-stone-500">Shipper ID:</span>
                        <span className="font-bold text-stone-900">{slot1Shipper.id}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200/60">
                        <span className="text-stone-500">Country of Incorporation:</span>
                        <span className="font-bold text-stone-900">{slot1Shipper.country}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200/60">
                        <span className="text-stone-500">Digital Trust Index:</span>
                        <span className="font-bold text-emerald-700">{slot1Shipper.trust_score}/100</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200/60">
                        <span className="text-stone-500">KYC Clearance:</span>
                        <span className="font-bold text-stone-900">{slot1Shipper.kyc_status}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200/60">
                        <span className="text-stone-500">Average Booking Weight:</span>
                        <span className="font-bold text-stone-900">{slot1Shipper.average_weight_kg} kg</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200/60">
                        <span className="text-stone-500">Max Permitted Weight:</span>
                        <span className="font-bold text-stone-900">{slot1Shipper.max_weight_kg} kg</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200/60">
                        <span className="text-stone-500">Total Lifetime Screenings:</span>
                        <span className="font-bold text-stone-900">{slot1Shipper.total_bookings}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-stone-500">Historical Incidents:</span>
                        <span className={`font-bold ${slot1Shipper.historical_incidents_count === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {slot1Shipper.historical_incidents_count}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Slot 2 Column */}
                  <div className="bg-stone-50 border-2 border-sky-300 rounded-xl p-5 space-y-4 text-xs">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-700">
                          SLOT 2 • BENCHMARK
                        </span>
                        <h3 className="font-bold text-sm text-stone-900">{slot2Shipper.company_name}</h3>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        slot2Shipper.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {slot2Shipper.status}
                      </span>
                    </div>

                    <div className="space-y-2 font-mono">
                      <div className="flex justify-between py-1 border-b border-stone-200/60">
                        <span className="text-stone-500">Shipper ID:</span>
                        <span className="font-bold text-stone-900">{slot2Shipper.id}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200/60">
                        <span className="text-stone-500">Country of Incorporation:</span>
                        <span className="font-bold text-stone-900">{slot2Shipper.country}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200/60">
                        <span className="text-stone-500">Digital Trust Index:</span>
                        <span className={`font-bold ${slot2Shipper.trust_score >= 70 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {slot2Shipper.trust_score}/100
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200/60">
                        <span className="text-stone-500">KYC Clearance:</span>
                        <span className="font-bold text-stone-900">{slot2Shipper.kyc_status}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200/60">
                        <span className="text-stone-500">Average Booking Weight:</span>
                        <span className="font-bold text-stone-900">{slot2Shipper.average_weight_kg} kg</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200/60">
                        <span className="text-stone-500">Max Permitted Weight:</span>
                        <span className="font-bold text-stone-900">{slot2Shipper.max_weight_kg} kg</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200/60">
                        <span className="text-stone-500">Total Lifetime Screenings:</span>
                        <span className="font-bold text-stone-900">{slot2Shipper.total_bookings}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-stone-500">Historical Incidents:</span>
                        <span className={`font-bold ${slot2Shipper.historical_incidents_count === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {slot2Shipper.historical_incidents_count}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* COMPARISON TAB 2: CORRIDORS & ROUTING OVERLAP */}
              {comparisonTab === 'CORRIDORS' && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2">
                    <h4 className="font-bold text-stone-900 flex items-center space-x-1.5">
                      <Compass className="w-4 h-4 text-amber-600" />
                      <span>Shared Route & Corridor Topologies</span>
                    </h4>
                    <p className="text-stone-600">
                      Identifying common transit gateways where both shippers share port authority exposure.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div>
                        <span className="text-[10px] font-bold text-stone-500 uppercase block mb-1">
                          Shared Origin Ports ({sharedOrigins.length})
                        </span>
                        {sharedOrigins.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {sharedOrigins.map(p => (
                              <span key={p} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-mono font-bold">
                                {p}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-stone-500 italic">No shared origins</span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-stone-500 uppercase block mb-1">
                          Shared Destination Hubs ({sharedDestinations.length})
                        </span>
                        {sharedDestinations.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {sharedDestinations.map(p => (
                              <span key={p} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-mono font-bold">
                                {p}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-stone-500 italic">No shared destinations</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Divergent Corridor Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                      <div className="font-bold text-stone-800 text-xs">{slot1Shipper.company_name} All Corridors</div>
                      <div className="space-y-1 font-mono text-[11px]">
                        <div>Origins: {slot1Shipper.common_origins.join(', ')}</div>
                        <div>Destinations: {slot1Shipper.common_destinations.join(', ')}</div>
                      </div>
                    </div>

                    <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                      <div className="font-bold text-stone-800 text-xs">{slot2Shipper.company_name} All Corridors</div>
                      <div className="space-y-1 font-mono text-[11px]">
                        <div>Origins: {slot2Shipper.common_origins.join(', ')}</div>
                        <div>Destinations: {slot2Shipper.common_destinations.join(', ')}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* COMPARISON TAB 3: SIDE-BY-SIDE EVENT HISTORY */}
              {comparisonTab === 'HISTORY' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  {/* Slot 1 History */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                      <h4 className="font-bold text-stone-900">{slot1Shipper.company_name} Events</h4>
                      <span className="font-mono text-stone-500">{slot1History.length} total</span>
                    </div>

                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {slot1History.map(evt => {
                        const badge = getCategoryBadge(evt.category);
                        return (
                          <div key={evt.id} className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                            <div className="flex items-center justify-between">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${badge.bg}`}>
                                {evt.category}
                              </span>
                              <span className="font-mono text-[10px] text-stone-500">
                                {new Date(evt.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="font-bold text-stone-900 text-xs">{evt.title}</div>
                            <p className="text-[11px] text-stone-600 line-clamp-2">{evt.description}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Slot 2 History */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                      <h4 className="font-bold text-stone-900">{slot2Shipper.company_name} Events</h4>
                      <span className="font-mono text-stone-500">{slot2History.length} total</span>
                    </div>

                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {slot2History.map(evt => {
                        const badge = getCategoryBadge(evt.category);
                        return (
                          <div key={evt.id} className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                            <div className="flex items-center justify-between">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${badge.bg}`}>
                                {evt.category}
                              </span>
                              <span className="font-mono text-[10px] text-stone-500">
                                {new Date(evt.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="font-bold text-stone-900 text-xs">{evt.title}</div>
                            <p className="text-[11px] text-stone-600 line-clamp-2">{evt.description}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ===================== SINGLE PROFILE VIEW ===================== */
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-6">
              {slot1Shipper ? (
                <>
                  {/* Profile Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-5">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-5 h-5 text-amber-600" />
                        <h2 className="text-xl font-bold text-stone-900">{slot1Shipper.company_name}</h2>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          slot1Shipper.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                          slot1Shipper.status === 'BLOCKED' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                          'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {slot1Shipper.status}
                        </span>
                      </div>
                      <div className="text-xs text-stone-500 font-mono">
                        ID: <strong className="text-stone-800">{slot1Shipper.id}</strong> &bull; Region: {slot1Shipper.country} &bull; Email: {slot1Shipper.email}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Compare with 2nd Slot Button */}
                      <button
                        type="button"
                        onClick={() => setSlot2SelectorOpen(true)}
                        className="flex items-center space-x-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition border border-stone-300 cursor-pointer"
                        title="Choose a 2nd shipper slot to benchmark with"
                      >
                        <GitCompare className="w-4 h-4 text-amber-600" />
                        <span>Compare With...</span>
                      </button>

                      {/* Reaction Button: HISTORY */}
                      <button
                        type="button"
                        onClick={() => setActiveProfileTab(activeProfileTab === 'HISTORY' ? 'BASELINES' : 'HISTORY')}
                        className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer border ${
                          activeProfileTab === 'HISTORY'
                            ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 border-amber-400 ring-2 ring-amber-400/40'
                            : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                        }`}
                        title="View complete historical audit and operations timeline"
                      >
                        <History className="w-4 h-4 text-amber-800" />
                        <span>History</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          activeProfileTab === 'HISTORY' ? 'bg-amber-800 text-white' : 'bg-amber-200/80 text-amber-900'
                        }`}>
                          {slot1History.length}
                        </span>
                      </button>

                      {/* Download Approval Report for Approved Shippers */}
                      {(slot1Shipper.status === 'ACTIVE' || slot1Shipper.kyc_status === 'VERIFIED') && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const rep = await api.generateShipperApprovalReport(slot1Shipper.id);
                              triggerDownload(rep.download_url, rep.filename);
                            } catch (err: any) {
                              alert(`Approval report download failed: ${err.message}`);
                            }
                          }}
                          className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                          title="Download Official Shipper Approval & KYC Accreditation Certificate PDF"
                        >
                          <Download className="w-4 h-4 text-emerald-200" />
                          <span>Download Approval Report</span>
                        </button>
                      )}

                      {/* Pop-up Full Profile Button */}
                      <button
                        type="button"
                        onClick={() => openFullModal('DETAILS')}
                        className="flex items-center space-x-1.5 px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        <Eye className="w-4 h-4 text-amber-400" />
                        <span>Pop-up Dossier</span>
                      </button>
                    </div>
                  </div>

                  {/* Profile View Tabs */}
                  <div className="flex items-center space-x-2 border-b border-stone-200 pb-3">
                    <button
                      type="button"
                      onClick={() => setActiveProfileTab('BASELINES')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                        activeProfileTab === 'BASELINES'
                          ? 'bg-stone-900 text-white shadow-xs'
                          : 'text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Operational Baselines & Accounts</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveProfileTab('HISTORY')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                        activeProfileTab === 'HISTORY'
                          ? 'bg-amber-500 text-stone-950 shadow-xs'
                          : 'text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Audit & Event History</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-stone-200 text-stone-800">
                        {slot1History.length}
                      </span>
                    </button>
                  </div>

                  {/* View 1: BASELINES & CORRIDORS */}
                  {activeProfileTab === 'BASELINES' && (
                    <div className="space-y-6">
                      {/* Key Baseline Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                          <div className="text-[10px] font-bold text-stone-400 uppercase">Digital Trust Index</div>
                          <div className="flex items-baseline space-x-1">
                            <span className={`text-2xl font-bold font-mono ${
                              slot1Shipper.trust_score >= 75 ? 'text-emerald-700' :
                              slot1Shipper.trust_score >= 45 ? 'text-amber-700' : 'text-rose-700'
                            }`}>
                              {slot1Shipper.trust_score}
                            </span>
                            <span className="text-stone-400 font-mono text-xs">/100</span>
                          </div>
                          <div className="text-[11px] text-stone-500">
                            {slot1Shipper.historical_incidents_count === 0 ? 'Flawless track record' : `${slot1Shipper.historical_incidents_count} flagged incidents`}
                          </div>
                        </div>

                        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                          <div className="text-[10px] font-bold text-stone-400 uppercase">Baseline Avg Weight</div>
                          <div className="text-2xl font-bold font-mono text-stone-900">
                            {slot1Shipper.average_weight_kg} <span className="text-sm font-normal text-stone-500">kg</span>
                          </div>
                          <div className="text-[11px] text-stone-500">Calculated over {slot1Shipper.total_bookings} dispatches</div>
                        </div>

                        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                          <div className="text-[10px] font-bold text-stone-400 uppercase">Max Permitted Weight</div>
                          <div className="text-2xl font-bold font-mono text-stone-900">
                            {slot1Shipper.max_weight_kg} <span className="text-sm font-normal text-stone-500">kg</span>
                          </div>
                          <div className="text-[11px] text-stone-500">Authorization ceiling</div>
                        </div>

                        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                          <div className="text-[10px] font-bold text-stone-400 uppercase">Statutory KYC State</div>
                          <div className="flex items-center space-x-1 mt-1">
                            {slot1Shipper.kyc_status === 'VERIFIED' ? (
                              <CheckCircle className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-amber-600" />
                            )}
                            <span className="font-bold text-stone-900">{slot1Shipper.kyc_status}</span>
                          </div>
                          <div className="text-[11px] text-stone-500">
                            {slot1Shipper.verified_identity ? 'Verified Identity IEC' : 'Pending Verification'}
                          </div>
                        </div>
                      </div>

                      {/* Corridors & Shipping Patterns */}
                      <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3 text-xs">
                        <div className="font-bold text-stone-800 text-xs flex items-center space-x-1.5">
                          <Compass className="w-4 h-4 text-amber-600" />
                          <span>Approved Shipping Corridors & Routings</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">Common Origin Ports</span>
                            <div className="flex flex-wrap gap-1.5">
                              {slot1Shipper.common_origins.map(orig => (
                                <span key={orig} className="px-2 py-0.5 bg-white border border-stone-300 rounded font-mono text-[11px] text-stone-800">
                                  {orig}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">Authorized Destination Hubs</span>
                            <div className="flex flex-wrap gap-1.5">
                              {slot1Shipper.common_destinations.map(dest => (
                                <span key={dest} className="px-2 py-0.5 bg-white border border-stone-300 rounded font-mono text-[11px] text-stone-800">
                                  {dest}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Configured Permission Profiles */}
                      {slot1Detail?.permissions && slot1Detail.permissions.length > 0 && (
                        <div className="space-y-2 text-xs">
                          <div className="font-bold text-stone-800 flex items-center space-x-1.5">
                            <ShieldCheck className="w-4 h-4 text-amber-600" />
                            <span>Configured Account Privileges & Tier Limits</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {slot1Detail.permissions.map((p: any) => (
                              <div key={p.id} className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                                <div className="flex items-center justify-between font-mono text-[11px]">
                                  <span className="font-bold text-stone-900">{p.account_id}</span>
                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                                    Limit {p.max_weight_kg}kg
                                  </span>
                                </div>
                                <div className="text-[11px] text-stone-600 space-y-1">
                                  <div>Scope: {p.allowed_international ? 'Domestic + International Air' : 'Domestic Ground Only'}</div>
                                  <div>Service Tiers: {p.allowed_service_types?.join(', ') || 'Standard'}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* View 2: AUDIT & EVENT HISTORY TIMELINE */}
                  {activeProfileTab === 'HISTORY' && (
                    <div className="space-y-4">
                      {/* Timeline Filter Controls */}
                      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs">
                        <div className="flex items-center space-x-2">
                          <History className="w-4 h-4 text-amber-600" />
                          <span className="font-bold text-stone-800">
                            Historical Ledger ({filterHistoryList(slot1History).length} events)
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1">
                          {[
                            { id: 'ALL', label: 'All Events' },
                            { id: 'KYC', label: 'KYC & Audits' },
                            { id: 'SECURITY', label: 'Security Flags' },
                            { id: 'CUSTOMS', label: 'Customs & Corridors' }
                          ].map(pill => (
                            <button
                              key={pill.id}
                              type="button"
                              onClick={() => setHistoryFilter(pill.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                historyFilter === pill.id
                                  ? 'bg-amber-600 text-stone-950 font-bold shadow-xs'
                                  : 'bg-white hover:bg-stone-200 text-stone-600 border border-stone-200'
                              }`}
                            >
                              {pill.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Vertical Chronological Timeline */}
                      {filterHistoryList(slot1History).length === 0 ? (
                        <div className="p-8 text-center bg-stone-50 rounded-xl border border-stone-200 text-stone-500 text-xs">
                          No historical events recorded under this filter.
                        </div>
                      ) : (
                        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
                          {filterHistoryList(slot1History).map((evt) => {
                            const badge = getCategoryBadge(evt.category);
                            const IconComponent = badge.icon;
                            return (
                              <div key={evt.id} className="relative group">
                                <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-amber-600 flex items-center justify-center shadow-xs">
                                  <div className="w-2 h-2 rounded-full bg-amber-600" />
                                </div>

                                <div className="p-4 bg-white hover:bg-stone-50/80 border border-stone-200 rounded-xl shadow-xs space-y-2 transition">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center space-x-2">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center space-x-1 ${badge.bg}`}>
                                        <IconComponent className="w-3 h-3" />
                                        <span>{evt.category.replace('_', ' ')}</span>
                                      </span>
                                      <h4 className="font-bold text-xs text-stone-900">{evt.title}</h4>
                                    </div>

                                    <div className="flex items-center space-x-2 text-[11px] text-stone-500 font-mono">
                                      <Clock className="w-3 h-3 text-stone-400" />
                                      <span>{new Date(evt.timestamp).toLocaleString()}</span>
                                    </div>
                                  </div>

                                  <p className="text-xs text-stone-700 leading-relaxed">
                                    {evt.description}
                                  </p>

                                  <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500 font-mono">
                                    <div className="flex items-center space-x-3">
                                      <span>Actor: <strong className="text-stone-700">{evt.actor}</strong></span>
                                      {evt.port && (
                                        <span className="flex items-center space-x-1 text-stone-600">
                                          <MapPin className="w-3 h-3 text-amber-600" />
                                          <span>{evt.port}</span>
                                        </span>
                                      )}
                                    </div>

                                    {evt.risk_delta !== undefined && evt.risk_delta !== 0 && (
                                      <span className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                                        evt.risk_delta > 0
                                          ? 'bg-rose-100 text-rose-800'
                                          : 'bg-emerald-100 text-emerald-800'
                                      }`}>
                                        {evt.risk_delta > 0 ? `+${evt.risk_delta}` : evt.risk_delta} Risk Delta
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-20 text-stone-400">
                  <Users className="w-12 h-12 mx-auto text-stone-300 mb-2" />
                  <p className="font-semibold text-stone-600">No Shipper Selected</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CHOOSE 2ND SLOT SELECTION MODAL */}
      {slot2SelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-300 w-full max-w-lg overflow-hidden text-xs">
            <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-sky-400 font-bold uppercase tracking-wider">
                  BENCHMARKING SELECTION
                </span>
                <h3 className="font-bold text-base mt-0.5">
                  Choose 2nd Slot to Compare With
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSlot2SelectorOpen(false)}
                className="p-1 hover:bg-stone-800 rounded text-stone-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-stone-600">
                Select an entity to evaluate side-by-side against <strong>{slot1Shipper?.company_name} ({slot1Shipper?.id})</strong>.
              </p>

              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {shippers.map((s, idx) => {
                  const isCurrentSlot1 = idx === slot1Index;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={isCurrentSlot1}
                      onClick={() => handleSelectSlot2(idx)}
                      className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition ${
                        isCurrentSlot1
                          ? 'opacity-40 bg-stone-100 border-stone-200 cursor-not-allowed'
                          : 'bg-stone-50 hover:bg-sky-50 border-stone-200 hover:border-sky-400 cursor-pointer'
                      }`}
                    >
                      <div className="space-y-0.5 truncate pr-2">
                        <div className="font-bold text-stone-900 flex items-center space-x-1.5 truncate">
                          <span>{s.company_name}</span>
                          {isCurrentSlot1 && (
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-stone-300 text-stone-700">
                              (Current Slot 1)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-stone-500">
                          {s.id} &bull; {s.country} &bull; Max {s.max_weight_kg}kg
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          s.trust_score >= 70 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {s.trust_score} Trust
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-3 bg-stone-100 border-t border-stone-200 flex justify-between items-center">
              {slot2Index !== null ? (
                <button
                  type="button"
                  onClick={() => handleSelectSlot2(null)}
                  className="text-xs text-rose-700 hover:text-rose-800 font-semibold cursor-pointer"
                >
                  Clear 2nd Slot Selection
                </button>
              ) : (
                <span className="text-[11px] text-stone-500">Choose any entity above</span>
              )}

              <button
                type="button"
                onClick={() => setSlot2SelectorOpen(false)}
                className="px-4 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Full Profile & History Dossier Modal */}
      {modalOpen && slot1Detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-300 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-xs">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                  OFFICIAL SHIPPER DOSSIER & HISTORICAL ARCHIVE
                </span>
                <h3 className="font-bold text-base mt-0.5">
                  {slot1Detail.shipper.company_name} ({slot1Detail.shipper.id})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 hover:bg-stone-800 rounded text-stone-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="px-6 pt-3 border-b border-stone-200 bg-stone-50 flex space-x-4">
              <button
                type="button"
                onClick={() => setModalTab('DETAILS')}
                className={`pb-2 text-xs font-bold border-b-2 cursor-pointer transition ${
                  modalTab === 'DETAILS'
                    ? 'border-amber-600 text-amber-900'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                Profile & Baseline Metrics
              </button>
              <button
                type="button"
                onClick={() => setModalTab('HISTORY')}
                className={`pb-2 text-xs font-bold border-b-2 cursor-pointer transition flex items-center space-x-1.5 ${
                  modalTab === 'HISTORY'
                    ? 'border-amber-600 text-amber-900'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Historical Events ({slot1Detail.history?.length || 0})</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {modalTab === 'DETAILS' ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-0.5">
                      <span className="text-[10px] text-stone-400 font-bold uppercase">Operating Status</span>
                      <div className="font-bold text-sm text-stone-900">{slot1Detail.shipper.status}</div>
                    </div>
                    <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-0.5">
                      <span className="text-[10px] text-stone-400 font-bold uppercase">Digital Trust Index</span>
                      <div className="font-mono font-bold text-sm text-stone-900">
                        {slot1Detail.shipper.trust_score} / 100
                      </div>
                    </div>
                    <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-0.5">
                      <span className="text-[10px] text-stone-400 font-bold uppercase">Total Bookings Screened</span>
                      <div className="font-mono font-bold text-sm text-stone-900">
                        {slot1Detail.shipper.total_bookings}
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1.5">
                      Complete Structured Record
                    </span>
                    <pre className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl font-mono text-[10px] text-stone-800 overflow-x-auto">
                      {JSON.stringify(slot1Detail, null, 2)}
                    </pre>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="text-xs text-stone-600">
                    Comprehensive chronological operational, audit, and compliance records on file for {slot1Detail.shipper.company_name}.
                  </div>
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
                    {(slot1Detail.history || []).map((evt: ShipperHistoryEvent) => {
                      const badge = getCategoryBadge(evt.category);
                      const IconComponent = badge.icon;
                      return (
                        <div key={evt.id} className="relative">
                          <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-amber-600 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-amber-600" />
                          </div>
                          <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center space-x-1 ${badge.bg}`}>
                                <IconComponent className="w-3 h-3" />
                                <span>{evt.category}</span>
                              </span>
                              <span className="font-mono text-[10px] text-stone-500">
                                {new Date(evt.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <h5 className="font-bold text-xs text-stone-900">{evt.title}</h5>
                            <p className="text-xs text-stone-700">{evt.description}</p>
                            <div className="text-[10px] text-stone-500 font-mono pt-1 border-t border-stone-200 flex justify-between">
                              <span>Actor: {evt.actor}</span>
                              {evt.port && <span>Port: {evt.port}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-stone-100 border-t border-stone-200 flex justify-between items-center">
              <span className="text-[11px] text-stone-500 font-mono">
                Verified against Customs Act 1962 & Courier Regs 1998
              </span>
              <div className="flex items-center space-x-2">
                {(slot1Detail.shipper.status === 'ACTIVE' || slot1Detail.shipper.kyc_status === 'VERIFIED') && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const rep = await api.generateShipperApprovalReport(slot1Detail.shipper.id);
                        triggerDownload(rep.download_url, rep.filename);
                      } catch (err: any) {
                        alert(`Approval report download failed: ${err.message}`);
                      }
                    }}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center space-x-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Approval Report</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Close Dossier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
