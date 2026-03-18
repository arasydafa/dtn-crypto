<!-- README.md — Project documentation for dtn-crypto. -->
<!-- Purpose: Provides comprehensive documentation including installation, -->
<!--          usage examples, API reference, and contribution guidelines. -->

# dtn-crypto

[![Build Status](https://github.com/dtn-crypto/dtn-crypto/actions/workflows/test.yml/badge.svg)](https://github.com/dtn-crypto/dtn-crypto/actions/workflows/test.yml)
[![Coverage](https://codecov.io/gh/dtn-crypto/dtn-crypto/branch/main/graph/badge.svg)](https://codecov.io/gh/dtn-crypto/dtn-crypto)
[![PyPI Version](https://img.shields.io/pypi/v/dtn-crypto)](https://pypi.org/project/dtn-crypto/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python Version](https://img.shields.io/pypi/pyversions/dtn-crypto)](https://pypi.org/project/dtn-crypto/)

**Hybrid RSA-AES + CP-ABE encryption library, DTN network simulator, and web-based visualization for Delay-Tolerant Networks.**

dtn-crypto provides layered cryptographic protection for DTN bundle payloads, combining RSA-AES hybrid encryption for confidentiality with Ciphertext-Policy Attribute-Based Encryption (CP-ABE) for fine-grained access control. It includes a discrete-event network simulator with three routing algorithms and a real-time web dashboard with Wireshark-compatible PCAP bundle protocol capture.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Phase 1: Cryptography Library](#phase-1-cryptography-library)
- [Phase 2: DTN Simulator](#phase-2-dtn-simulator)
- [Phase 3: Web UI and PCAP Capture](#phase-3-web-ui-and-pcap-capture)
- [API Reference](#api-reference)
- [Running Tests](#running-tests)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)
- [Citation](#citation)

---

## Features

### Cryptography (Phase 1)
- **Hybrid RSA-AES encryption** -- RSA-OAEP key wrapping + AES-256-GCM bulk encryption
- **CP-ABE policy-based access control** -- Boolean attribute policies (AND/OR/nested)
- **DTN bundle wrapping** -- Two-layer encryption in a serializable bundle format
- **Full key lifecycle** -- Generation, serialization (PEM), and deserialization
- **Serialization** -- All crypto objects serialize to JSON-safe dictionaries
- **Type-safe** -- Complete type annotations on every function
- **Minimal dependencies** -- Only `cryptography` for production use

### Simulator (Phase 2)
- **3 routing algorithms** -- Epidemic, PRoPHET (probabilistic with predictability aging + transitivity), Spray-and-Wait (binary mode)
- **Discrete-event simulation** -- heapq priority queue for chronological event processing
- **Crypto integration** -- Real hybrid RSA-AES + CP-ABE encryption on every bundle
- **3 preset scenarios** -- Deep space, disaster relief, military operations
- **Metrics collection** -- JSON + CSV export, comparison tables across routers
- **Custom configurations** -- JSON config files for arbitrary scenarios

### Web UI and PCAP (Phase 3)
- **Real-time web dashboard** -- D3.js force-directed network graph + Chart.js metrics
- **WebSocket live streaming** -- Events stream in real-time during simulation
- **BPv7 PCAP capture** -- Wireshark-readable packet captures using RFC 9171 CBOR encoding
- **Live UDP packets** -- Real-time Wireshark capture via localhost UDP
- **REST API** -- FastAPI backend with POST /simulate, GET /scenarios, GET /health
- **No build tools** -- Single-page HTML/JS frontend, zero compilation required

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
|  Metadata: bundle_id, src, dst, TTL, priority, hop_count   |
+-----------------------------------------------------------+
```

```
System Architecture:

+-------------------+    WebSocket/REST     +------------------+
|   Web Browser     | <------------------> |  FastAPI Server   |
|   (index.html)    |                       |  (api/)           |
|   D3.js + Charts  |                       +--------+---------+
+-------------------+                                |
                                                     v
                                            +--------+---------+
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
                              |  Layer    |
                              +-----+-----+
                                    |
                              +-----v-----+
                              | PCAP      |   BPv7 frames -> Wireshark
                              | Logger    |
                              +-----------+
```

---

## Installation

### From PyPI

```bash
pip install dtn-crypto
```

### From source (all features)

```bash
git clone https://github.com/dtn-crypto/dtn-crypto.git
cd dtn-crypto
pip install -e ".[all]"
```

### Minimal (crypto library only)

```bash
pip install -e .
```

### Development (crypto + tests + lint)

```bash
pip install -e ".[dev]"
```

### Simulator + Web UI

```bash
pip install -e ".[simulator,dev]"
```

---

## Phase 1: Cryptography Library

### Quickstart

```python
from dtn_crypto import (
    CPABEService, Policy, BundleBuilder, generate_rsa_keypair,
)

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

---

## Phase 2: DTN Simulator

### CLI Usage

```bash
# Run single simulation with Epidemic routing
python run_simulation.py --router epidemic --nodes 10 --duration 3600

# Run with PRoPHET routing in deep space scenario
python run_simulation.py --router prophet --scenario deepspace --nodes 20

# Spray-and-Wait with military scenario
python run_simulation.py --router spray --scenario military --nodes 15

# Compare all 3 routers side by side
python run_simulation.py --compare --scenario disaster --nodes 15

# Use a custom JSON configuration
python run_simulation.py --config scenarios/custom.json

# Enable PCAP capture for Wireshark
python run_simulation.py --router epidemic --nodes 10 --pcap

# Enable live UDP for real-time Wireshark capture
python run_simulation.py --router epidemic --nodes 10 --pcap --live-udp
```

### Routing Algorithms

| Algorithm | Strategy | Key Parameters |
|---|---|---|
| **Epidemic** | Flood-based replication to all contacts | Buffer size limit |
| **PRoPHET** | Probabilistic routing with predictability aging (`gamma^k`) and transitivity (`beta * P(a,b) * P(b,c)`) | P_init, gamma, beta |
| **Spray-and-Wait** | Binary spray mode with `floor(n/2)` token splitting, then wait for direct delivery | L (initial copies) |

### Preset Scenarios

| Scenario | Description | Contact Pattern |
|---|---|---|
| `deepspace` | Interplanetary DTN with long delays (minutes to hours), sparse contacts | Scheduled orbital windows |
| `disaster` | Post-disaster mesh network with mobile nodes, intermittent contacts | Random mobility-based |
| `military` | Tactical military network with group formations and limited inter-group links | Formation-based with jamming |

### Custom Configuration (JSON)

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

## Phase 3: Web UI and PCAP Capture

### Starting the Web Server

```bash
# Start FastAPI server
uvicorn api.app:app --reload --port 8000

# Then open index.html in your browser
# The frontend connects to ws://localhost:8000/ws/live for real-time streaming
# Falls back to POST http://localhost:8000/simulate for REST mode
```

### Web Dashboard Features

- **Network Graph**: D3.js force-directed visualization showing nodes, active contacts (animated links), and bundle transfers (moving dots)
- **Metrics Panel**: Real-time charts showing delivery ratio, latency over time, crypto overhead, and bundle status distribution
- **Controls**: Router selection, node count (5-50), duration (60-7200s), message rate slider, preset scenario buttons
- **Export**: Download simulation results as JSON

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
    "enable_pcap": false
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
    // data.type: "CONTACT_START", "BUNDLE_TRANSFER", "DELIVERY", "FINAL_RESULT", etc.
    console.log(data);
};
```

### Wireshark / PCAP Bundle Protocol Capture

The simulator generates Wireshark-readable PCAP files containing BPv7 (Bundle Protocol version 7) encoded frames per RFC 9171.

#### Generating a PCAP file

```bash
# Via CLI
python run_simulation.py --router epidemic --nodes 10 --pcap

# Output: results/bundles.pcap
```

#### Real-time Wireshark Capture

```bash
# Start simulation with live UDP packets
python run_simulation.py --router epidemic --nodes 10 --pcap --live-udp

# In Wireshark: capture on loopback interface, filter: udp.port == 4556
```

#### Viewing in Wireshark

1. Open the generated `.pcap` file in Wireshark
2. Right-click any UDP packet -> **Decode As** -> select **BPv7**
   (or set UDP port 4556 to decode as BPv7 in Edit -> Preferences -> Protocols -> BPv7)
3. Expand the **"Bundle Protocol Version 7"** tree to inspect:
   - Bundle version (7)
   - Bundle processing control flags
   - Source / Destination endpoint IDs (`dtn://nodeX/`)
   - Creation timestamp and sequence number
   - Bundle lifetime
   - Payload block content
4. Each frame represents one bundle transfer between nodes during the simulation,
   wrapped in standard Ethernet/IPv4/UDP headers for Wireshark compatibility

#### PCAP Technical Details

- **Protocol**: BPv7 over UDP port 4556
- **Encoding**: CBOR (RFC 8949) as specified by RFC 9171
- **Frame structure**: Ethernet II -> IPv4 -> UDP -> BPv7 CBOR bundle
- **Node addressing**: Deterministic IP (10.0.X.X) and MAC mapping per node
- **Endpoint IDs**: DTN scheme URIs (`dtn://node-X/`)

---

## API Reference

### `dtn_crypto.utils`

| Function | Parameters | Returns | Description |
|---|---|---|---|
| `generate_rsa_keypair` | `key_size: int = 2048, public_exponent: int = 65537` | `tuple[RSAPrivateKey, RSAPublicKey]` | Generate an RSA key pair (min 2048-bit) |
| `generate_aes_key` | `key_size: int = 256` | `bytes` | Generate a random AES key (128/192/256-bit) |
| `serialize_private_key` | `private_key, password: Optional[bytes]` | `bytes` | Serialize RSA private key to PEM |
| `deserialize_private_key` | `pem_data: bytes, password: Optional[bytes]` | `RSAPrivateKey` | Deserialize RSA private key from PEM |
| `serialize_public_key` | `public_key` | `bytes` | Serialize RSA public key to PEM |
| `deserialize_public_key` | `pem_data: bytes` | `RSAPublicKey` | Deserialize RSA public key from PEM |
| `bytes_to_base64` | `data: bytes` | `str` | Encode bytes to URL-safe base64 |
| `base64_to_bytes` | `data: str` | `bytes` | Decode URL-safe base64 to bytes |
| `current_timestamp` | | `float` | Current UTC timestamp |

### `dtn_crypto.rsa_aes`

| Function / Class | Parameters | Returns | Description |
|---|---|---|---|
| `hybrid_encrypt` | `plaintext: bytes, public_key, aad: Optional[bytes]` | `HybridCiphertext` | Encrypt with RSA-AES hybrid (AES-256-GCM + RSA-OAEP) |
| `hybrid_decrypt` | `hybrid_ct: HybridCiphertext, private_key` | `bytes` | Decrypt RSA-AES hybrid ciphertext |
| `HybridCiphertext` | `encrypted_key, nonce, ciphertext, aad` | -- | Container for hybrid ciphertext components |

### `dtn_crypto.cpabe`

| Function / Class | Parameters | Returns | Description |
|---|---|---|---|
| `CPABEService.setup` | `key_id: Optional[str]` | `tuple[CPABEMasterKey, CPABEPublicParams]` | Initialize CP-ABE system |
| `CPABEService.keygen` | `master_key, public_params, attributes: list[str]` | `CPABEUserKey` | Generate user key for attributes |
| `CPABEService.encrypt` | `plaintext: bytes, public_params, policy: Policy` | `CPABECiphertext` | Encrypt under access policy |
| `CPABEService.decrypt` | `cpabe_ct, user_key, public_params` | `bytes` | Decrypt with attribute-based key |
| `Policy` | `policy_string: str` | -- | Access policy (e.g., `"role:doctor AND dept:er"`) |
| `PolicyAttributeMatcher.evaluate` | `policy: Policy, attributes: list[str]` | `bool` | Check if attributes satisfy policy |

### `dtn_crypto.bundle`

| Function / Class | Parameters | Returns | Description |
|---|---|---|---|
| `BundleBuilder` | `cpabe_service, cpabe_public_params` | -- | Factory for creating secure bundles |
| `BundleBuilder.create_secure_bundle` | `payload, source, destination, dest_public_key, policy, ttl, priority` | `SecureBundle` | Create a dual-layer encrypted bundle |
| `SecureBundle.decrypt_payload` | `rsa_private_key, cpabe_user_key, cpabe_public_params, cpabe_service` | `bytes` | Decrypt both crypto layers |
| `BundleMetadata` | `bundle_id, source, destination, creation_time, ttl, priority, ...` | -- | Bundle metadata header |
| `BundlePriority` | `BULK=0, NORMAL=1, EXPEDITED=2, CRITICAL=3` | -- | Priority level enum |

### Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| RSA key size | `int` | `2048` | RSA key size in bits (min 2048) |
| AES key size | `int` | `256` | AES key size in bits (128/192/256) |
| Bundle TTL | `int` | `3600` | Time-to-live in seconds |
| Max hop count | `int` | `32` | Maximum hops before bundle drop |
| Bundle priority | `BundlePriority` | `NORMAL` | Bundle priority level |

---

## Running Tests

```bash
# Install all dependencies
pip install -e ".[all]"

# Run all tests
pytest

# Run with coverage (crypto library)
pytest --cov=dtn_crypto --cov-report=term-missing

# Run specific test modules
pytest tests/test_rsa_aes.py -v        # RSA-AES encryption tests
pytest tests/test_cpabe.py -v          # CP-ABE tests
pytest tests/test_bundle.py -v         # Bundle tests
pytest tests/test_pcap.py -v           # PCAP/BPv7 tests
pytest tests/test_api.py -v            # FastAPI endpoint tests

# Lint with ruff
ruff check dtn_crypto/ simulator/ api/ tests/
```

### Test Coverage Summary

| Module | Tests | Coverage |
|---|---|---|
| `dtn_crypto` (Phase 1) | 55 | ~96% |
| `simulator/pcap_logger` (Phase 3) | 19 | PCAP + BPv7 encoding |
| `api/` (Phase 3) | 19 | REST + WebSocket endpoints |

---

## Project Structure

```
dtn-crypto/
+-- dtn_crypto/              # Phase 1: Cryptography library
|   +-- __init__.py          # Public API (28 exported symbols)
|   +-- utils.py             # Key generation, PEM serialization, helpers
|   +-- rsa_aes.py           # RSA-OAEP + AES-256-GCM hybrid encryption
|   +-- cpabe.py             # CP-ABE with PolicyAttributeMatcher
|   +-- bundle.py            # Dual-layer encrypted DTN bundles
+-- simulator/               # Phase 2: DTN network simulator
|   +-- __init__.py
|   +-- models.py            # Node, SimBundle, ContactEvent, SimEvent
|   +-- engine.py            # Discrete-event simulation engine
|   +-- crypto_layer.py      # Crypto integration wrapper
|   +-- metrics.py           # Metrics collection + JSON/CSV export
|   +-- scenarios.py         # 3 preset scenarios + custom config
|   +-- pcap_logger.py       # Phase 3: BPv7 PCAP writer for Wireshark
|   +-- routers/
|       +-- base.py          # Abstract router interface
|       +-- epidemic.py      # Epidemic routing (flood)
|       +-- prophet.py       # PRoPHET routing (probabilistic)
|       +-- spray.py         # Spray-and-Wait (binary mode)
+-- api/                     # Phase 3: FastAPI backend
|   +-- __init__.py
|   +-- app.py               # FastAPI application + CORS
|   +-- router.py            # Route definitions (REST + WebSocket)
|   +-- simulator.py         # Async simulation wrapper
|   +-- schemas.py           # Pydantic request/response models
|   +-- scenarios.py         # Scenario info wrapper
+-- tests/
|   +-- __init__.py
|   +-- test_rsa_aes.py      # RSA-AES encryption tests
|   +-- test_cpabe.py        # CP-ABE tests
|   +-- test_bundle.py       # Bundle tests
|   +-- test_pcap.py         # PCAP/BPv7 encoding tests
|   +-- test_api.py          # FastAPI endpoint tests
+-- index.html               # Phase 3: Web dashboard (D3.js + Chart.js)
+-- run_simulation.py        # CLI entry point
+-- pyproject.toml            # Package configuration
+-- .gitignore
+-- .github/
    +-- workflows/
        +-- lint.yml          # Ruff linting CI
        +-- test.yml          # Pytest CI
        +-- publish.yml       # PyPI publish on release
```

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
  author    = {DTN Crypto Contributors},
  year      = {2024},
  url       = {https://github.com/dtn-crypto/dtn-crypto},
  license   = {MIT},
  keywords  = {DTN, cryptography, RSA, AES, CP-ABE, delay-tolerant networks, bundle protocol},
  abstract  = {A Python library providing layered cryptographic protection for
               DTN bundle payloads using hybrid RSA-AES encryption for
               confidentiality and CP-ABE for fine-grained attribute-based
               access control in disconnected, multi-hop network environments,
               along with a network simulator and real-time web dashboard.}
}
```
