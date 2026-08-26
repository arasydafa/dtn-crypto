# api/simulator.py — Async wrapper around the Phase 2 simulation engine.
# Purpose: Runs the synchronous SimulationEngine in a thread pool and
#          streams events through an asyncio queue for WebSocket delivery.
# Dependencies: asyncio, simulator.engine
# Usage: result = await run_simulation_async(config); async for event in stream(config): ...

"""Async wrapper for running DTN simulations in a background thread.

Provides both one-shot simulation execution and live event streaming
through asyncio queues, enabling the WebSocket endpoint to push events
to the frontend in real-time.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from api.schemas import (
    BundleDetail,
    MetricsResponse,
    NodeDetail,
    SimulationConfig,
    SimulationEvent,
    SimulationResult,
)
from simulator.engine import SimulationEngine, create_router

logger = logging.getLogger(__name__)


def _metrics_to_response(metrics: Any) -> MetricsResponse:
    """Convert SimulationMetrics to a Pydantic MetricsResponse.

    Args:
        metrics: SimulationMetrics from the engine.

    Returns:
        MetricsResponse model.
    """
    return MetricsResponse(
        total_bundles=metrics.total_bundles,
        delivered_bundles=metrics.delivered_bundles,
        dropped_bundles=metrics.dropped_bundles,
        expired_bundles=metrics.expired_bundles,
        delivery_ratio=round(metrics.delivery_ratio, 4),
        avg_latency_seconds=round(metrics.avg_latency_seconds, 3),
        bundle_drop_rate=round(metrics.bundle_drop_rate, 4),
        avg_encrypt_overhead_ms=round(metrics.avg_encrypt_overhead_ms, 3),
        avg_decrypt_overhead_ms=round(metrics.avg_decrypt_overhead_ms, 3),
        total_transfers=metrics.total_transfers,
        integrity_failures=metrics.integrity_failures,
        avg_transmission_time_ms=round(metrics.avg_transmission_time_ms, 3),
        hop_count_distribution={
            str(k): v for k, v in sorted(metrics.hop_count_distribution.items())
        },
        router_name=metrics.router_name,
        duration=metrics.duration,
        num_nodes=metrics.num_nodes,
    )


def _run_sync(
    config: SimulationConfig,
    event_callback: Any | None = None,
) -> tuple[Any, list[dict[str, Any]], dict[str, Any], dict[str, Any]]:
    """Run the simulation synchronously (called from thread pool).

    Args:
        config: Simulation configuration.
        event_callback: Optional callback for event streaming.

    Returns:
        Tuple of (SimulationMetrics, event_log, bundle_details, node_details).
    """
    router = create_router(config.router)
    custom_payload = config.payload_text.encode(
        "utf-8") if config.payload_text else None
    engine = SimulationEngine(
        router=router,
        num_nodes=config.nodes,
        duration=config.duration,
        scenario=config.scenario,
        seed=config.seed,
        message_rate=config.message_rate,
        output_path="./results/",
        event_callback=event_callback,
        enable_pcap=config.enable_pcap,
        custom_payload=custom_payload,
    )
    metrics = engine.run()
    event_log = engine.get_event_log()
    bundle_details = engine.get_bundle_details()
    node_details = engine.get_node_details()
    return metrics, event_log, bundle_details, node_details


async def run_simulation_async(config: SimulationConfig) -> SimulationResult:
    """Run a simulation asynchronously in a thread pool.

    Args:
        config: Simulation configuration.

    Returns:
        SimulationResult with metrics and event log.
    """
    loop = asyncio.get_running_loop()
    metrics, event_log, raw_bundles, raw_nodes = await loop.run_in_executor(
        None, _run_sync, config, None,
    )

    events = [SimulationEvent(**evt) for evt in event_log]
    metrics_resp = _metrics_to_response(metrics)
    bundle_details = {k: BundleDetail(**v) for k, v in raw_bundles.items()}
    node_details = {k: NodeDetail(**v) for k, v in raw_nodes.items()}

    pcap_file = None
    if config.enable_pcap:
        pcap_file = f"./results/bundles_{config.router}.pcap"

    return SimulationResult(
        metrics=metrics_resp,
        event_log=events,
        pcap_file=pcap_file,
        bundle_details=bundle_details,
        node_details=node_details,
    )


async def stream_simulation(
    config: SimulationConfig,
    queue: asyncio.Queue[dict[str, Any] | None],
) -> SimulationResult:
    """Run a simulation and stream events through an asyncio queue.

    Events are pushed to the queue in real-time as the simulation runs.
    A None sentinel is pushed when the simulation completes.

    Args:
        config: Simulation configuration.
        queue: Asyncio queue for event streaming.

    Returns:
        SimulationResult with metrics and event log.
    """
    loop = asyncio.get_running_loop()

    def _event_callback(event_dict: dict[str, Any]) -> None:
        """Thread-safe callback that pushes events to the asyncio queue."""
        loop.call_soon_threadsafe(queue.put_nowait, event_dict)

    metrics, event_log, raw_bundles, raw_nodes = await loop.run_in_executor(
        None, _run_sync, config, _event_callback
    )

    # Signal completion
    loop.call_soon_threadsafe(queue.put_nowait, None)

    events = [SimulationEvent(**evt) for evt in event_log]
    metrics_resp = _metrics_to_response(metrics)
    bundle_details = {k: BundleDetail(**v) for k, v in raw_bundles.items()}
    node_details = {k: NodeDetail(**v) for k, v in raw_nodes.items()}

    pcap_file = None
    if config.enable_pcap:
        pcap_file = f"./results/bundles_{config.router}.pcap"

    return SimulationResult(
        metrics=metrics_resp,
        event_log=events,
        pcap_file=pcap_file,
        bundle_details=bundle_details,
        node_details=node_details,
    )
