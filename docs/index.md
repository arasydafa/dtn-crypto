# DTN Crypto Simulator

**Hybrid RSA-AES + CP-ABE encryption library, DTN network simulator, and web-based visualization for Delay-Tolerant Networks.**

---

## What is this?

DTN Crypto provides layered cryptographic protection for DTN bundle payloads, combining RSA-AES hybrid encryption for confidentiality with Ciphertext-Policy Attribute-Based Encryption (CP-ABE) for fine-grained access control. It includes a discrete-event network simulator with three routing algorithms, SHA-256 end-to-end bundle integrity verification, and a responsive React + TypeScript web dashboard.

## Key Features

### Cryptography

- **Hybrid RSA-AES encryption** — RSA-OAEP key wrapping + AES-256-GCM bulk encryption
- **CP-ABE policy-based access control** — Boolean attribute policies (AND/OR/nested)
- **SHA-256 integrity** — End-to-end bundle payload verification

### Simulator

- **3 routing algorithms** — Epidemic, PRoPHET (probabilistic), Spray-and-Wait (binary)
- **Discrete-event simulation** — heapq priority queue for chronological event processing
- **3 preset scenarios** — Deep space, disaster relief, military operations

### Web Dashboard

- **Real-time visualization** — D3.js force-directed network graph with animated transfers
- **Bundle inspector** — Path timeline, timing waterfall, content stages (plaintext/encrypted/decrypted)
- **Node inspector** — Role classification, buffer state, PRoPHET predictabilities, contact timeline
- **BPv7 PCAP capture** — Wireshark-readable packet captures

## Quick Start

```bash
# Install
pip install -e ".[simulator,dev]"

# Run web server
uvicorn api.app:app --reload --port 8000

# Open http://localhost:8000
```

## Architecture

```
Web Browser (React + TS) ←→ FastAPI Server ←→ Simulation Engine
                                                    ├── Epidemic Router
                                                    ├── PRoPHET Router
                                                    └── Spray-and-Wait Router
                                                          └── Crypto Layer (RSA-AES + CP-ABE)
```

## Documentation

Explore the documentation using the navigation tabs above, or start with:

- [Installation](installation.md) — Setup instructions
- [Architecture](architecture.md) — System design
- [Cryptography](crypto/index.md) — Encryption library
- [Simulator](simulator/index.md) — Network simulator
- [Web UI](web-ui/index.md) — Dashboard features
- [Development](development/contributing.md) — Contributing guide
