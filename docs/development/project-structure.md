# Project Structure

```
dtn-crypto/
├── dtn_crypto/              # Phase 1: Cryptography library
│   ├── __init__.py          # Public API (29 exported symbols)
│   ├── utils.py             # Key generation, PEM serialization, helpers
│   ├── rsa_aes.py           # RSA-OAEP + AES-256-GCM hybrid encryption
│   ├── cpabe.py             # CP-ABE with PolicyAttributeMatcher
│   └── bundle.py            # Dual-layer encrypted DTN bundles + SHA-256 integrity
│
├── simulator/               # Phase 2: DTN network simulator
│   ├── __init__.py
│   ├── models.py            # Node, SimBundle, ContactEvent, SimEvent + NODE_UPDATE
│   ├── engine.py            # Discrete-event simulation engine + real-time streaming
│   ├── crypto_layer.py      # Crypto integration wrapper + integrity tracking
│   ├── metrics.py           # Metrics collection + JSON/CSV export
│   ├── scenarios.py         # 3 preset scenarios + custom config + bandwidth params
│   ├── pcap_logger.py       # Phase 3: BPv7 PCAP writer for Wireshark
│   └── routers/
│       ├── __init__.py
│       ├── base.py          # Abstract router interface
│       ├── epidemic.py      # Epidemic routing (flood)
│       ├── prophet.py       # PRoPHET routing (probabilistic)
│       └── spray.py         # Spray-and-Wait (binary mode)
│
├── api/                     # Phase 3: FastAPI backend
│   ├── __init__.py
│   ├── app.py               # FastAPI app + serves React frontend from dist
│   ├── router.py            # Route definitions (REST + WebSocket)
│   ├── simulator.py         # Async simulation wrapper
│   ├── schemas.py           # Pydantic request/response models + BufferBundleSummary
│   └── scenarios.py         # Scenario info wrapper
│
├── frontend/                # Phase 4: React + TypeScript SPA (Vite)
│   ├── src/
│   │   ├── App.tsx          # Main app component (grid layout + NodeInspectorModal)
│   │   ├── App.css          # Dark theme CSS + modal styles
│   │   ├── main.tsx         # Entry point
│   │   ├── types/
│   │   │   └── index.ts     # TypeScript interfaces + LiveNodeState, PRIORITY_LABELS
│   │   ├── api/
│   │   │   └── client.ts    # REST API client + WebSocket URL helper
│   │   ├── hooks/
│   │   │   └── useSimulation.ts  # Central state manager + liveNodeStates, modal
│   │   └── components/
│   │       ├── TopNav.tsx           # Status bar, theme, fullscreen, controls
│   │       ├── Sidebar.tsx          # Config, presets, bundle list, priority selector
│   │       ├── NetworkGraph.tsx     # D3.js force-directed graph + live tooltip
│   │       ├── MetricsPanel.tsx     # Bottom tabbed panel (Charts/Events/AppLog)
│   │       ├── InspectorPanel.tsx   # Bundle/node inspector dispatcher
│   │       ├── BundleInspector.tsx  # Path, timing, content stages + priority badge
│   │       ├── NodeInspectorModal.tsx # 4-tab modal (Overview/Buffer/Routing/Contacts)
│   │       ├── NodeCryptoPanel.tsx  # RSA PEM, CP-ABE attributes, stats
│   │       ├── FileUpload.tsx       # .txt file upload widget
│   │       ├── EventLog.tsx         # Simulation event log
│   │       ├── AppLog.tsx           # Application log viewer
│   │       ├── ErrorBoundary.tsx    # React error boundary
│   │       ├── WikiModal.tsx        # Wiki content modal
│   │       └── charts/
│   │           ├── DeliveryGauge.tsx  # Delivery ratio display
│   │           ├── LatencyChart.tsx   # Latency over time
│   │           ├── CryptoChart.tsx    # Crypto overhead bars
│   │           └── StatusChart.tsx    # Bundle status doughnut
│   ├── dist/                # Built output (served by FastAPI)
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── tests/                   # Test suite (129 tests)
│   ├── __init__.py
│   ├── test_rsa_aes.py      # RSA-AES encryption tests
│   ├── test_cpabe.py        # CP-ABE tests
│   ├── test_bundle.py       # Bundle + SHA-256 integrity tests
│   ├── test_pcap.py         # PCAP/BPv7 encoding tests
│   └── test_api.py          # FastAPI endpoint + payload/integrity tests
│
├── docs/                    # MkDocs documentation site
│   ├── index.md
│   ├── installation.md
│   ├── architecture.md
│   ├── crypto/
│   ├── simulator/
│   ├── web-ui/
│   ├── api/
│   └── development/
│
├── mkdocs.yml               # MkDocs configuration
├── pyproject.toml            # Package configuration
├── README.md                # Project documentation
├── WIKI.md                  # Technical wiki
├── CONTRIBUTING.md          # Contributing guidelines
├── LICENSE                  # MIT License
├── run_simulation.py        # CLI entry point
└── .github/
    └── workflows/
        ├── lint.yml          # Ruff linting CI
        ├── test.yml          # Pytest CI
        └── publish.yml       # PyPI publish on release
```

## Module Relationships

```
dtn_crypto ←── simulator/crypto_layer.py ←── simulator/engine.py
                                              ↓
                                        api/simulator.py ←── api/router.py
                                              ↓
                                        frontend/src/hooks/useSimulation.ts
```
