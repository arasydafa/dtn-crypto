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

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from api.router import api_router

app = FastAPI(
    title="DTN Crypto Simulator API",
    description=(
        "Simulate Delay-Tolerant Network communication with "
        "hybrid RSA-AES + CP-ABE encryption. Provides REST endpoints "
        "for running simulations and a WebSocket for real-time event streaming."
    ),
    version="0.2.0",
)

# CORS: allow all origins for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes (before static file mount so API paths take priority)
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
        file_path = FRONTEND_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIR / "index.html"))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api.app:app", host="0.0.0.0", port=8000, reload=True)
