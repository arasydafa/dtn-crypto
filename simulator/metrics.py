# simulator/metrics.py — Metrics collection and reporting for the DTN simulator.
# Purpose: Collects simulation metrics (delivery ratio, latency, overhead, etc.)
#          and exports results as JSON and CSV.
# Dependencies: json, csv
# Usage: collector = MetricsCollector(); collector.record_delivery(bundle); collector.export("results/")

"""Metrics collection and export for DTN simulation results.

Tracks delivery ratio, latency, crypto overhead, hop count distribution,
and per-algorithm comparison data. Exports results in JSON and CSV formats.
"""

from __future__ import annotations

import csv
import json
import logging
import os
from dataclasses import dataclass, field
from typing import Any

from simulator.models import SimBundle

logger = logging.getLogger(__name__)


@dataclass
class SimulationMetrics:
    """Container for all simulation metrics.

    Attributes:
        total_bundles: Total number of bundles generated.
        delivered_bundles: Number of bundles successfully delivered.
        dropped_bundles: Number of bundles dropped (buffer full, hop limit).
        expired_bundles: Number of bundles that expired (TTL).
        delivery_ratio: Fraction of bundles delivered (0.0 to 1.0).
        avg_latency_seconds: Average delivery latency in seconds.
        latencies: List of individual delivery latencies.
        bundle_drop_rate: Fraction of bundles dropped.
        avg_encrypt_overhead_ms: Average encryption time in milliseconds.
        avg_decrypt_overhead_ms: Average decryption time in milliseconds.
        encrypt_times_ms: List of individual encryption times.
        decrypt_times_ms: List of individual decryption times.
        hop_count_distribution: Histogram of hop counts for delivered bundles.
        router_name: Name of the routing algorithm used.
        duration: Simulation duration in seconds.
        num_nodes: Number of nodes in the simulation.
        total_transfers: Total bundle transfers between nodes.
    """

    total_bundles: int = 0
    delivered_bundles: int = 0
    dropped_bundles: int = 0
    expired_bundles: int = 0
    delivery_ratio: float = 0.0
    avg_latency_seconds: float = 0.0
    latencies: list[float] = field(default_factory=list)
    bundle_drop_rate: float = 0.0
    avg_encrypt_overhead_ms: float = 0.0
    avg_decrypt_overhead_ms: float = 0.0
    encrypt_times_ms: list[float] = field(default_factory=list)
    decrypt_times_ms: list[float] = field(default_factory=list)
    hop_count_distribution: dict[int, int] = field(default_factory=dict)
    router_name: str = ""
    duration: int = 0
    num_nodes: int = 0
    total_transfers: int = 0


class MetricsCollector:
    """Collects and computes simulation metrics.

    Tracks all bundles and their outcomes, computes summary statistics,
    and exports results to JSON and CSV.
    """

    def __init__(self, router_name: str = "", duration: int = 0, num_nodes: int = 0) -> None:
        """Initialize the metrics collector.

        Args:
            router_name: Name of the routing algorithm.
            duration: Simulation duration in seconds.
            num_nodes: Number of nodes in the simulation.
        """
        self._bundles: list[SimBundle] = []
        self._event_log: list[dict[str, Any]] = []
        self._router_name = router_name
        self._duration = duration
        self._num_nodes = num_nodes
        self._total_transfers = 0

    def register_bundle(self, bundle: SimBundle) -> None:
        """Register a newly created bundle for tracking.

        Args:
            bundle: The bundle to track.
        """
        self._bundles.append(bundle)

    def record_transfer(self) -> None:
        """Record a bundle transfer event."""
        self._total_transfers += 1

    def log_event(
        self,
        event_type: str,
        time: float,
        node_from: str = "",
        node_to: str = "",
        bundle_id: str = "",
        event_data: dict[str, Any] | None = None,
    ) -> None:
        """Log a simulation event.

        Args:
            event_type: Type of event (e.g., "CONTACT_START").
            time: Simulation time of the event.
            node_from: Source node ID (if applicable).
            node_to: Destination node ID (if applicable).
            bundle_id: Bundle ID (if applicable).
            event_data: Additional event-specific data.
        """
        entry: dict[str, Any] = {
            "type": event_type,
            "time": round(time, 3),
            "node_from": node_from,
            "node_to": node_to,
            "bundle_id": bundle_id,
        }
        if event_data:
            entry["event_data"] = event_data
        self._event_log.append(entry)

    def compute_metrics(self) -> SimulationMetrics:
        """Compute all simulation metrics from collected data.

        Returns:
            A SimulationMetrics instance with all computed values.
        """
        metrics = SimulationMetrics(
            router_name=self._router_name,
            duration=self._duration,
            num_nodes=self._num_nodes,
            total_transfers=self._total_transfers,
        )

        metrics.total_bundles = len(self._bundles)

        # Count outcomes
        for bundle in self._bundles:
            if bundle.delivered:
                metrics.delivered_bundles += 1
                lat = bundle.latency()
                if lat is not None:
                    metrics.latencies.append(lat)
                # Record hop count
                hop = bundle.hop_count
                metrics.hop_count_distribution[hop] = (
                    metrics.hop_count_distribution.get(hop, 0) + 1
                )
            if bundle.dropped:
                metrics.dropped_bundles += 1
            if bundle.expired:
                metrics.expired_bundles += 1

            # Crypto overhead
            if bundle.encrypt_time_ms > 0:
                metrics.encrypt_times_ms.append(bundle.encrypt_time_ms)
            if bundle.decrypt_time_ms is not None and bundle.decrypt_time_ms > 0:
                metrics.decrypt_times_ms.append(bundle.decrypt_time_ms)

        # Compute ratios
        if metrics.total_bundles > 0:
            metrics.delivery_ratio = metrics.delivered_bundles / metrics.total_bundles
            metrics.bundle_drop_rate = (
                (metrics.dropped_bundles + metrics.expired_bundles) /
                metrics.total_bundles
            )

        # Compute averages
        if metrics.latencies:
            metrics.avg_latency_seconds = sum(
                metrics.latencies) / len(metrics.latencies)
        if metrics.encrypt_times_ms:
            metrics.avg_encrypt_overhead_ms = (
                sum(metrics.encrypt_times_ms) / len(metrics.encrypt_times_ms)
            )
        if metrics.decrypt_times_ms:
            metrics.avg_decrypt_overhead_ms = (
                sum(metrics.decrypt_times_ms) / len(metrics.decrypt_times_ms)
            )

        return metrics

    def get_event_log(self) -> list[dict[str, Any]]:
        """Get the full event log.

        Returns:
            List of event dictionaries.
        """
        return self._event_log

    def export_json(self, output_path: str, metrics: SimulationMetrics | None = None) -> str:
        """Export metrics and event log as JSON.

        Args:
            output_path: Directory path for the output file.
            metrics: Pre-computed metrics, or None to compute now.

        Returns:
            Path to the written JSON file.
        """
        if metrics is None:
            metrics = self.compute_metrics()

        os.makedirs(output_path, exist_ok=True)
        filepath = os.path.join(
            output_path, f"results_{metrics.router_name}.json")

        data: dict[str, Any] = {
            "router": metrics.router_name,
            "num_nodes": metrics.num_nodes,
            "duration": metrics.duration,
            "total_bundles": metrics.total_bundles,
            "delivered_bundles": metrics.delivered_bundles,
            "dropped_bundles": metrics.dropped_bundles,
            "expired_bundles": metrics.expired_bundles,
            "delivery_ratio": round(metrics.delivery_ratio, 4),
            "avg_latency_seconds": round(metrics.avg_latency_seconds, 3),
            "bundle_drop_rate": round(metrics.bundle_drop_rate, 4),
            "avg_encrypt_overhead_ms": round(metrics.avg_encrypt_overhead_ms, 3),
            "avg_decrypt_overhead_ms": round(metrics.avg_decrypt_overhead_ms, 3),
            "total_transfers": metrics.total_transfers,
            "hop_count_distribution": {
                str(k): v for k, v in sorted(metrics.hop_count_distribution.items())
            },
            "event_log": self._event_log,
        }

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

        logger.info("Exported JSON results to %s", filepath)
        return filepath

    def export_csv(self, output_path: str, metrics: SimulationMetrics | None = None) -> str:
        """Export summary metrics as CSV.

        Args:
            output_path: Directory path for the output file.
            metrics: Pre-computed metrics, or None to compute now.

        Returns:
            Path to the written CSV file.
        """
        if metrics is None:
            metrics = self.compute_metrics()

        os.makedirs(output_path, exist_ok=True)
        filepath = os.path.join(
            output_path, f"results_{metrics.router_name}.csv")

        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "router",
                "num_nodes",
                "duration",
                "total_bundles",
                "delivered_bundles",
                "dropped_bundles",
                "expired_bundles",
                "delivery_ratio",
                "avg_latency_seconds",
                "bundle_drop_rate",
                "avg_encrypt_overhead_ms",
                "avg_decrypt_overhead_ms",
                "total_transfers",
            ])
            writer.writerow([
                metrics.router_name,
                metrics.num_nodes,
                metrics.duration,
                metrics.total_bundles,
                metrics.delivered_bundles,
                metrics.dropped_bundles,
                metrics.expired_bundles,
                round(metrics.delivery_ratio, 4),
                round(metrics.avg_latency_seconds, 3),
                round(metrics.bundle_drop_rate, 4),
                round(metrics.avg_encrypt_overhead_ms, 3),
                round(metrics.avg_decrypt_overhead_ms, 3),
                metrics.total_transfers,
            ])

        logger.info("Exported CSV results to %s", filepath)
        return filepath


def export_comparison_csv(
    all_metrics: list[SimulationMetrics],
    output_path: str,
) -> str:
    """Export a comparison table of metrics from multiple router runs.

    Args:
        all_metrics: List of SimulationMetrics from different routers.
        output_path: Directory path for the output file.

    Returns:
        Path to the written CSV file.
    """
    os.makedirs(output_path, exist_ok=True)
    filepath = os.path.join(output_path, "comparison.csv")

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "router",
            "total_bundles",
            "delivered",
            "dropped",
            "expired",
            "delivery_ratio",
            "avg_latency_s",
            "drop_rate",
            "avg_encrypt_ms",
            "avg_decrypt_ms",
            "total_transfers",
        ])
        for m in all_metrics:
            writer.writerow([
                m.router_name,
                m.total_bundles,
                m.delivered_bundles,
                m.dropped_bundles,
                m.expired_bundles,
                round(m.delivery_ratio, 4),
                round(m.avg_latency_seconds, 3),
                round(m.bundle_drop_rate, 4),
                round(m.avg_encrypt_overhead_ms, 3),
                round(m.avg_decrypt_overhead_ms, 3),
                m.total_transfers,
            ])

    logger.info("Exported comparison CSV to %s", filepath)
    return filepath


def print_comparison_table(all_metrics: list[SimulationMetrics]) -> None:
    """Print a formatted comparison table to stdout.

    Args:
        all_metrics: List of SimulationMetrics from different routers.
    """
    header = (
        f"{'Router':<12} {'Delivered':>9} {'Dropped':>8} {'Expired':>8} "
        f"{'Del.Ratio':>10} {'Avg Lat(s)':>11} {'Encrypt(ms)':>12} "
        f"{'Decrypt(ms)':>12} {'Transfers':>10}"
    )
    print("\n" + "=" * len(header))
    print("ROUTING ALGORITHM COMPARISON")
    print("=" * len(header))
    print(header)
    print("-" * len(header))

    for m in all_metrics:
        row = (
            f"{m.router_name:<12} {m.delivered_bundles:>9} {m.dropped_bundles:>8} "
            f"{m.expired_bundles:>8} {m.delivery_ratio:>10.2%} "
            f"{m.avg_latency_seconds:>11.1f} {m.avg_encrypt_overhead_ms:>12.2f} "
            f"{m.avg_decrypt_overhead_ms:>12.2f} {m.total_transfers:>10}"
        )
        print(row)

    print("=" * len(header) + "\n")
