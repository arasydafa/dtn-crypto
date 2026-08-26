# dtn-crypto

**Hybrid RSA-AES + CP-ABE encryption library, DTN network simulator, and web-based visualization for Delay-Tolerant Networks.**

dtn-crypto provides layered cryptographic protection for DTN bundle payloads, combining RSA-AES hybrid encryption for confidentiality with Ciphertext-Policy Attribute-Based Encryption (CP-ABE) for fine-grained access control. It includes a discrete-event network simulator with three routing algorithms, SHA-256 end-to-end bundle integrity verification, simulated transmission timing, custom payload support, and a responsive React + TypeScript web dashboard with Wireshark-compatible PCAP bundle protocol capture.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Cryptography Library](#cryptography-library)
- [DTN Simulator](#dtn-simulator)
- [Web UI and PCAP Capture](#web-ui-and-pcap-capture)
- [API Reference](#api-reference)
- [Running Tests](#running-tests)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)
- [Citation](#citation)

---

## Features

### Cryptography
- **Hybrid RSA-AES encryption** -- RSA-OAEP key wrapping + AES-256-GCM bulk encryption
- **CP-ABE policy-based access control** -- Boolean attribute policies (AND/OR/nested)
- **DTN bundle wrapping** -- Two-layer encryption in a serializable bundle format
- **Full key lifecycle** -- Generation, serialization (PEM), and deserialization
- **SHA-256 bundle integrity** -- Plaintext hash computed before encryption, verified after decryption
- **Type-safe** -- Complete type annotations on every function
- **Minimal dependencies** -- Only `cryptography` for production use

### Simulator
- **3 routing algorithms** -- Epidemic, PRoPHET (probabilistic with predictability aging + transitivity), Spray-and-Wait (binary mode)
- **Discrete-event simulation** -- heapq priority queue for chronological event processing
- **Crypto integration** -- Real hybrid RSA-AES + CP-ABE encryption on every bundle
- **3 preset scenarios** -- Deep space, disaster relief, military operations
- **Metrics collection** -- JSON + CSV export, comparison tables across routers
- **Custom configurations** -- JSON config files for arbitrary scenarios
- **Transmission timing** -- Simulated per-hop timing based on link bandwidth

### Web UI
- **Real-time web dashboard** -- React + TypeScript SPA with D3.js network graph + Chart.js metrics
- **4 graph layouts** -- Force-directed, circular, grid, tree (switchable without restarting simulation)
- **WebSocket live streaming** -- Events stream in real-time during simulation
- **Event type filters** -- Filter event log by CONTACT, CREATE, TRANSFER, DELIVER, EXPIRE, DROP, INTEGRITY
- **Node inspector** -- Click any node to view crypto credentials, bundle buffer, and statistics
- **Bundle inspector** -- View path timeline, per-hop timing, and content stages
- **Network statistics panel** -- Research-oriented metrics (delivery ratio, avg latency, hop distribution, crypto overhead)
- **Latency chart tooltips** -- Hover to see exact values with axis labels
- **Path highlighting** -- Selected bundle's path highlighted on the network graph
- **Responsive design** -- Adapts from desktop to mobile

### Infrastructure
- **UV package manager** -- Fast Python dependency management with lockfile
- **Hatchling build backend** -- Modern Python packaging
- **Docker support** -- Multi-stage production build + dev hot-reload
- **Security hardening** -- CORS allowlist, security headers, SPA path containment, error sanitization

---

## Architecture

```
+-----------------------------------------------------------+
|                     DTN Secure Bundle                      |
|                                                            |
|  +-----------------------------------------------------+  |
|  |  Layer 2 (Outer): RSA-AES Hybrid Encryption         |  |
|  |  - RSA-OAEP wraps ephemeral AES-256 session key     |  |
|  |  - AES-256-GCM encrypts inner layer ciphertext      |  |
|  |  - Destination-specific: only dest node can unwrap   |  |
|  |                                                      |  |
|  |  +------------------------------------------------+  |  |
|  |  |  Layer 1 (Inner): CP-ABE Encryption            |  |  |
|  |  |  - Policy-based symmetric key encryption       |  |  |
|  |  |  - AES-256-GCM encrypts plaintext payload      |  |  |
|  |  |  - Only users with matching attributes decrypt  |  |  |
|  |  |                                                |  |  |
|  |  |  +------------------------------------------+  |  |  |
|  |  |  |  Plaintext Payload (application data)    |  |  |  |
|  |  |  +------------------------------------------+  |  |  |
|  |  +------------------------------------------------+  |  |
|  +-----------------------------------------------------+  |
|                                                            |
|  Metadata: bundle_id, src, dst, TTL, priority, hop_count,  |
|           payload_hash (SHA-256)                            |
+-----------------------------------------------------------+
```

```
System Architecture:

+-------------------+    WebSocket/REST     +------------------+
|   Web Browser     | <------------------> |  FastAPI Server   |
|   React + TS SPA  |                       |  (api/)           |
|   D3.js + Charts  |                       +--------+---------+
+-------------------+                                |
  (frontend/dist)                                    v
  served by FastAPI                         +--------+---------+
                                            | Simulation Engine|
                                            |  (simulator/)    |
                                            +--------+---------+
                                                     |
                                    +----------------+----------------+
                                    |                |                |
                              +-----v-----+   +-----v-----+   +-----v-----+
                              | Epidemic   |   | PRoPHET   |   | Spray &   |
                              | Router     |   | Router    |   | Wait      |
                              +-----------+   +-----------+   +-----------+
                                    |
                              +-----v-----+
                              |  Crypto   |   dtn_crypto (RSA-AES + CP-ABE)
                              |  Layer    |   + SHA-256 integrity hashing
                              +-----+-----+
                                    |
                              +-----v-----+
                              | PCAP      |   BPv7 frames -> Wireshark
                              | Logger    |
                              +-----------+
```

---

## Installation

### Prerequisites

- Python 3.11+
- Node.js 20+ (for frontend)
- [UV](https://docs.astral.sh/uv/) (recommended) or pip

### Using UV (Recommended)

```bash
# Clone the repository
git clone https://github.com/arasydafa/dtn-crypto.git
cd dtn-crypto

# Install UV (if not installed)
pip install uv

# Install all dependencies (crypto + simulator + API)
uv sync --extra simulator

# Install with dev dependencies (tests + lint)
uv sync --extra simulator --extra dev
```

### Using pip

```bash
git clone https://github.com/arasydafa/dtn-crypto.git
cd dtn-crypto

# Install with all features
pip install -e ".[simulator,dev]"
```

### Docker

```bash
# Production build
docker compose --profile production build
docker compose --profile production up

# Development with hot-reload
docker compose --profile dev up app-dev

# Access at http://localhost:8000
```

### Frontend Development

```bash
cd frontend
npm install

# Development with hot-reload (port 5173)
npm run dev

# Build for production
npm run build
```

---

## Quick Start

### Python API

```python
from dtn_crypto import CPABEService, Policy, BundleBuilder, generate_rsa_keypair

# Setup crypto systems
cpabe = CPABEService()
master_key, public_params = cpabe.setup()
priv_key, pub_key = generate_rsa_keypair()
user_key = cpabe.keygen(master_key, public_params, ["role:receiver"])

# Create and encrypt a secure DTN bundle
builder = BundleBuilder(cpabe, public_params)
bundle = builder.create_secure_bundle(
    payload=b"Hello from deep space!",
    source="mars-rover", destination="earth-station",
    dest_public_key=pub_key, policy=Policy("role:receiver"),
)

# Decrypt at destination
plaintext = bundle.decrypt_payload(priv_key, user_key, public_params, cpabe)
assert plaintext == b"Hello from deep space!"
```

### Web Dashboard

```bash
# Start the server
uv run uvicorn api.app:app --reload --port 8000

# Open http://localhost:8000 in your browser
```

### CLI Simulation

```bash
# Run simulation with Epidemic routing
uv run python run_simulation.py --router epidemic --nodes 10 --duration 3600

# Compare all 3 routers
uv run python run_simulation.py --compare --scenario disaster --nodes 15

# Enable PCAP capture for Wireshark
uv run python run_simulation.py --router epidemic --nodes 10 --pcap
```

---

## Cryptography Library

### Hybrid RSA-AES Encryption

```python
from dtn_crypto import hybrid_encrypt, hybrid_decrypt, generate_rsa_keypair

priv_key, pub_key = generate_rsa_keypair()
ciphertext = hybrid_encrypt(b"secret message", pub_key)
plaintext = hybrid_decrypt(ciphertext, priv_key)
```

### CP-ABE Attribute-Based Access Control

```python
from dtn_crypto import CPABEService, Policy, PolicyAttributeMatcher

cpabe = CPABEService()
mk, pp = cpabe.setup()

# Complex policy with nested boolean expressions
policy = Policy("(role:doctor AND dept:emergency) OR clearance:admin")

# Generate keys for matching attributes
user_key = cpabe.keygen(mk, pp, ["role:doctor", "dept:emergency"])
ct = cpabe.encrypt(b"patient data", pp, policy)
plaintext = cpabe.decrypt(ct, user_key, pp)

# Check if attributes satisfy policy without decryption
matcher = PolicyAttributeMatcher()
assert matcher.evaluate(policy, ["role:doctor", "dept:emergency"]) is True
assert matcher.evaluate(policy, ["role:nurse"]) is False
```

### SHA-256 Bundle Integrity

```python
from dtn_crypto import BundleBuilder, BundleIntegrityError

bundle = builder.create_secure_bundle(
    payload=b"critical telemetry data",
    source="sensor-1", destination="ground-station",
    dest_public_key=pub_key, policy=Policy("role:operator"),
)

# Hash is stored in metadata
print(bundle.metadata.payload_hash)  # e.g. "a3f2..."

# Decryption verifies integrity automatically
try:
    plaintext = bundle.decrypt_payload(priv_key, user_key, pp, cpabe)
except BundleIntegrityError:
    print("Payload was tampered with during transit!")
```

---

## DTN Simulator

### Routing Algorithms

| Algorithm | Strategy | Key Parameters |
|---|---|---|
| **Epidemic** | Flood-based replication to all contacts | Buffer size limit |
| **PRoPHET** | Probabilistic routing with predictability aging (`gamma^k`) and transitivity (`beta * P(a,b) * P(b,c)`) | P_init, gamma, beta |
| **Spray-and-Wait** | Binary spray mode with `floor(n/2)` token splitting, then wait for direct delivery | L (initial copies) |

### Preset Scenarios

| Scenario | Description | Bandwidth |
|---|---|---|
| `deepspace` | Interplanetary DTN with long delays, sparse contacts | 1,000 bps |
| `disaster` | Post-disaster mesh network with mobile nodes | 100,000 bps |
| `military` | Tactical military network with CP-ABE policy enforcement | 50,000 bps |

### Custom Configuration

```bash
# Use a custom JSON configuration
uv run python run_simulation.py --config scenarios/custom.json

# Run with a custom text payload
uv run python run_simulation.py --router epidemic --nodes 10 --payload-text "Hello DTN!"

# Run with a custom file payload (.txt, max 1MB)
uv run python run_simulation.py --router epidemic --nodes 10 --payload-file message.txt
```

---

## Web UI and PCAP Capture

### Web Dashboard Features

- **Network Graph**: D3.js visualization with 4 layout modes (force, circular, grid, tree)
- **Real-time Streaming**: WebSocket events during simulation
- **Event Filters**: Filter by CONTACT, CREATE, TRANSFER, DELIVER, EXPIRE, DROP, INTEGRITY
- **Node Inspector**: Click nodes to view RSA keys, CP-ABE attributes, bundle buffer
- **Bundle Inspector**: View path timeline, per-hop timing, plaintext/encrypted content
- **Metrics Panel**: Delivery ratio, latency chart, crypto overhead, hop distribution
- **Network Statistics**: Research-oriented stats (total bundles, transfers, unique pairs, integrity failures)
- **Responsive Layout**: Adapts from desktop to mobile

### REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/simulate` | Run a simulation and get results |
| `GET` | `/scenarios` | List available preset scenarios |
| `GET` | `/health` | Health check |
| `WebSocket` | `/ws/live` | Real-time event streaming |

#### POST /simulate

```bash
curl -X POST http://localhost:8000/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "router": "epidemic",
    "nodes": 10,
    "duration": 3600,
    "scenario": "disaster",
    "seed": 42,
    "message_rate": 1.0,
    "enable_pcap": false,
    "payload_text": "Hello DTN!"
  }'
```

#### WebSocket /ws/live

```javascript
const ws = new WebSocket("ws://localhost:8000/ws/live");
ws.onopen = () => {
    ws.send(JSON.stringify({
        router: "prophet",
        nodes: 15,
        duration: 1800,
        scenario: "military"
    }));
};
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    // data.type: "CONTACT_START", "BUNDLE_TRANSFER", "DELIVER", "FINAL_RESULT", etc.
    console.log(data);
};
```

### Wireshark / PCAP Bundle Protocol Capture

The simulator generates Wireshark-readable PCAP files containing BPv7 (Bundle Protocol version 7) encoded frames per RFC 9171.

#### Generating a PCAP file

```bash
uv run python run_simulation.py --router epidemic --nodes 10 --pcap
# Output: results/bundles_epidemic.pcap
```

#### Real-time Wireshark Capture

```bash
uv run python run_simulation.py --router epidemic --nodes 10 --pcap --live-udp
# In Wireshark: capture on loopback interface, filter: udp.port == 4556
```

#### Viewing in Wireshark

1. Open the `.pcap` file in Wireshark
2. Right-click any UDP packet -> **Decode As** -> select **BPv7**
3. Expand the **"Bundle Protocol Version 7"** tree to inspect bundle fields
4. Each frame represents one bundle transfer between nodes

---

## API Reference

### `dtn_crypto.utils`

| Function | Parameters | Returns | Description |
|---|---|---|---|
| `generate_rsa_keypair` | `key_size: int = 2048` | `tuple[RSAPrivateKey, RSAPublicKey]` | Generate RSA key pair (min 2048-bit) |
| `generate_aes_key` | `key_size: int = 256` | `bytes` | Generate random AES key (128/192/256-bit) |
| `serialize_private_key` | `private_key, password=None` | `bytes` | Serialize RSA private key to PEM |
| `serialize_public_key` | `public_key` | `bytes` | Serialize RSA public key to PEM |
| `bytes_to_base64` | `data: bytes` | `str` | Encode bytes to URL-safe base64 |
| `base64_to_bytes` | `data: str` | `bytes` | Decode URL-safe base64 to bytes |

### `dtn_crypto.rsa_aes`

| Function / Class | Parameters | Returns | Description |
|---|---|---|---|
| `hybrid_encrypt` | `plaintext, public_key, aad=None` | `HybridCiphertext` | RSA-AES hybrid encryption |
| `hybrid_decrypt` | `hybrid_ct, private_key` | `bytes` | RSA-AES hybrid decryption |

### `dtn_crypto.cpabe`

| Function / Class | Parameters | Returns | Description |
|---|---|---|---|
| `CPABEService.setup` | `key_id=None` | `tuple[MasterKey, PublicParams]` | Initialize CP-ABE system |
| `CPABEService.keygen` | `master_key, public_params, attributes` | `UserKey` | Generate user key for attributes |
| `CPABEService.encrypt` | `plaintext, public_params, policy` | `Ciphertext` | Encrypt under access policy |
| `CPABEService.decrypt` | `ct, user_key, public_params` | `bytes` | Decrypt with attribute-based key |
| `Policy` | `policy_string: str` | -- | Access policy expression |
| `PolicyAttributeMatcher.evaluate` | `policy, attributes` | `bool` | Check if attributes satisfy policy |

### `dtn_crypto.bundle`

| Function / Class | Parameters | Returns | Description |
|---|---|---|---|
| `BundleBuilder.create_secure_bundle` | `payload, source, destination, dest_public_key, policy` | `SecureBundle` | Create dual-layer encrypted bundle |
| `SecureBundle.decrypt_payload` | `rsa_priv, cpabe_key, params, service` | `bytes` | Decrypt and verify integrity |
| `BundleIntegrityError` | -- | -- | Raised when SHA-256 verification fails |

---

## Running Tests

```bash
# Run all tests
uv run pytest

# Run with coverage
uv run pytest --cov=dtn_crypto --cov-report=term-missing

# Run specific test modules
uv run pytest tests/test_rsa_aes.py -v
uv run pytest tests/test_cpabe.py -v
uv run pytest tests/test_bundle.py -v
uv run pytest tests/test_pcap.py -v
uv run pytest tests/test_api.py -v

# Lint with ruff
uv run ruff check api/ simulator/ dtn_crypto/
```

### Test Coverage (129 tests)

| Module | Tests | Coverage |
|---|---|---|
| `dtn_crypto` | 60 | RSA-AES, CP-ABE, bundles, SHA-256 integrity |
| `simulator/pcap_logger` | 19 | PCAP + BPv7 encoding |
| `api/` | 23 | REST + WebSocket + payload/integrity |
| **Total** | **129** | |

---

## Project Structure

```
dtn-crypto/
+-- dtn_crypto/              # Cryptography library
|   +-- __init__.py          # Public API
|   +-- utils.py             # Key generation, PEM serialization
|   +-- rsa_aes.py           # RSA-OAEP + AES-256-GCM hybrid encryption
|   +-- cpabe.py             # CP-ABE with PolicyAttributeMatcher
|   +-- bundle.py            # Dual-layer encrypted DTN bundles
+-- simulator/               # DTN network simulator
|   +-- models.py            # Node, SimBundle, ContactEvent, SimEvent
|   +-- engine.py            # Discrete-event simulation engine
|   +-- crypto_layer.py      # Crypto integration + integrity tracking
|   +-- metrics.py           # Metrics collection + JSON/CSV export
|   +-- scenarios.py         # 3 preset scenarios + bandwidth params
|   +-- pcap_logger.py       # BPv7 PCAP writer for Wireshark
|   +-- routers/
|       +-- base.py          # Abstract router interface
|       +-- epidemic.py      # Epidemic routing (flood)
|       +-- prophet.py       # PRoPHET routing (probabilistic)
|       +-- spray.py         # Spray-and-Wait (binary mode)
+-- api/                     # FastAPI backend
|   +-- app.py               # App, CORS, security headers, SPA serving
|   +-- router.py            # Route definitions (REST + WebSocket)
|   +-- simulator.py         # Async simulation wrapper
|   +-- schemas.py           # Pydantic request/response models
|   +-- scenarios.py         # Scenario info wrapper
+-- frontend/                # React + TypeScript SPA (Vite)
|   +-- src/
|   |   +-- App.tsx          # Main app (grid layout, graph state)
|   |   +-- App.css          # Purple/teal theme, responsive breakpoints
|   |   +-- types/index.ts   # TypeScript interfaces
|   |   +-- api/client.ts    # REST + WebSocket client
|   |   +-- hooks/
|   |   |   +-- useSimulation.ts  # State, WS/REST, export
|   |   +-- components/
|   |       +-- Sidebar.tsx           # Controls, scenarios, bundle list
|   |       +-- NetworkGraph.tsx      # D3.js graph (4 layouts, click, path highlight)
|   |       +-- MetricsPanel.tsx      # Charts container
|   |       +-- NodeInspectorModal.tsx # Node detail popup (3 tabs)
|   |       +-- InspectorPanel.tsx    # Bundle inspector
|   |       +-- EventLog.tsx          # Event log with type filters
|   |       +-- NetworkStats.tsx      # Research stats panel
|   |       +-- charts/
|   |           +-- LatencyChart.tsx   # Line chart with tooltips
|   |           +-- CryptoChart.tsx    # Bar chart (encrypt/decrypt/transmit)
|   |           +-- StatusChart.tsx    # Doughnut chart (bundle status)
|   |           +-- HopDistributionChart.tsx  # Hop count histogram
|   +-- dist/                # Built output (served by FastAPI)
|   +-- package.json
|   +-- vite.config.ts
+-- tests/                   # Test suite (129 tests)
|   +-- test_rsa_aes.py
|   +-- test_cpabe.py
|   +-- test_bundle.py
|   +-- test_pcap.py
|   +-- test_api.py
+-- run_simulation.py        # CLI entry point
+-- pyproject.toml           # Hatchling build, UV dependencies
+-- Dockerfile               # Multi-stage production build
+-- docker-compose.yml       # Production + dev services
+-- uv.lock                  # Dependency lockfile
+-- .gitignore
+-- .dockerignore
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed CORS origins |
| `HOST` | `127.0.0.1` | Server bind address |
| `PORT` | `8000` | Server port |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines on:

- Setting up the development environment
- Code style (ruff, type hints, Google-style docstrings)
- Running tests and coverage
- Submitting pull requests

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## Citation

If you use dtn-crypto in academic research, please cite:

```bibtex
@software{dtn_crypto,
  title     = {dtn-crypto: Hybrid RSA-AES + CP-ABE Encryption for Delay-Tolerant Networks},
  author    = {Arasy Dafa Sulistya Kurniawan},
  year      = {2026},
  url       = {https://github.com/arasydafa/dtn-crypto},
  license   = {MIT},
  keywords  = {DTN, cryptography, RSA, AES, CP-ABE, delay-tolerant networks, bundle protocol},
  abstract  = {A Python library providing layered cryptographic protection for
               DTN bundle payloads using hybrid RSA-AES encryption for
               confidentiality and CP-ABE for fine-grained attribute-based
               access control in disconnected, multi-hop network environments,
               along with a network simulator and real-time web dashboard.}
}
```
