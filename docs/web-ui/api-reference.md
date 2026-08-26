# API Reference

## REST Endpoints

### POST /simulate

Run a simulation and return the complete result.

**Request Body** (`SimulationConfig`):

```json
{
  "router": "epidemic",
  "nodes": 10,
  "duration": 3600,
  "scenario": "disaster",
  "seed": 42,
  "message_rate": 1.0,
  "enable_pcap": false,
  "priority": 1
}
```

**Response** (`SimulationResult`):

```json
{
  "metrics": { ... },
  "event_log": [ ... ],
  "bundle_details": { ... },
  "node_details": { ... }
}
```

### GET /scenarios

Returns the list of available preset scenarios.

**Response**:

```json
[
  { "key": "disaster", "name": "Disaster Recovery", "description": "..." },
  { "key": "deepspace", "name": "Deep Space", "description": "..." },
  { "key": "military", "name": "Military Tactical", "description": "..." }
]
```

### GET /health

Health check endpoint.

**Response**:

```json
{ "status": "ok" }
```

## WebSocket

### ws://localhost:8000/ws/live

Real-time simulation event streaming.

**Connection Flow:**

1. Client connects to WebSocket
2. Client sends `SimulationConfig` as JSON
3. Server streams events in real-time
4. Server sends `FINAL_RESULT` when complete

**Event Types:**

| Type | Description | Key Fields |
|---|---|---|
| `CONTACT_START` | Nodes enter range | `node_from`, `node_to` |
| `CONTACT_END` | Nodes leave range | `node_from`, `node_to` |
| `BUNDLE_CREATE` | Bundle created | `node_from`, `bundle_id` |
| `BUNDLE_TRANSFER` | Bundle forwarded | `node_from`, `node_to`, `bundle_id` |
| `BUNDLE_DELIVER` | Bundle delivered | `node_to`, `bundle_id`, `latency` |
| `BUNDLE_EXPIRE` | TTL expired | `bundle_id` |
| `NODE_UPDATE` | Node state update | `node_id`, buffer, contacts, routing |
| `FINAL_RESULT` | Simulation complete | `metrics`, `bundle_details`, `node_details` |

**Example Client:**

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
    if (data.type === "FINAL_RESULT") {
        console.log("Metrics:", data.metrics);
    }
};
```

## Data Models

See [API Schemas](../api/schemas.md) for complete field definitions of all request/response models.
