# api/app.py — FastAPI application entry point for the DTN Simulator.
# Purpose: Creates the FastAPI app, configures CORS, and includes all routes.
# Dependencies: fastapi, uvicorn
# Usage: uvicorn api.app:app --reload

"""FastAPI application for the DTN Crypto Simulator.

Provides REST and WebSocket APIs for running DTN simulations with
hybrid RSA-AES + CP-ABE encryption from a web browser.

Run with: uvicorn api.app:app --reload
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from api.router import api_router

logger = logging.getLogger(__name__)

app = FastAPI(
    title="DTN Crypto Simulator API",
    description=(
        "Simulate Delay-Tolerant Network communication with "
        "hybrid RSA-AES + CP-ABE encryption. Provides REST endpoints "
        "for running simulations and a WebSocket for real-time event streaming."
    ),
    version="0.2.0",
)

# ---------------------------------------------------------------------------
# CORS — environment-driven origin allowlist
# ---------------------------------------------------------------------------
_allowed_origins = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Security headers middleware
# ---------------------------------------------------------------------------
@app.middleware("http")
async def _security_headers(request: Request, call_next):  # type: ignore[no-untyped-def]
    """Add standard security headers to all HTTP responses.

    Headers added:
        X-Content-Type-Options: nosniff
        X-Frame-Options: DENY
        X-XSS-Protection: 1; mode=block
        Referrer-Policy: strict-origin-when-cross-origin

    Args:
        request: The incoming HTTP request.
        call_next: The next middleware or route handler.

    Returns:
        The response with security headers attached.
    """
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# ---------------------------------------------------------------------------
# Global exception handler — never leak internals
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def _global_exception_handler(request: Request, exc: Exception):  # type: ignore[no-untyped-def]
    """Catch-all exception handler that returns a generic error response.

    Logs the full exception internally but never exposes stack traces
    or internal details to the client.

    Args:
        request: The HTTP request that caused the exception.
        exc: The unhandled exception.

    Returns:
        A JSONResponse with status 500 and a generic error message.
    """
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"error": "Internal server error"})


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
app.include_router(api_router)

# Serve the built React frontend from frontend/dist
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if FRONTEND_DIR.is_dir():
    # Serve static assets (JS, CSS, images) under /assets
    assets_dir = FRONTEND_DIR / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/")
    async def serve_root() -> FileResponse:
        """Serve the React SPA index.html at root."""
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str) -> FileResponse:
        """SPA catch-all: serve static file if it exists, else index.html."""
        file_path = (FRONTEND_DIR / full_path).resolve()
        # Path containment check — prevent serving files outside FRONTEND_DIR
        if file_path.is_file() and file_path.is_relative_to(FRONTEND_DIR.resolve()):
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIR / "index.html"))


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("api.app:app", host=host, port=port, reload=True)
