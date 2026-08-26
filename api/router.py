# api/router.py — API route definitions for the DTN Simulator.
# Purpose: Defines all FastAPI routes: POST /simulate, GET /scenarios,
#          GET /health, and WebSocket /ws/live.
# Dependencies: fastapi, api.schemas, api.simulator, api.scenarios
# Usage: Include this router in the FastAPI app: app.include_router(api_router)

"""API route definitions for the DTN Simulator."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.scenarios import get_presets
from api.schemas import (
    HealthResponse,
    ScenarioInfo,
    SimulationConfig,
    SimulationResult,
)
from api.simulator import run_simulation_async, stream_simulation

logger = logging.getLogger(__name__)

api_router = APIRouter()


@api_router.post("/simulate", response_model=SimulationResult)
async def simulate(config: SimulationConfig) -> SimulationResult:
    """Run a DTN simulation with the given configuration.

    Args:
        config: Simulation parameters (router, nodes, duration, etc.).

    Returns:
        SimulationResult containing metrics and the full event log.
    """
    try:
        result = await run_simulation_async(config)
        return result
    except Exception:
        logger.exception("Simulation failed")
        raise


@api_router.get("/scenarios", response_model=list[ScenarioInfo])
async def scenarios() -> list[ScenarioInfo]:
    """Get available preset scenario configurations.

    Returns:
        List of scenario descriptions with key, name, and description.
    """
    return get_presets()


@api_router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Health check endpoint.

    Returns:
        Service status and version.
    """
    return HealthResponse(status="ok", version="0.1.0")


@api_router.websocket("/ws/live")
async def websocket_live(websocket: WebSocket) -> None:
    """WebSocket endpoint for real-time simulation event streaming.

    Protocol:
    1. Client connects and sends a JSON SimulationConfig message.
    2. Server starts the simulation and streams SimulationEvent objects.
    3. Server sends a final {"type": "SIMULATION_COMPLETE", ...} event.
    4. Connection closes after simulation completes.
    """
    await websocket.accept()

    try:
        # Receive configuration from client
        raw_config = await websocket.receive_text()
        config_dict = json.loads(raw_config)
        config = SimulationConfig(**config_dict)

        # Create event queue for streaming
        queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

        # Start simulation in background
        sim_task = asyncio.create_task(stream_simulation(config, queue))

        # Stream events to WebSocket
        while True:
            event = await queue.get()
            if event is None:
                # Simulation complete
                break
            await websocket.send_json(event)

        # Wait for simulation to finish and send final result
        result = await sim_task

        # Send final metrics summary
        await websocket.send_json({
            "type": "FINAL_RESULT",
            "metrics": result.metrics.model_dump(),
            "bundle_details": {
                k: v.model_dump() for k, v in result.bundle_details.items()
            },
            "node_details": {
                k: v.model_dump() for k, v in result.node_details.items()
            },
        })

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except json.JSONDecodeError:
        await websocket.send_json({"error": "Invalid JSON configuration"})
    except Exception:
        logger.exception("WebSocket error")
        try:
            await websocket.send_json({"error": "Internal server error"})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
