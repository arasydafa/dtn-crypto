# DTN Crypto Simulator Wiki

Comprehensive technical documentation for the DTN Crypto Simulator project -- a hybrid RSA-AES + CP-ABE encryption library, delay-tolerant network simulator, and web-based visualization platform.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Getting Started](#2-getting-started)
3. [Cryptography Layer](#3-cryptography-layer)
4. [Simulation Engine](#4-simulation-engine)
5. [Routing Algorithms](#5-routing-algorithms)
6. [Bundle Integrity Verification](#6-bundle-integrity-verification)
7. [Transmission Timing Model](#7-transmission-timing-model)
8. [Custom Payloads](#8-custom-payloads)
9. [Web Dashboard (React)](#9-web-dashboard-react)
10. [REST and WebSocket API](#10-rest-and-websocket-api)
11. [PCAP and Wireshark Integration](#11-pcap-and-wireshark-integration)
12. [CLI Reference](#12-cli-reference)
13. [Configuration Reference](#13-configuration-reference)
14. [Testing](#14-testing)
15. [Advanced Web UI and Inspector](#15-advanced-web-ui-and-inspector)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Project Overview

### What is DTN?

Delay-Tolerant Networking (DTN) is a network architecture designed for environments where continuous end-to-end connectivity cannot be assumed. DTN uses a "store-carry-forward" paradigm where intermediate nodes (relays) buffer data bundles and forward them when contact opportunities arise.

### What does this project do?

This project provides:

- **dtn_crypto**: A Python library implementing dual-layer encryption for DTN bundles (RSA-AES for confidentiality + CP-ABE for attribute-based access control), with SHA-256 end-to-end integrity verification.
- **simulator**: A discrete-event network simulator with three routing algorithms (Epidemic, PRoPHET, Spray-and-Wait), configurable scenarios, transmission timing, and PCAP output.
- **api**: A FastAPI backend providing REST and WebSocket APIs for running simulations from a web browser.
- **frontend**: A React + TypeScript single-page application with D3.js network visualization and Chart.js metrics dashboards.

### Design Principles

- **Layered security**: Two independent encryption layers ensure both confidentiality (RSA-AES) and fine-grained access control (CP-ABE).
- **End-to-end integrity**: SHA-256 hashing on plaintext before encryption proves payload integrity through untrusted relay nodes.
- **Realistic simulation**: Bandwidth-based transmission timing, configurable contact patterns, and real crypto operations (not mocked).
- **Single-command deployment**: `uvicorn api.app:app` serves both the API and the built React frontend.

---

## 2. Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+ (for frontend development)
- pip

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd dtn-crypto

# Install Python dependencies (all features)
pip install -e ".[all]"

# Build the React frontend
cd frontend
npm install
npm run build
cd ..
```

### Quick Start

```bash
# Run the web server (API + frontend)
uvicorn api.app:app --port 8000

# Open http://localhost:8000 in your browser

# Or run a CLI simulation
python run_simulation.py --router epidemic --nodes 10 --duration 3600
```

---

## 3. Cryptography Layer

### Dual-Layer Encryption Architecture

Every DTN bundle payload is protected by two independent encryption layers:

```
Plaintext Payload
       |
       v
  [SHA-256 hash computed and stored in metadata]
       |
       v
  Layer 1: CP-ABE Encryption
    - Encrypts payload under a boolean attribute policy
    - Only users with matching attributes can decrypt
    - Example policy: "(role:doctor AND dept:emergency) OR clearance:admin"
       |
       v
  Layer 2: RSA-AES Hybrid Encryption
    - Generates ephemeral AES-256-GCM session key
    - Encrypts the CP-ABE ciphertext with AES-256-GCM
    - Wraps the AES key with destination's RSA-OAEP public key
    - Only the destination node can unwrap the AES key
       |
       v
  Encrypted Bundle (transmitted through DTN)
```

### RSA-AES Hybrid Encryption

The outer encryption layer uses RSA-OAEP for key exchange and AES-256-GCM for bulk encryption:

```python
from dtn_crypto import hybrid_encrypt, hybrid_decrypt, generate_rsa_keypair

priv_key, pub_key = generate_rsa_keypair(key_size=2048)
ciphertext = hybrid_encrypt(b"secret data", pub_key)
plaintext = hybrid_decrypt(ciphertext, priv_key)
```

**Key properties:**
- RSA-OAEP with SHA-256 for key wrapping
- AES-256-GCM with random 96-bit nonce for bulk encryption
- Authenticated encryption with optional associated data (AAD)
- Each encryption generates a fresh ephemeral AES key

### CP-ABE (Ciphertext-Policy Attribute-Based Encryption)

The inner encryption layer enforces access policies based on user attributes:

```python
from dtn_crypto import CPABEService, Policy

cpabe = CPABEService()
master_key, public_params = cpabe.setup()

# Create user keys with specific attributes
doctor_key = cpabe.keygen(master_key, public_params, ["role:doctor", "dept:emergency"])
nurse_key = cpabe.keygen(master_key, public_params, ["role:nurse"])

# Encrypt under a policy
policy = Policy("(role:doctor AND dept:emergency) OR clearance:admin")
ciphertext = cpabe.encrypt(b"patient records", public_params, policy)

# Doctor can decrypt (attributes match policy)
plaintext = cpabe.decrypt(ciphertext, doctor_key, public_params)

# Nurse cannot decrypt (attributes don't match)
# Raises BundleDecryptionError
```

**Supported policy syntax:**
- Simple attributes: `"role:doctor"`
- AND operator: `"role:doctor AND dept:emergency"`
- OR operator: `"role:nurse OR role:doctor"`
- Nested: `"(role:doctor AND dept:er) OR clearance:admin"`

### Bundle Creation

The `BundleBuilder` class creates complete secure bundles with both encryption layers:

```python
from dtn_crypto import BundleBuilder, Policy, CPABEService, generate_rsa_keypair

cpabe = CPABEService()
mk, pp = cpabe.setup()
priv_key, pub_key = generate_rsa_keypair()
user_key = cpabe.keygen(mk, pp, ["role:receiver"])

builder = BundleBuilder(cpabe, pp)
bundle = builder.create_secure_bundle(
    payload=b"Hello from Mars!",
    source="mars-rover",
    destination="earth-station",
    dest_public_key=pub_key,
    policy=Policy("role:receiver"),
    ttl=7200,
    priority=BundlePriority.CRITICAL,
)

# SHA-256 hash is automatically computed and stored
print(bundle.metadata.payload_hash)

# Decrypt at destination
plaintext = bundle.decrypt_payload(priv_key, user_key, pp, cpabe)
```

---

## 4. Simulation Engine

### Discrete-Event Architecture

The simulation engine uses a priority queue (heapq) to process events in chronological order:

1. **Contact events**: Nodes come into communication range (CONTACT_START/END)
2. **Bundle creation**: Source nodes generate messages at a configurable rate
3. **Bundle transfer**: Routing algorithm decides which bundles to forward during contacts
4. **Bundle delivery**: Bundle reaches its destination node
5. **Bundle expiry**: TTL expires before delivery

### Event Types

| Event | Description | Data Fields |
|---|---|---|
| `CONTACT_START` | Two nodes come into range | `node_from`, `node_to` |
| `CONTACT_END` | Two nodes go out of range | `node_from`, `node_to` |
| `BUNDLE_CREATE` | New bundle generated | `node_from`, `bundle_id` |
| `BUNDLE_TRANSFER` | Bundle forwarded between nodes | `node_from`, `node_to`, `bundle_id` |
| `BUNDLE_DELIVER` | Bundle reaches destination | `node_to`, `bundle_id`, `latency` |
| `BUNDLE_EXPIRE` | Bundle TTL expired | `bundle_id` |
| `BUNDLE_DROPPED` | Bundle dropped (buffer full/hop limit) | `bundle_id` |
| `INTEGRITY_FAIL` | SHA-256 hash mismatch at destination | `bundle_id` |

### Simulation Flow

```
1. Load scenario configuration (nodes, contacts, bandwidth)
2. Initialize routing algorithm
3. Generate contact schedule
4. For each simulation tick:
   a. Process due events from priority queue
   b. On CONTACT_START: routing algorithm selects bundles to forward
   c. On transfer: encrypt payload (real RSA-AES + CP-ABE)
   d. Compute transmission time based on payload size and bandwidth
   e. On delivery: decrypt and verify SHA-256 integrity
   f. Collect metrics
5. Output final metrics (JSON, CSV, or API response)
```

---

## 5. Routing Algorithms

### Epidemic Routing

Flood-based replication where every node forwards every bundle to every contact.

- **Strategy**: Replicate to all contacts that don't already have the bundle
- **Pros**: Maximum delivery ratio in sparse networks
- **Cons**: High overhead, buffer pressure
- **Best for**: Disaster recovery, small networks

### PRoPHET (Probabilistic Routing)

Probabilistic Routing Protocol using History of Encounters and Transitivity.

- **Predictability**: P(a,b) increases on each encounter between nodes a and b
- **Aging**: Predictability decays over time: `P(a,b) = P(a,b) * gamma^k`
- **Transitivity**: If a meets b and b has high predictability for c, then a gains predictability for c: `P(a,c) = P(a,c) + (1 - P(a,c)) * beta * P(a,b) * P(b,c)`
- **Forward decision**: Only forward bundle if contact has higher predictability for destination
- **Best for**: Networks with recurring mobility patterns

| Parameter | Default | Description |
|---|---|---|
| `P_init` | 0.75 | Initial predictability on encounter |
| `gamma` | 0.98 | Aging factor per time unit |
| `beta` | 0.25 | Transitivity scaling factor |

### Spray-and-Wait (Binary Mode)

Controlled replication with a fixed number of bundle copies.

- **Spray phase**: Source starts with L copies. On contact, gives `floor(copies/2)` to relay
- **Wait phase**: When a node has 1 copy remaining, wait for direct delivery
- **Pros**: Bounded overhead, good delivery ratio
- **Cons**: Slower than Epidemic in some topologies
- **Best for**: Military tactical, bandwidth-constrained environments

| Parameter | Default | Description |
|---|---|---|
| `L` | 6 | Initial number of copies |

---

## 6. Bundle Integrity Verification

### How It Works

SHA-256 integrity verification proves that a bundle's payload was not tampered with during transit through untrusted relay nodes.

```
Source Node:
  1. Compute SHA-256 hash of plaintext payload
  2. Store hash in BundleMetadata.payload_hash
  3. Encrypt payload (CP-ABE + RSA-AES)
  4. Transmit encrypted bundle + metadata (including hash)

Relay Nodes:
  - Forward encrypted bundle without modification
  - Cannot read or verify payload (don't have keys)
  - Hash is visible in metadata but payload is encrypted

Destination Node:
  1. Decrypt outer layer (RSA-AES)
  2. Decrypt inner layer (CP-ABE)
  3. Compute SHA-256 hash of decrypted plaintext
  4. Compare with stored hash from metadata
  5. If mismatch: raise BundleIntegrityError
```

### Error Handling

```python
from dtn_crypto import BundleIntegrityError

try:
    plaintext = bundle.decrypt_payload(priv_key, user_key, pp, cpabe)
except BundleIntegrityError as e:
    # Payload was modified during transit
    print(f"Integrity check failed: {e}")
except BundleDecryptionError as e:
    # Decryption failed (wrong keys, corrupted ciphertext)
    print(f"Decryption failed: {e}")
```

### Metrics

The simulator tracks integrity failures:
- `integrity_failures`: Count of bundles that failed hash verification
- Displayed in the web dashboard metrics panel
- Included in JSON/CSV export

---

## 7. Transmission Timing Model

### Bandwidth-Based Timing

Each scenario defines a link bandwidth parameter. The simulator computes realistic transmission times:

```
transmission_time_ms = (payload_size_bytes * 8) / link_bandwidth_bps * 1000
```

The transmission time accumulates across each hop, so a bundle that traverses 3 hops will have 3x the single-hop transmission time.

### Scenario Bandwidth Parameters

| Scenario | `link_bandwidth_bps` | Description |
|---|---|---|
| Deep Space | 1,000 | Interplanetary DSN links |
| Disaster | 100,000 | Ad-hoc mesh radio links |
| Military | 50,000 | Tactical radio networks |
| Custom | 100,000 | Default for custom configs |

### Timing Breakdown

The web dashboard's "Crypto Overhead" chart displays three bars:
- **Encrypt**: Average time to encrypt a bundle (RSA-AES + CP-ABE)
- **Decrypt**: Average time to decrypt a bundle
- **Transmit**: Average simulated transmission time across all hops

### Metrics Fields

| Field | Type | Description |
|---|---|---|
| `avg_transmission_time_ms` | float | Mean transmission time for delivered bundles |
| `transmission_time_ms` (per bundle) | float | Cumulative transmission time across all hops |
| `payload_size_bytes` (per bundle) | int | Size of the encrypted payload in bytes |

---

## 8. Custom Payloads

### CLI Usage

Two mutually exclusive flags allow custom payload content:

```bash
# Direct text string
python run_simulation.py --router epidemic --payload-text "Custom telemetry data"

# From a text file (.txt only, max 1MB)
python run_simulation.py --router epidemic --payload-file sensor_data.txt
```

**Validation rules:**
- `--payload-file` and `--payload-text` are mutually exclusive
- File must exist and have `.txt` extension
- File size must not exceed 1,048,576 bytes (1MB)
- If neither flag is provided, the simulator uses a default payload

### Web API Usage

Include `payload_text` in the `SimulationConfig` JSON body:

```json
{
  "router": "epidemic",
  "nodes": 10,
  "duration": 3600,
  "scenario": "disaster",
  "payload_text": "Custom payload for all bundles in this simulation"
}
```

The `payload_text` field is optional and limited to 1MB (`max_length: 1048576`).

### Web Dashboard

The sidebar includes a "Custom Payload" text area where users can type or paste payload text directly. The text is sent as `payload_text` in the simulation configuration.

---

## 9. Web Dashboard (React)

### Technology Stack

| Technology | Purpose |
|---|---|
| React 19 | Component framework |
| TypeScript | Type safety |
| Vite 8 | Build tool and dev server |
| D3.js v7 | Force-directed network graph |
| Chart.js v4 | Metrics charts (line, bar, doughnut) |
| react-chartjs-2 | React wrapper for Chart.js |

### Component Architecture

```
App
+-- Sidebar
|   +-- Router select
|   +-- Node count slider
|   +-- Duration slider
|   +-- Message rate slider
|   +-- Payload text area
|   +-- FileUpload (.txt drag-and-drop button)
|   +-- Scenario buttons (Disaster, Deep Space, Military)
|   +-- Run / Reset buttons
|   +-- Status bar
|   +-- Export button
|   +-- Bundle list (clickable, after simulation)
+-- NetworkGraph (D3.js)
|   +-- Force simulation
|   +-- Node circles (color-coded, clickable)
|   +-- Link lines (animated when active)
|   +-- Bundle transfer dots (animated)
|   +-- Path highlighting (glow effect for selected bundle)
|   +-- Tooltip on hover
+-- InspectorPanel (Phase 5, right side)
|   +-- BundleInspector
|   |   +-- Path Timeline (hop-by-hop with timing)
|   |   +-- Timing Waterfall (stacked bar: encrypt/transmit/decrypt)
|   |   +-- Content Accordion (plaintext/encrypted/decrypted previews)
|   +-- NodeCryptoPanel
|       +-- CP-ABE attribute chips
|       +-- RSA PEM preview
|       +-- Stats grid (delivered/buffered)
+-- MetricsPanel
    +-- DeliveryGauge (percentage display)
    +-- LatencyChart (line chart, last 50 deliveries)
    +-- CryptoChart (bar chart: encrypt/decrypt/transmit ms)
    +-- StatusChart (doughnut: delivered/in-transit/dropped/expired)
```

### State Management

The `useSimulation` custom hook manages all simulation state:
- `config`: Current simulation configuration
- `status`: idle | running | done | error
- `events`: Array of simulation events (for graph updates)
- `metrics`: Final metrics response
- `result`: Complete simulation result (for export)
- `bundleDetails`: Map of bundle ID to detailed bundle information (path, timing, content)
- `nodeDetails`: Map of node ID to crypto credentials (RSA PEM, CP-ABE attributes)
- `selectedTarget`: Currently selected inspector target (bundle or node)

### WebSocket Protocol

1. Client connects to `ws://localhost:8000/ws/live`
2. Client sends JSON `SimulationConfig`
3. Server streams `SimulationEvent` objects as JSON
4. Server sends `{"type": "FINAL_RESULT", "metrics": {...}, "bundle_details": {...}, "node_details": {...}}`
5. Connection closes

If WebSocket fails, the frontend automatically falls back to REST (`POST /simulate`) and replays events for visualization.

### Development

```bash
cd frontend

# Start dev server with hot reload (proxies API to localhost:8000)
npm run dev

# Type-check
npx tsc -b

# Lint
npm run lint

# Production build
npm run build
```

### Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| > 900px | Sidebar (300px) + Graph + Bottom charts (4 columns) |
| 600-900px | Stacked: Sidebar, Graph, Charts (2 columns) |
| < 600px | Stacked: Sidebar, Graph, Charts (1 column) |

---

## 10. REST and WebSocket API

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Serve React frontend |
| `POST` | `/simulate` | Run simulation, return results |
| `GET` | `/scenarios` | List preset scenarios |
| `GET` | `/health` | Health check (`{"status": "ok"}`) |
| `WebSocket` | `/ws/live` | Real-time event streaming |

### POST /simulate

**Request body** (`SimulationConfig`):

| Field | Type | Default | Constraints |
|---|---|---|---|
| `router` | string | `"epidemic"` | `epidemic`, `prophet`, `spray` |
| `nodes` | int | `10` | 3-50 |
| `duration` | int | `3600` | 60-7200 |
| `scenario` | string | `"disaster"` | `deepspace`, `disaster`, `military`, `custom` |
| `seed` | int | `42` | >= 0 |
| `message_rate` | float | `1.0` | 0.1-10.0 |
| `enable_pcap` | bool | `false` | |
| `payload_text` | string? | `null` | max 1,048,576 chars |

**Response** (`SimulationResult`):

```json
{
  "metrics": {
    "total_bundles": 45,
    "delivered_bundles": 38,
    "dropped_bundles": 2,
    "expired_bundles": 5,
    "delivery_ratio": 0.844,
    "avg_latency_seconds": 234.5,
    "bundle_drop_rate": 0.156,
    "avg_encrypt_overhead_ms": 12.3,
    "avg_decrypt_overhead_ms": 8.7,
    "total_transfers": 156,
    "integrity_failures": 0,
    "avg_transmission_time_ms": 81.9,
    "hop_count_distribution": {"1": 10, "2": 15, "3": 8, "4": 5},
    "router_name": "epidemic",
    "duration": 3600,
    "num_nodes": 10
  },
  "event_log": [
    {"type": "CONTACT_START", "time": 12.5, "node_from": "node-0", "node_to": "node-3", ...},
    ...
  ],
  "pcap_file": null
}
```

### WebSocket /ws/live

Connect and send a `SimulationConfig` JSON message. The server streams events:

```javascript
const ws = new WebSocket("ws://localhost:8000/ws/live");
ws.onopen = () => ws.send(JSON.stringify(config));
ws.onmessage = (msg) => {
  const data = JSON.parse(msg.data);
  switch (data.type) {
    case "CONTACT_START":
    case "CONTACT_END":
    case "BUNDLE_CREATE":
    case "BUNDLE_TRANSFER":
    case "BUNDLE_DELIVER":
    case "BUNDLE_EXPIRE":
    case "BUNDLE_DROPPED":
      // Process simulation event
      break;
    case "SIMULATION_COMPLETE":
      // Simulation finished, wait for FINAL_RESULT
      break;
    case "FINAL_RESULT":
      // data.metrics contains MetricsResponse
      break;
  }
};
```

---

## 11. PCAP and Wireshark Integration

### Generating PCAP Files

```bash
# Generate PCAP file
python run_simulation.py --router epidemic --nodes 10 --pcap
# Output: results/bundles.pcap

# Real-time capture via localhost UDP
python run_simulation.py --router epidemic --nodes 10 --pcap --live-udp
# Wireshark: capture loopback, filter: udp.port == 4556
```

### Frame Structure

Each bundle transfer is encoded as:

```
Ethernet II Header (14 bytes)
  +-- Source MAC (deterministic per node)
  +-- Destination MAC
  +-- EtherType: 0x0800 (IPv4)
IPv4 Header (20 bytes)
  +-- Source IP (10.0.X.X, deterministic per node)
  +-- Destination IP
  +-- Protocol: 17 (UDP)
UDP Header (8 bytes)
  +-- Source Port: 4556
  +-- Destination Port: 4556
BPv7 Payload (variable)
  +-- CBOR-encoded bundle per RFC 9171
  +-- Bundle version 7
  +-- Endpoint IDs: dtn://node-X/
```

### Viewing in Wireshark

1. Open the `.pcap` file in Wireshark
2. Right-click any UDP packet -> **Decode As** -> select **BPv7**
3. Expand the "Bundle Protocol Version 7" tree to inspect bundle fields

---

## 12. CLI Reference

```
usage: run_simulation.py [-h] [--router {epidemic,prophet,spray}]
                         [--nodes N] [--duration SEC] [--scenario NAME]
                         [--seed N] [--message-rate RATE] [--compare]
                         [--config FILE] [--pcap] [--live-udp]
                         [--payload-file FILE] [--payload-text TEXT]

DTN Crypto Simulator

options:
  --router          Routing algorithm: epidemic, prophet, spray (default: epidemic)
  --nodes           Number of network nodes (default: 10)
  --duration        Simulation duration in seconds (default: 3600)
  --scenario        Preset scenario: deepspace, disaster, military, custom
  --seed            Random seed for reproducibility (default: 42)
  --message-rate    Messages per minute (default: 1.0)
  --compare         Compare all 3 routing algorithms side by side
  --config          Path to custom JSON configuration file
  --pcap            Generate Wireshark-compatible PCAP file
  --live-udp        Send live UDP packets for real-time Wireshark capture
  --payload-file    Path to .txt file to use as bundle payload (max 1MB)
  --payload-text    Text string to use as bundle payload
```

---

## 13. Configuration Reference

### Scenario Parameters

| Parameter | Type | Description |
|---|---|---|
| `nodes` | int | Number of network nodes |
| `duration` | int | Simulation duration (seconds) |
| `contact_range` | float | Communication range for contact generation |
| `contact_duration_range` | tuple | Min/max contact duration |
| `buffer_size` | int | Max bundles per node buffer |
| `ttl` | int | Bundle time-to-live (seconds) |
| `link_bandwidth_bps` | int | Link bandwidth in bits per second |
| `message_rate` | float | Messages generated per minute |

### Custom JSON Configuration

```json
{
  "nodes": 12,
  "duration": 1800,
  "contacts": [
    {"node_a": 0, "node_b": 1, "start": 0, "end": 600, "bandwidth": 1000},
    {"node_a": 1, "node_b": 2, "start": 300, "end": 900, "bandwidth": 500}
  ],
  "messages": [
    {"source": 0, "destination": 5, "time": 10, "size": 1024}
  ]
}
```

---

## 14. Testing

### Running Tests

```bash
# All tests (129 total)
pytest

# With verbose output
pytest -v

# Specific module
pytest tests/test_bundle.py -v     # Includes SHA-256 integrity tests
pytest tests/test_api.py -v        # Includes payload/integrity API tests

# With coverage
pytest --cov=dtn_crypto --cov-report=term-missing

# Lint
ruff check dtn_crypto/ simulator/ api/ tests/

# Frontend lint + type-check
cd frontend && npm run lint && npx tsc -b
```

### Test Breakdown

| Test File | Count | Covers |
|---|---|---|
| `test_rsa_aes.py` | 19 | RSA key generation, hybrid encrypt/decrypt, serialization |
| `test_cpabe.py` | 8 | CP-ABE setup, keygen, encrypt/decrypt, policy matching |
| `test_bundle.py` | 28 | Bundle creation, dual-layer decrypt, serialization, SHA-256 integrity |
| `test_pcap.py` | 23 | CBOR encoding, BPv7 frames, Ethernet/IP/UDP headers, PCAP file format |
| `test_api.py` | 23 | REST endpoints, WebSocket, custom payload, integrity/timing fields |
| **Total** | **129** | |

---

## 15. Advanced Web UI and Inspector

Phase 5 introduces a modern glassmorphism design system, interactive bundle/node inspection, and path visualization capabilities.

### Design System

The UI uses a glassmorphism design language with the following CSS properties:

| Property | Value | Purpose |
|---|---|---|
| `--glass-bg` | `rgba(30,30,46,0.7)` | Semi-transparent panel backgrounds |
| `--glass-border` | `rgba(255,255,255,0.08)` | Subtle glass borders |
| `--glass-blur` | `blur(12px)` | Backdrop blur for depth |
| `--glow-accent` | `#7c3aed` | Purple accent for glows |
| `--gradient-primary` | `linear-gradient(135deg, #7c3aed, #2563eb)` | Primary gradient |
| `--font-mono` | `'JetBrains Mono', monospace` | Code/data font |

Fonts: Inter (UI text) and JetBrains Mono (code/data).

### Bundle Inspector

Click a bundle in the sidebar list to open the Bundle Inspector panel on the right side:

**Path Timeline**: Shows the complete hop-by-hop journey with timing:
```
source-node → relay-1 (12.5ms) → relay-3 (8.2ms) → destination (5.1ms)
```

**Timing Waterfall**: Horizontal stacked bar chart showing:
- Encrypt time (purple) -- CP-ABE + RSA-AES encryption at source
- Transmit time (blue) -- Cumulative transmission across all hops
- Decrypt time (green) -- RSA-AES + CP-ABE decryption at destination

**Content Accordion**: Expandable sections showing:
- Plaintext preview (first 200 chars of source payload)
- Encrypted preview (base64 snippet of ciphertext in transit)
- Decrypted preview (final payload after integrity verification)

### Node Crypto Panel

Click any node in the network graph to open the Node Crypto Panel:

- **CP-ABE Attributes**: Displayed as colored chips (e.g., `role:receiver`, `dept:ops`)
- **RSA Public Key**: PEM preview (first 5 lines of the PEM-encoded public key)
- **Statistics Grid**: Bundles delivered, bundles in buffer

### Path Highlighting

When a bundle is selected, its path through the network is highlighted:
- SVG lines with `stroke: var(--glow-accent)` and `strokeWidth: 3`
- Glow effect via CSS `filter: drop-shadow()`
- Automatically computed from the bundle's `hop_history`

### File Upload

The sidebar includes a file upload button for `.txt` payload files:
- Accepts only `.txt` files (MIME type validation)
- Maximum file size: 1MB (1,048,576 bytes)
- Uses FileReader API to read content as text
- Replaces the payload text area content on upload

### CSS Grid Layout

The layout uses CSS Grid with dynamic columns when the inspector is open:

```css
/* Default (no inspector) */
body { grid-template-columns: 280px 1fr; }

/* Inspector open */
body.inspector-open { grid-template-columns: 280px 1fr 360px; }

/* Bottom panel always visible */
body { grid-template-rows: 1fr 220px; }
```

### Backend API Extensions

The `FINAL_RESULT` WebSocket message now includes additional data:

```json
{
  "type": "FINAL_RESULT",
  "metrics": { ... },
  "bundle_details": {
    "bundle-abc123": {
      "bundle_id": "bundle-abc123",
      "source": "node-0",
      "destination": "node-5",
      "status": "delivered",
      "hop_history": [
        {"from_node": "node-0", "to_node": "node-2", "time": 45.2, "transmission_time_ms": 81.9},
        {"from_node": "node-2", "to_node": "node-5", "time": 120.8, "transmission_time_ms": 81.9}
      ],
      "encrypt_time_ms": 12.3,
      "decrypt_time_ms": 8.7,
      "transmission_time_ms": 163.8,
      "plaintext_preview": "Hello DTN!",
      "encrypted_preview": "gAAAAABk...",
      "payload_hash": "a3f2c8...",
      "cpabe_policy": "role:receiver",
      "integrity_verified": true
    }
  },
  "node_details": {
    "node-0": {
      "node_id": "node-0",
      "attributes": ["role:sender", "dept:ops"],
      "rsa_public_pem": "-----BEGIN PUBLIC KEY-----\nMIIBIjAN...",
      "bundles_delivered": 5,
      "bundles_buffered": 2
    }
  }
}
```

---

## 16. Troubleshooting

### Common Issues

**ModuleNotFoundError: No module named 'dtn_crypto'**
- Ensure you installed with `pip install -e ".[all]"`
- The package directory is `dtn_crypto/` (underscore, not hyphen)

**Frontend shows blank page**
- Run `cd frontend && npm run build` to generate `frontend/dist`
- Verify `frontend/dist/index.html` exists
- Restart the FastAPI server

**WebSocket connection fails**
- The frontend automatically falls back to REST API
- Check that FastAPI is running on port 8000
- Check browser console for CORS errors

**PCAP file not generated**
- Use `--pcap` flag: `python run_simulation.py --router epidemic --pcap`
- Check `results/` directory for output file

**Python bytecode cache issues**
- If you see stale behavior after editing, clear caches:
  ```bash
  find . -type d -name __pycache__ -exec rm -rf {} +
  ```

**Node.js not found (frontend build)**
- Install Node.js 18+: `winget install OpenJS.NodeJS.LTS` (Windows) or `brew install node` (macOS)
