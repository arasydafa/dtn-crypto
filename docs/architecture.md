# Architecture

## System Overview

The DTN Crypto Simulator is organized into four main layers:

```
+-----------------------------------------------------------+
|                     Web Browser (React)                    |
|  Network Graph (D3.js)  |  Inspector  |  Metrics (Charts) |
+-----------------------------------------------------------+
          ↕ WebSocket / REST API
+-----------------------------------------------------------+
|                   FastAPI Backend (api/)                   |
|  POST /simulate  |  GET /scenarios  |  WebSocket /ws/live |
+-----------------------------------------------------------+
          ↕
+-----------------------------------------------------------+
|                Simulation Engine (simulator/)              |
|  Discrete-Event Loop  |  Event Queue  |  Metrics          |
+-----------------------------------------------------------+
          ↕
+-----------------------------------------------------------+
|                    Crypto Layer (dtn_crypto/)              |
|  Hybrid RSA-AES  |  CP-ABE  |  SHA-256 Integrity         |
+-----------------------------------------------------------+
```

## Module Structure

### `dtn_crypto/` — Cryptography Library

The core encryption library providing:

- **`rsa_aes.py`** — Hybrid RSA-OAEP + AES-256-GCM encryption
- **`cpabe.py`** — Ciphertext-Policy Attribute-Based Encryption with policy parsing
- **`bundle.py`** — Secure bundle format with dual-layer encryption and SHA-256 integrity
- **`utils.py`** — Key generation, PEM serialization, base64 encoding

### `simulator/` — Network Simulator

Discrete-event simulation engine:

- **`engine.py`** — Main event loop using heapq priority queue
- **`models.py`** — Data models (Node, SimBundle, ContactEvent, SimEvent)
- **`routers/`** — Routing algorithm implementations
  - `epidemic.py` — Flood-based replication
  - `prophet.py` — Probabilistic routing with predictability aging
  - `spray.py` — Binary spray-and-wait with token splitting
- **`scenarios.py`** — Preset scenario definitions (deep space, disaster, military)
- **`metrics.py`** — Metrics collection and CSV/JSON export
- **`crypto_layer.py`** — Crypto integration wrapper
- **`pcap_logger.py`** — BPv7 PCAP writer for Wireshark

### `api/` — FastAPI Backend

Web server and API:

- **`app.py`** — FastAPI application with CORS and static file serving
- **`router.py`** — REST and WebSocket route definitions
- **`simulator.py`** — Async simulation wrapper for WebSocket streaming
- **`schemas.py`** — Pydantic request/response models

### `frontend/` — React SPA

TypeScript + Vite web dashboard:

- **`hooks/useSimulation.ts`** — Central state manager (WebSocket, REST, event processing)
- **`components/NetworkGraph.tsx`** — D3.js force-directed graph
- **`components/NodeInspectorModal.tsx`** — 4-tab node inspector modal
- **`components/BundleInspector.tsx`** — Bundle path, timing, content stages
- **`components/charts/`** — Chart.js visualizations (delivery, latency, crypto, status)

## Data Flow

### Simulation Lifecycle

1. **Configuration** — User sets router, nodes, duration, scenario in sidebar
2. **Connection** — Frontend opens WebSocket to `/ws/live` (falls back to REST)
3. **Streaming** — Engine emits events: CONTACT_START, BUNDLE_TRANSFER, BUNDLE_DELIVER, NODE_UPDATE
4. **Visualization** — NetworkGraph processes events in real-time, animating transfers
5. **Completion** — Engine sends FINAL_RESULT with aggregated metrics and bundle/node details
6. **Inspection** — User clicks nodes/bundles to view details in inspector panels

### Bundle Lifecycle

1. **Creation** — Source node encrypts payload (CP-ABE + RSA-AES) with SHA-256 hash
2. **Forwarding** — Relay nodes buffer and forward when contacts are available
3. **Routing** — Algorithm determines which contacts to use (flood, probabilistic, or token-limited)
4. **Delivery** — Destination decrypts both layers and verifies integrity
5. **Metrics** — Latency, hop count, and timing recorded for analysis

## Design Decisions

| Decision | Rationale |
|---|---|
| Google-style docstrings | Consistent with existing codebase, supported by mkdocstrings |
| D3.js for network graph | Full control over force simulation, animations, and custom rendering |
| WebSocket with REST fallback | Real-time streaming when available, reliable fallback for all environments |
| Event batching (50ms) | Prevents 500+ React re-renders per second during high-throughput simulations |
| Refs for D3 state | Avoids React re-renders for high-frequency D3 mutations (positions, colors) |
| Priority-based buffer replacement | Higher-priority bundles evict lower-priority when buffer is full |
