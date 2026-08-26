# Web UI Overview

The DTN Crypto Simulator web dashboard provides real-time visualization of network simulations with interactive inspection tools.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Visualization**: D3.js (network graph) + Chart.js (metrics)
- **Backend**: FastAPI + WebSocket + REST API
- **Build**: Vite with dev server proxy

## Features

### Network Graph

- D3.js force-directed visualization with draggable nodes
- Animated bundle transfers (moving dots between nodes)
- Contact link activation/deactivation
- Role-based node coloring (source, relay, destination)
- Zoom/pan with mouse wheel and drag
- Hover tooltips with live stats (buffer, deliveries, transfers)
- Click nodes to open the node inspector modal

### Inspector Panels

- **Node Inspector Modal** — 4-tab modal (Overview, Buffer, Routing, Contacts)
- **Bundle Inspector** — Right-side panel with path, timing, and content stages
- **Enhanced Tooltip** — Shows forwarded/dropped counts during simulation

### Metrics Panel

- **Delivery Gauge** — Percentage of bundles delivered
- **Latency Chart** — Line chart of delivery latency over time
- **Crypto Chart** — Bar chart of encrypt/decrypt/transmit overhead
- **Status Chart** — Doughnut chart of bundle status distribution
- **Event Log** — Chronological list of all simulation events
- **App Log** — Connection status and progress messages

### Controls

- Router selection (Epidemic, PRoPHET, Spray-and-Wait)
- Node count slider (5-50)
- Duration slider (60-7200s)
- Message rate slider (0.1-10 msg/min)
- Bundle priority selector (Bulk/Normal/Expedited/Critical)
- Scenario buttons (Disaster, Deep Space, Military)
- Animation speed control (0.5x-3x)
- Custom payload text input and file upload
- Preset save/load (localStorage)
- Bundle filter chips (All/Delivered/Dropped/Expired/In Transit)
- CSV export of event log
- JSON export of full results

## Starting the Server

```bash
# Start FastAPI server (serves both API and React frontend)
uvicorn api.app:app --reload --port 8000

# Open http://localhost:8000 in your browser
```

## Frontend Development

```bash
cd frontend
npm install
npm run dev    # Development with hot reload (port 5173)
npm run build  # Build for production (output in frontend/dist)
```
