import React, { useEffect, useRef, useState } from 'react';
import cytoscape, { Core, EventObject } from 'cytoscape';
import {
  ZoomIn, ZoomOut, Maximize2, RotateCcw, Filter,
  Layers, ShieldAlert, X, Info, GitCompare, ArrowRight,
  Search, ShieldCheck, AlertTriangle, Cpu, Terminal, CheckCircle2,
  ExternalLink, Building2, Smartphone, CreditCard, Box, Scale, Lock
} from 'lucide-react';
import { api } from '../services/api';
import { TopologyEdge, TopologyNode } from '../types';

export const TopologyPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const [nodes, setNodes] = useState<TopologyNode[]>([]);
  const [edges, setEdges] = useState<TopologyEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<TopologyEdge | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [layoutMode, setLayoutMode] = useState<'breadthfirst' | 'cose' | 'concentric'>('breadthfirst');
  const [attackPathActive, setAttackPathActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Entity Comparison Mode
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareNodeA, setCompareNodeA] = useState<TopologyNode | null>(null);
  const [compareNodeB, setCompareNodeB] = useState<TopologyNode | null>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Complete Profile Popup for clicked entity
  const [profileModalNode, setProfileModalNode] = useState<TopologyNode | null>(null);

  const fetchTopology = async (isInitial = false) => {
    try {
      if (isInitial && nodes.length === 0) setLoading(true);
      const data = await api.getGlobalTopology();
      setNodes(data.nodes);
      setEdges(data.edges);
    } catch (err) {
      console.error('Failed to load topology:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopology(true);
    const unsub = api.subscribeToWs((evt) => {
      if (evt.type === 'BOOKING_SCREENED' || evt.type === 'INCIDENT_CREATED' || evt.type === 'DEMO_RESET') {
        fetchTopology(false);
      }
    });
    return unsub;
  }, []);

  // Initialize or update Cytoscape canvas
  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return;

    // Filter nodes if category is selected
    const filteredNodes = selectedCategory === 'ALL'
      ? nodes
      : nodes.filter(n => n.type === selectedCategory);

    const validNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = edges.filter(e => validNodeIds.has(e.source) && validNodeIds.has(e.target));

    const cyElements = [
      ...filteredNodes.map(n => ({
        data: {
          id: n.id,
          label: n.label,
          type: n.type,
          status: n.status || 'NORMAL',
          risk: n.risk_contribution || 0,
          raw: n,
        }
      })),
      ...filteredEdges.map(e => ({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.relationship,
          is_suspicious: e.is_suspicious,
          raw: e,
        }
      }))
    ];

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: cyElements,
      boxSelectionEnabled: false,
      autounselectify: false,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'font-size': '11px',
            'font-family': 'Plus Jakarta Sans, sans-serif',
            'font-weight': 600,
            'text-valign': 'bottom',
            'text-margin-y': 7,
            'color': '#f8fafc',
            'text-outline-color': '#020617',
            'text-outline-width': 2,
            'text-background-color': '#0f172a',
            'text-background-opacity': 0.85,
            'text-background-padding': '3px',
            'text-background-shape': 'roundrectangle',
            'text-wrap': 'wrap',
            'text-max-width': '110px',
            'background-color': '#78716c',
            'width': 36,
            'height': 36,
            'border-width': 2.5,
            'border-color': '#ffffff',
            'overlay-opacity': 0,
          }
        },
        {
          selector: 'node[type = "SHIPPER"]',
          style: { 
            'background-color': '#0284c7', 
            'shape': 'round-rectangle', 
            'width': 42, 
            'height': 42,
            'border-color': '#e0f2fe',
            'border-width': 3
          }
        },
        {
          selector: 'node[type = "ACCOUNT"]',
          style: { 
            'background-color': '#0369a1', 
            'shape': 'rectangle',
            'width': 36,
            'height': 36
          }
        },
        {
          selector: 'node[type = "DEVICE"]',
          style: { 
            'background-color': '#d97706', 
            'shape': 'diamond', 
            'width': 38, 
            'height': 38 
          }
        },
        {
          selector: 'node[type = "PAYMENT"]',
          style: { 
            'background-color': '#7c3aed', 
            'shape': 'hexagon', 
            'width': 36, 
            'height': 36 
          }
        },
        {
          selector: 'node[type = "BOOKING"]',
          style: { 
            'background-color': '#ea580c', 
            'shape': 'ellipse', 
            'width': 42, 
            'height': 42 
          }
        },
        {
          selector: 'node[type = "FRAUD_ENGINE"]',
          style: { 
            'background-color': '#b45309', 
            'shape': 'octagon', 
            'width': 44, 
            'height': 44 
          }
        },
        {
          selector: 'node[type = "DECISION"]',
          style: { 
            'background-color': '#dc2626', 
            'shape': 'star', 
            'width': 46, 
            'height': 46 
          }
        },
        {
          selector: 'node[type = "INCIDENT"]',
          style: { 
            'background-color': '#991b1b', 
            'shape': 'triangle', 
            'width': 44, 
            'height': 44 
          }
        },
        {
          selector: 'node[type = "EVIDENCE"]',
          style: { 
            'background-color': '#059669', 
            'shape': 'ellipse', 
            'width': 28, 
            'height': 28 
          }
        },
        {
          selector: 'node[type = "BLOCKCHAIN"]',
          style: { 
            'background-color': '#0891b2', 
            'shape': 'pentagon', 
            'width': 36, 
            'height': 36 
          }
        },
        {
          selector: 'node[status = "SUSPICIOUS"], node[status = "BLOCKED"]',
          style: {
            'border-color': '#dc2626',
            'border-width': 3.5,
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#f59e0b',
            'border-width': 4,
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#475569',
            'target-arrow-color': '#64748b',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '9px',
            'font-family': 'JetBrains Mono, monospace',
            'font-weight': 600,
            'color': '#cbd5e1',
            'text-outline-color': '#020617',
            'text-outline-width': 1.5,
            'text-background-color': '#0f172a',
            'text-background-opacity': 0.85,
            'text-background-padding': '2px',
            'text-background-shape': 'roundrectangle',
            'text-rotation': 'autorotate',
            'text-margin-y': -8,
          }
        },
        {
          selector: 'edge[is_suspicious]',
          style: {
            'line-color': '#f43f5e',
            'target-arrow-color': '#f43f5e',
            'width': 3,
            'line-style': 'dashed',
            'color': '#fecdd3',
            'text-background-color': '#881337',
            'text-background-opacity': 0.9,
            'text-background-padding': '2px',
            'text-background-shape': 'roundrectangle',
          }
        },
        {
          selector: '.attack-path-node',
          style: {
            'border-color': '#f97316',
            'border-width': 4,
            'background-color': '#c2410c',
          }
        },
        {
          selector: '.attack-path-edge',
          style: {
            'line-color': '#ea580c',
            'target-arrow-color': '#ea580c',
            'width': 4,
            'line-style': 'solid',
          }
        },
        {
          selector: '.dimmed',
          style: {
            'opacity': 0.15,
          }
        },
        {
          selector: '.compare-selected-a',
          style: {
            'border-color': '#3b82f6',
            'border-width': 5,
          }
        },
        {
          selector: '.compare-selected-b',
          style: {
            'border-color': '#a855f7',
            'border-width': 5,
          }
        }
      ],
      layout: {
        name: layoutMode,
        directed: true,
        padding: 60,
        spacingFactor: 2.2,
        animate: true,
        animationDuration: 400,
      } as any,
    });

    // Node click handlers
    cy.on('tap', 'node', (evt: EventObject) => {
      const node = evt.target;
      const rawData = node.data('raw');
      setSelectedNode(rawData);
      setSelectedEdge(null);

      if (isCompareMode) {
        if (!compareNodeA) {
          setCompareNodeA(rawData);
          node.addClass('compare-selected-a');
        } else if (!compareNodeB && compareNodeA.id !== rawData.id) {
          setCompareNodeB(rawData);
          node.addClass('compare-selected-b');
          setShowCompareModal(true);
        } else {
          // Reset and set as A
          cy.nodes().removeClass('compare-selected-a compare-selected-b');
          setCompareNodeA(rawData);
          setCompareNodeB(null);
          node.addClass('compare-selected-a');
        }
      } else {
        // Pop-up complete profile for touched entity
        setProfileModalNode(rawData);
      }
    });

    // Edge click handlers
    cy.on('tap', 'edge', (evt: EventObject) => {
      const edge = evt.target;
      setSelectedEdge(edge.data('raw'));
      setSelectedNode(null);
    });

    // Background click
    cy.on('tap', (evt: EventObject) => {
      if (evt.target === cy) {
        setSelectedNode(null);
        setSelectedEdge(null);
        cy.elements().removeClass('dimmed');
      }
    });

    cyRef.current = cy;

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, [nodes, edges, selectedCategory, layoutMode, isCompareMode]);

  // Trace Attack Path handler
  const handleTraceAttackPath = () => {
    if (!cyRef.current) return;
    const cy = cyRef.current;

    if (attackPathActive) {
      // Deactivate
      cy.elements().removeClass('attack-path-node attack-path-edge dimmed');
      setAttackPathActive(false);
      return;
    }

    // Identify attack path nodes (compromised entities)
    const attackNodeIds = new Set(['SHP-202', 'ACC-202', 'DEV-999', 'PM-888', 'BKG-2026-9042', 'INC-2026-0042', 'DEC-BLOCK']);
    cy.elements().addClass('dimmed');

    cy.nodes().forEach(node => {
      if (attackNodeIds.has(node.id()) || node.data('status') === 'BLOCKED' || node.data('status') === 'SUSPICIOUS') {
        node.removeClass('dimmed');
        node.addClass('attack-path-node');
      }
    });

    cy.edges().forEach(edge => {
      if (edge.data('is_suspicious') || (attackNodeIds.has(edge.source().id()) && attackNodeIds.has(edge.target().id()))) {
        edge.removeClass('dimmed');
        edge.addClass('attack-path-edge');
      }
    });

    setAttackPathActive(true);
  };

  // Search handler to highlight and zoom
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cyRef.current || !searchQuery.trim()) return;
    const cy = cyRef.current;
    const query = searchQuery.trim().toLowerCase();

    const match = cy.nodes().filter(n => 
      n.id().toLowerCase().includes(query) || 
      n.data('label').toLowerCase().includes(query)
    );

    if (match.length > 0) {
      cy.elements().removeClass('dimmed');
      cy.nodes().not(match).addClass('dimmed');
      cy.animate({
        center: { eles: match },
        zoom: 1.5,
        duration: 500,
      });
      setSelectedNode(match.first().data('raw'));
    }
  };

  const handleResetSearch = () => {
    setSearchQuery('');
    if (cyRef.current) {
      cyRef.current.elements().removeClass('dimmed');
      cyRef.current.fit(undefined, 50);
    }
  };

  // Category counts
  const categoryCounts = nodes.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header & Overview */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 flex items-center space-x-2">
            <span>Relationship Topology & Threat Correlation</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 font-mono font-medium">
              {nodes.length} Nodes &bull; {edges.length} Edges
            </span>
          </h1>
          <p className="text-sm text-stone-600 mt-0.5">
            Interactive multi-tier graph connecting Shippers, Terminals, Payment Gateways, Consignments, and Cryptographic Evidence.
          </p>
        </div>

        {/* Global Action Strip */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Compare Entities Button */}
          <button
            type="button"
            onClick={() => {
              setIsCompareMode(!isCompareMode);
              if (isCompareMode) {
                setCompareNodeA(null);
                setCompareNodeB(null);
                if (cyRef.current) cyRef.current.nodes().removeClass('compare-selected-a compare-selected-b');
              }
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition shadow-xs cursor-pointer ${
              isCompareMode
                ? 'bg-blue-600 text-white border-blue-700'
                : 'bg-white hover:bg-stone-50 text-stone-800 border-stone-300'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>{isCompareMode ? 'Comparing Mode (Active)' : 'Compare Entities'}</span>
          </button>

          {/* Trace Attack Path Button */}
          <button
            type="button"
            onClick={handleTraceAttackPath}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer border ${
              attackPathActive
                ? 'bg-rose-700 text-white border-rose-800'
                : 'bg-stone-900 hover:bg-stone-800 text-white border-stone-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>{attackPathActive ? 'Clear Threat Overlay' : 'Trace Attack Path'}</span>
          </button>
        </div>
      </div>

      {/* Comparison Instruction Banner if active */}
      {isCompareMode && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs flex flex-wrap items-center justify-between gap-3 text-blue-900">
          <div className="flex items-center space-x-2">
            <GitCompare className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Entity Comparison Mode:</strong> Touch any two nodes on the canvas to compare baseline vs observed telemetry side-by-side.
            </span>
          </div>
          <div className="flex items-center space-x-2 font-mono text-[11px]">
            <span className={`px-2 py-0.5 rounded ${compareNodeA ? 'bg-blue-200 text-blue-900 font-bold' : 'bg-white/80 text-blue-600'}`}>
              Slot 1: {compareNodeA ? compareNodeA.label : 'Select Node 1'}
            </span>
            <span className={`px-2 py-0.5 rounded ${compareNodeB ? 'bg-purple-200 text-purple-900 font-bold' : 'bg-white/80 text-blue-600'}`}>
              Slot 2: {compareNodeB ? compareNodeB.label : 'Select Node 2'}
            </span>
            {compareNodeA && compareNodeB && (
              <button
                type="button"
                onClick={() => setShowCompareModal(true)}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition text-xs shadow-xs"
              >
                View Side-by-Side Matrix
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filter and Control Bar */}
      <div className="bg-white border border-stone-200 rounded-xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-stone-500 font-semibold mr-1 flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </span>
          {['ALL', 'SHIPPER', 'ACCOUNT', 'DEVICE', 'PAYMENT', 'BOOKING', 'DECISION', 'INCIDENT'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              {cat === 'ALL' ? 'All Entities' : cat}
              {cat !== 'ALL' && categoryCounts[cat] !== undefined && (
                <span className="ml-1 opacity-70">({categoryCounts[cat]})</span>
              )}
            </button>
          ))}
        </div>

        {/* Layout Mode Selector & Search */}
        <div className="flex items-center space-x-2">
          {/* Quick Search */}
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="Find entity by ID or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-7 py-1 bg-stone-50 border border-stone-300 rounded-lg text-xs w-48 sm:w-56 focus:w-64 transition-all focus:bg-white focus:ring-1 focus:ring-amber-500"
            />
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2 top-2" />
            {searchQuery && (
              <button
                type="button"
                onClick={handleResetSearch}
                className="absolute right-2 top-1.5 text-stone-400 hover:text-stone-700"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </form>

          {/* Layout buttons */}
          <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200">
            <button
              type="button"
              onClick={() => setLayoutMode('breadthfirst')}
              className={`px-2 py-1 rounded text-xs font-medium cursor-pointer transition ${layoutMode === 'breadthfirst' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'}`}
              title="Hierarchical Pipeline Flow"
            >
              Pipeline
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('cose')}
              className={`px-2 py-1 rounded text-xs font-medium cursor-pointer transition ${layoutMode === 'cose' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'}`}
              title="Force-Directed Cluster"
            >
              Cluster
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('concentric')}
              className={`px-2 py-1 rounded text-xs font-medium cursor-pointer transition ${layoutMode === 'concentric' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'}`}
              title="Radial Concentric Threat Ring"
            >
              Radial
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas + Inspector Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Cytoscape Graph Container */}
        <div className="lg:col-span-3 bg-stone-900 rounded-2xl overflow-hidden border border-stone-800 shadow-lg relative h-[620px] flex flex-col">
          {/* Top Canvas Bar */}
          <div className="absolute top-3 left-3 z-10 flex items-center space-x-2 bg-stone-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-stone-700/80 text-[11px] text-stone-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Live Security Fabric</span>
            <span className="text-stone-600">|</span>
            <span className="font-mono text-stone-400">TOUCH NODE FOR FULL PROFILE</span>
          </div>

          {/* Canvas Viewport Controls */}
          <div className="absolute top-3 right-3 z-10 flex flex-col space-y-1.5 bg-stone-900/90 backdrop-blur-md p-1.5 rounded-xl border border-stone-700/80 shadow-md">
            <button
              type="button"
              onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.25)}
              className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-300 hover:text-white transition"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)}
              className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-300 hover:text-white transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => cyRef.current?.fit(undefined, 50)}
              className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-300 hover:text-white transition"
              title="Fit to Screen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (cyRef.current) {
                  cyRef.current.layout({ name: layoutMode, padding: 50, animate: true }).run();
                }
              }}
              className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-300 hover:text-white transition"
              title="Re-layout Canvas"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Cytoscape Canvas */}
          <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing bg-stone-950/60" />

          {/* Canvas Legend Strip */}
          <div className="bg-stone-900/95 border-t border-stone-800 px-4 py-2 text-[11px] flex flex-wrap items-center justify-between gap-3 text-stone-400">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-500"></span>
                <span>Shipper</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 rotate-45"></span>
                <span>Device/Terminal</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-purple-500"></span>
                <span>Payment</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                <span>Consignment</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-600"></span>
                <span>Block/Incident</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Evidence Ledger</span>
              </span>
            </div>
            <div className="text-stone-500">
              Double-click node to inspect &bull; Drag to rearrange
            </div>
          </div>
        </div>

        {/* Selected Entity Inspector Panel (Right Column) */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h2 className="text-sm font-bold text-stone-900 flex items-center space-x-1.5">
                <Info className="w-4 h-4 text-stone-500" />
                <span>Entity Telemetry</span>
              </h2>
              {selectedNode && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-bold">
                  {selectedNode.type}
                </span>
              )}
            </div>

            {selectedNode ? (
              <div className="space-y-4 pt-3 text-xs">
                <div>
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Entity Label</div>
                  <div className="font-bold text-stone-900 text-sm mt-0.5">{selectedNode.label}</div>
                  <div className="font-mono text-stone-500 text-[11px] mt-0.5">{selectedNode.id}</div>
                </div>

                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-stone-600 font-medium">Risk Contribution:</span>
                    <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                      (selectedNode.risk_contribution || 0) > 40
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {selectedNode.risk_contribution || 0} / 100
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-600 font-medium">Operating State:</span>
                    <span className={`font-semibold ${
                      selectedNode.status === 'BLOCKED' || selectedNode.status === 'SUSPICIOUS'
                        ? 'text-rose-700 font-bold'
                        : 'text-emerald-700'
                    }`}>
                      {selectedNode.status || 'NORMAL'}
                    </span>
                  </div>
                </div>

                {/* Attributes breakdown */}
                {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1.5">
                      Observed Attributes
                    </div>
                    <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200 space-y-1 font-mono text-[11px] text-stone-700 max-h-48 overflow-y-auto">
                      {Object.entries(selectedNode.metadata).map(([k, v]) => (
                        <div key={k} className="flex justify-between border-b border-stone-200/50 pb-1 last:border-0">
                          <span className="text-stone-500">{k}:</span>
                          <span className="font-bold text-stone-900 truncate max-w-[150px]">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick actions for selected node */}
                <div className="space-y-1.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setProfileModalNode(selectedNode)}
                    className="w-full py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View Complete Profile Dossier</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!compareNodeA) {
                        setCompareNodeA(selectedNode);
                        setIsCompareMode(true);
                      } else {
                        setCompareNodeB(selectedNode);
                        setShowCompareModal(true);
                      }
                    }}
                    className="w-full py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold transition border border-stone-300 flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <GitCompare className="w-3.5 h-3.5 text-blue-600" />
                    <span>Add to Entity Comparison</span>
                  </button>
                </div>
              </div>
            ) : selectedEdge ? (
              <div className="space-y-3 pt-3 text-xs">
                <div>
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Relationship Link</div>
                  <div className="font-bold text-stone-900 text-sm mt-0.5">{selectedEdge.relationship}</div>
                  <div className="font-mono text-stone-500 text-[11px]">{selectedEdge.id}</div>
                </div>

                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Source Entity:</span>
                    <span className="font-mono font-bold text-stone-900">{selectedEdge.source}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Target Entity:</span>
                    <span className="font-mono font-bold text-stone-900">{selectedEdge.target}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Security Assessment:</span>
                    <span className={`font-bold ${selectedEdge.is_suspicious ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {selectedEdge.is_suspicious ? 'SUSPICIOUS LINK' : 'CLEAN TRAFFIC'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-stone-400 space-y-2">
                <Layers className="w-8 h-8 mx-auto text-stone-300" />
                <p className="text-xs">Click any node or relationship edge on the canvas to inspect forensic properties.</p>
              </div>
            )}
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-snug">
            <strong>Threat Intelligence Note:</strong> Nodes flagged with red borders indicate privileged boundary violations or known links to prior intercepted cargo incidents.
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SIDE-BY-SIDE ENTITY COMPARISON MODAL                      */}
      {/* ========================================================= */}
      {showCompareModal && compareNodeA && compareNodeB && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-300 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-xs">
            {/* Header */}
            <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <GitCompare className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-base">Forensic Entity Comparison Matrix</h3>
                  <p className="text-[11px] text-stone-400">
                    Side-by-side behavioral, network, and privilege boundary differential analysis.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCompareModal(false)}
                className="p-1 hover:bg-stone-800 rounded text-stone-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Side-by-Side Comparison Grid */}
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Column A */}
                <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-blue-200 text-blue-900 font-bold text-[10px] uppercase font-mono">
                      Entity A &bull; {compareNodeA.type}
                    </span>
                    <span className="font-mono text-stone-500">{compareNodeA.id}</span>
                  </div>
                  <h4 className="text-base font-bold text-stone-900">{compareNodeA.label}</h4>

                  <div className="space-y-1.5 border-t border-blue-200/60 pt-2">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Risk Contribution:</span>
                      <span className={`font-mono font-bold ${
                        (compareNodeA.risk_contribution || 0) > 40 ? 'text-rose-700' : 'text-emerald-700'
                      }`}>
                        {compareNodeA.risk_contribution || 0} / 100
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Security Status:</span>
                      <span className="font-bold">{compareNodeA.status || 'NORMAL'}</span>
                    </div>
                  </div>

                  {/* Attributes */}
                  <div className="space-y-1 pt-2">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Attributes</span>
                    <pre className="p-2.5 bg-white rounded border border-blue-200 font-mono text-[10px] overflow-x-auto text-stone-800">
                      {JSON.stringify(compareNodeA.metadata || {}, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Column B */}
                <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-purple-200 text-purple-900 font-bold text-[10px] uppercase font-mono">
                      Entity B &bull; {compareNodeB.type}
                    </span>
                    <span className="font-mono text-stone-500">{compareNodeB.id}</span>
                  </div>
                  <h4 className="text-base font-bold text-stone-900">{compareNodeB.label}</h4>

                  <div className="space-y-1.5 border-t border-purple-200/60 pt-2">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Risk Contribution:</span>
                      <span className={`font-mono font-bold ${
                        (compareNodeB.risk_contribution || 0) > 40 ? 'text-rose-700' : 'text-emerald-700'
                      }`}>
                        {compareNodeB.risk_contribution || 0} / 100
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Security Status:</span>
                      <span className="font-bold">{compareNodeB.status || 'NORMAL'}</span>
                    </div>
                  </div>

                  {/* Attributes */}
                  <div className="space-y-1 pt-2">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Attributes</span>
                    <pre className="p-2.5 bg-white rounded border border-purple-200 font-mono text-[10px] overflow-x-auto text-stone-800">
                      {JSON.stringify(compareNodeB.metadata || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Threat Differential Analysis */}
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                <h5 className="font-bold text-stone-900 text-xs flex items-center space-x-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Divergence & Risk Delta Summary</span>
                </h5>
                <p className="text-stone-700 text-xs leading-relaxed">
                  Risk score differential between entities is{' '}
                  <strong className="font-mono font-bold">
                    {Math.abs((compareNodeA.risk_contribution || 0) - (compareNodeB.risk_contribution || 0))} points
                  </strong>.
                  {((compareNodeA.risk_contribution || 0) > 50 || (compareNodeB.risk_contribution || 0) > 50) ? (
                    ' Significant anomaly detected: One of the compared entities breaches standard authorization thresholds and operates through untrusted infrastructure or unverified credentials.'
                  ) : (
                    ' Both entities conform to nominal behavioral and KYC validation standards.'
                  )}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-stone-100 border-t border-stone-200 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  setCompareNodeA(null);
                  setCompareNodeB(null);
                  setShowCompareModal(false);
                  if (cyRef.current) cyRef.current.nodes().removeClass('compare-selected-a compare-selected-b');
                }}
                className="px-3 py-1.5 bg-white hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold border border-stone-300 transition"
              >
                Clear Selection
              </button>
              <button
                type="button"
                onClick={() => setShowCompareModal(false)}
                className="px-4 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* COMPLETE PROFILE POP-UP MODAL (ON TOUCH / CLICK)          */}
      {/* ========================================================= */}
      {profileModalNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-300 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden text-xs">
            <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                  {profileModalNode.type} PROFILE DOSSIER
                </div>
                <h3 className="font-bold text-base mt-0.5">{profileModalNode.label}</h3>
                <div className="text-[11px] text-stone-400 font-mono">ID: {profileModalNode.id}</div>
              </div>
              <button
                type="button"
                onClick={() => setProfileModalNode(null)}
                className="p-1 hover:bg-stone-800 rounded text-stone-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {/* Status Header */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-stone-400 uppercase">Operating Security State</span>
                  <div className={`font-bold text-sm ${
                    profileModalNode.status === 'BLOCKED' || profileModalNode.status === 'SUSPICIOUS'
                      ? 'text-rose-700'
                      : 'text-emerald-700'
                  }`}>
                    {profileModalNode.status || 'NORMAL'}
                  </div>
                </div>
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-stone-400 uppercase">Risk Contribution</span>
                  <div className="font-mono font-bold text-sm text-stone-900">
                    {profileModalNode.risk_contribution || 0} / 100
                  </div>
                </div>
              </div>

              {/* Complete Metadata Record */}
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1.5">
                  Complete Forensic Metadata & Recorded Telemetry
                </span>
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2 font-mono text-xs">
                  {profileModalNode.metadata && Object.keys(profileModalNode.metadata).length > 0 ? (
                    Object.entries(profileModalNode.metadata).map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-stone-200/60 pb-1.5 last:border-0 last:pb-0">
                        <span className="text-stone-500 font-medium">{k}:</span>
                        <span className="font-bold text-stone-900">{String(v)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-stone-400 italic">No additional metadata parameters recorded.</div>
                  )}
                </div>
              </div>

              {/* Related Connected Edges in Graph */}
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1.5">
                  Direct Graph Connections
                </span>
                <div className="space-y-1">
                  {edges
                    .filter(e => e.source === profileModalNode.id || e.target === profileModalNode.id)
                    .map(e => (
                      <div
                        key={e.id}
                        className={`p-2 rounded-lg border text-xs flex justify-between items-center ${
                          e.is_suspicious
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : 'bg-stone-50 border-stone-200 text-stone-800'
                        }`}
                      >
                        <span className="font-mono text-[11px] font-bold">{e.relationship}</span>
                        <span className="font-mono text-[10px] text-stone-500">
                          {e.source === profileModalNode.id ? `To: ${e.target}` : `From: ${e.source}`}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-stone-100 border-t border-stone-200 text-right">
              <button
                type="button"
                onClick={() => setProfileModalNode(null)}
                className="px-4 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
