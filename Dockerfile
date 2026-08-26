# ============================================================
# DTN Crypto Simulator — Multi-stage Dockerfile
# ============================================================

# ---- Stage 1: Build React frontend ----
FROM node:20-slim AS frontend-build

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

# ---- Stage 2: Production Python ----
FROM python:3.11-slim AS production

# Install UV for fast dependency management
RUN pip install --no-cache-dir uv

# Create non-root user
RUN groupadd --gid 1000 appuser && \
    useradd --uid 1000 --gid appuser --shell /bin/bash --create-home appuser

WORKDIR /app

# Install dependencies first (cache layer)
COPY pyproject.toml uv.lock README.md ./
RUN uv export --frozen --no-dev --no-hashes --extra simulator -o requirements.txt && \
    uv pip install --system --no-cache -r requirements.txt && \
    rm requirements.txt

# Copy application code
COPY dtn_crypto/ ./dtn_crypto/
COPY simulator/ ./simulator/
COPY api/ ./api/

# Copy built frontend from stage 1
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Set ownership
RUN chown -R appuser:appuser /app

USER appuser

# Environment defaults
ENV HOST=0.0.0.0 \
    PORT=8000 \
    CORS_ORIGINS=http://localhost:5173

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "api.app:app", "--host", "0.0.0.0", "--port", "8000"]
