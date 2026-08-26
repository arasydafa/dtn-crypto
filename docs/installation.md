# Installation

## From PyPI

```bash
pip install dtn-crypto
```

## From Source (All Features)

```bash
git clone https://github.com/dtn-crypto/dtn-crypto.git
cd dtn-crypto
pip install -e ".[all]"
```

## Minimal (Crypto Library Only)

```bash
pip install -e .
```

## Development (Crypto + Tests + Lint)

```bash
pip install -e ".[dev]"
```

## Simulator + Web UI

```bash
pip install -e ".[simulator,dev]"
```

## Documentation Site

```bash
pip install -e ".[docs]"
mkdocs serve
```

## Requirements

- **Python**: 3.11 or later
- **Node.js**: 18+ (for frontend development)
- **cryptography**: >=41.0.0 (auto-installed)

## Verifying Installation

```bash
# Run all tests
pytest

# Check crypto library
python -c "from dtn_crypto import generate_rsa_keypair; print('OK')"

# Start web server
uvicorn api.app:app --port 8000
```

## Frontend Development

```bash
cd frontend
npm install
npm run dev    # Development with hot reload
npm run build  # Build for production
```

## Optional Dependencies

| Group | Packages | Purpose |
|---|---|---|
| `simulator` | fastapi, uvicorn, pydantic | Web API server |
| `dev` | pytest, pytest-cov, ruff, httpx | Testing and linting |
| `docs` | mkdocs, mkdocs-material, mkdocstrings | Documentation site |
| `all` | simulator + dev | Everything except docs |
