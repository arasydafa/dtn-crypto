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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.router import api_router

app = FastAPI(
    title="DTN Crypto Simulator API",
    description=(
        "Simulate Delay-Tolerant Network communication with "
        "hybrid RSA-AES + CP-ABE encryption. Provides REST endpoints "
        "for running simulations and a WebSocket for real-time event streaming."
    ),
    version="0.1.0",
)

# CORS: allow all origins for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router)

# Serve static files (frontend) from project root
# The index.html in the project root will be served at /static/index.html
# but the primary way to access is opening the file directly in a browser
try:
    app.mount("/static", StaticFiles(directory="."), name="static")
except Exception:
    pass  # Static files are optional


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api.app:app", host="0.0.0.0", port=8000, reload=True)
