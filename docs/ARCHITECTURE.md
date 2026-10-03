# F-Shield Architecture

## 1. System High-Level Topology

```
[ Carrier API / Booking Client ]
             │
             ▼
[ F-Shield Ingestion API (Express / Node.js) ]
             │
 ┌───────────┼────────────────────────────────────────┐
 │           ▼                                        │
 │   Identity & Permission Engine                     │
 │   (Authorized vs Observed Privilege Matrix)       │
 │           ▼                                        │
 │   Behavioral Baseline Engine                       │
 │   (Weight deviation multiple, route history)       │
 │           ▼                                        │
 │   Device & Network Graph Engine                    │
 │   (Hardware fingerprints, Tor/Proxy, Sybil links)  │
 │           ▼                                        │
 │   Payment Risk Engine                              │
 │   (Cardholder verification, decline patterns)     │
 │           ▼                                        │
 │   Statutory Compliance Engine                      │
 │   (CBIC Customs, Courier Regs, Merchant Shipping)  │
 │           ▼                                        │
 │   ML Anomaly Engine                                │
 │   (Isolation Forest multivariate feature vector)   │
 └───────────┬────────────────────────────────────────┘
             ▼
[ Normalized Risk Engine (0-100) & Fallback Controller ]
             │
             ├── Level 1: Full AI/ML
             ├── Level 2: Deterministic Rules & Heuristics
             └── Level 3: Mandatory Human Review
             │
             ▼
[ Pre-Shipment Decision Engine: ALLOW / HOLD / BLOCK ]
             │
             ├────────► GenAI Explanation Engine (@google/genai)
             │          (Deterministic Rule Synthesis Fallback)
             │
             ├────────► Forensic Incident & Timeline Generator
             │
             ├────────► Tamper-Evident SHA-256 Evidence Chain
             │
             ├────────► Blockchain Anchor Adapter (Simulated / Real)
             │
             └────────► Real-time WebSocket Broadcast (ws://localhost:3000/ws/live)
```

## 2. Interactive Cytoscape.js Graph Model

The relationship topology organizes forensic entities into a structured, hierarchical dag:
- **Layer 1: Shipping Entities** (Shipper & Account nodes)
- **Layer 2: Access & Instruments** (Hardware Device & Payment Method nodes)
- **Layer 3: Transaction Consignments** (Booking & Destination nodes)
- **Layer 4: Analytical Core** (Fraud Engine Risk node)
- **Layer 5: Decision Disposition** (ALLOW / HOLD / BLOCK nodes)
- **Layer 6: Forensic Records** (Incident & Sealed Evidence nodes)
- **Layer 7: Cryptographic Integrity** (Blockchain Anchor node)

Dynamic attack paths are computed using graph traversal across entities with elevated risk contribution or suspicious link flags.
