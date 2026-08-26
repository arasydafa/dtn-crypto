# Dashboard

The main dashboard displays the network graph, metrics panel, and control interfaces.

## Layout

```
+----------------------------------------------------------+
|  TopNav (status, theme, fullscreen, run, reset, export)  |
+----------+-----------------------------------------------+
|          |                                                |
| Sidebar  |              Network Graph                     |
| (config, |         (D3.js force-directed)                |
|  bundles)|                                                |
|          +-----------------------------------------------+
|          |  Bottom Panel (Charts / Events / App Log)      |
+----------+-----------------------------------------------+
```

## Network Graph

The D3.js force-directed graph visualizes the network topology and simulation activity.

### Node States

| State | Color | Meaning |
|---|---|---|
| idle | Gray | No active contacts |
| active | Blue | Currently in a contact |
| delivering | Green | Just delivered a bundle (600ms flash) |

### Role Rings

Nodes get colored rings based on their role in the simulation:

- **Source** (outer ring) — Created bundles
- **Relay** (middle ring) — Forwarded bundles
- **Destination** (inner ring) — Received bundles

### Animations

- **Bundle transfers** — Animated dots move along contact links
- **Transfer lines** — Persistent lines show routing history
- **Path highlighting** — Selected bundle's path glows with gradient

### Interactions

- **Hover** — Shows tooltip with status, buffer count, deliveries, active transfers
- **Click** — Opens the node inspector modal
- **Drag** — Moves nodes (repositions force simulation)
- **Scroll** — Zoom in/out (0.3x to 4x)
- **Double-click** — Reset zoom to fit

## Metrics Panel

The bottom panel shows simulation metrics in three tabbed views.

### Collapsed State

When collapsed, shows a compact summary bar:

```
12 / 15 delivered | Ratio: 80.0% | Latency: 45.2s | Crypto: 12ms | Dropped: 2 | Expired: 1 | Events: 342
```

### Charts Tab

- **Delivery Gauge** — Large percentage display
- **Latency Chart** — Line chart (last 50 deliveries)
- **Crypto Chart** — Bar chart (encrypt/decrypt/transmit)
- **Status Chart** — Doughnut chart (delivered/in-transit/dropped/expired)

### Events Tab

Chronological event log with colored badges:

```
t=120.5s  📤 TRANSFER  Bundle abc-123 forwarded: node-0 → node-1
t=120.0s  🔗 CONTACT   Nodes node-0 and node-1 entered communication range
t=115.3s  📦 CREATE    Bundle abc-123 created at node-0
```

### App Log Tab

Application-level logs showing connection status and progress:

```
14:30:15  ✓ SUCCESS   WebSocket connected
14:30:15  ℹ INFO      Starting simulation: epidemic | 10 nodes | 3600s | disaster
14:30:45  ✓ SUCCESS   Simulation complete: 12/15 delivered (80.0%)
```

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+R` | Run simulation |
| `Ctrl+B` | Toggle bottom panel |
| `Ctrl+S` | Toggle sidebar |
| `F11` | Toggle fullscreen |
