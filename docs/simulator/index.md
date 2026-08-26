# Simulator Overview

The DTN network simulator uses a discrete-event simulation engine to model bundle forwarding across nodes with intermittent connectivity.

## Core Concepts

### Discrete-Event Simulation

Events are processed in chronological order using a priority queue (heapq). Each event triggers state changes and may generate new events.

### Event Types

| Event | Description |
|---|---|
| `CONTACT_START` | Two nodes enter communication range |
| `CONTACT_END` | Two nodes leave communication range |
| `BUNDLE_CREATE` | A new bundle is generated at a source node |
| `BUNDLE_TRANSFER` | A bundle is forwarded from one node to another |
| `BUNDLE_DELIVER` | A bundle reaches its destination |
| `BUNDLE_EXPIRE` | A bundle's TTL expires |
| `BUNDLE_DROPPED` | A bundle is dropped (buffer full or hop limit) |
| `NODE_UPDATE` | Real-time node state update (buffer, contacts, routing) |

### Node Model

Each node has:

- **Buffer** — Stores bundles waiting to be forwarded (configurable size)
- **Router** — Determines which bundles to forward and when
- **Crypto keys** — RSA key pair and CP-ABE attributes
- **Contact schedule** — When other nodes are reachable

### Bundle Lifecycle

1. Created at source with encrypted payload
2. Buffered at source node
3. Forwarded to relay nodes during contacts
4. Eventually delivered to destination or dropped/expired

## Quick Start

```python
from simulator.engine import SimulationEngine

config = {
    "router": "epidemic",
    "nodes": 10,
    "duration": 3600,
    "scenario": "disaster",
    "seed": 42,
    "message_rate": 1.0,
}

engine = SimulationEngine(config)
metrics = engine.run()
print(f"Delivery ratio: {metrics.delivery_ratio:.1%}")
```

## Modules

| Module | Description |
|---|---|
| [Routing Algorithms](routing.md) | Epidemic, PRoPHET, Spray-and-Wait |
| [Scenarios](scenarios.md) | Preset scenario configurations |
| [CLI Usage](cli.md) | Command-line interface |
