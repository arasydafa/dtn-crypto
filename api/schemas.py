# api/schemas.py — Pydantic request/response models for the DTN Simulator API.
# Purpose: Defines typed request and response models for all API endpoints.
# Dependencies: pydantic
# Usage: from api.schemas import SimulationConfig, SimulationResult

"""Pydantic request/response models for the DTN Simulator API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class SimulationConfig(BaseModel):
    """Request model for POST /simulate.

    Attributes:
        router: Routing algorithm name.
        nodes: Number of network nodes.
        duration: Simulation duration in seconds.
        scenario: Preset scenario name.
        seed: Random seed for reproducibility.
        message_rate: Messages per minute generation rate.
        enable_pcap: Whether to generate a PCAP capture file.
    """

    router: str = Field(default="epidemic",
                        pattern="^(epidemic|prophet|spray)$")
    nodes: int = Field(default=10, ge=3, le=50)
    duration: int = Field(default=3600, ge=60, le=7200)
    scenario: str = Field(
        default="disaster",
        pattern="^(deepspace|disaster|military|custom)$",
    )
    seed: int = Field(default=42, ge=0)
    message_rate: float = Field(default=1.0, ge=0.1, le=10.0)
    enable_pcap: bool = Field(default=False)
    payload_text: str | None = Field(
        default=None, max_length=1_048_576,
        description="Optional custom payload text (max 1MB).",
    )


class MetricsResponse(BaseModel):
    """Simulation metrics summary.

    Attributes:
        total_bundles: Total bundles generated.
        delivered_bundles: Bundles successfully delivered.
        dropped_bundles: Bundles dropped (buffer full, hop limit).
        expired_bundles: Bundles expired (TTL).
        delivery_ratio: Fraction of bundles delivered.
        avg_latency_seconds: Average delivery latency.
        bundle_drop_rate: Fraction of bundles dropped/expired.
        avg_encrypt_overhead_ms: Average encryption time.
        avg_decrypt_overhead_ms: Average decryption time.
        total_transfers: Total bundle transfers between nodes.
        hop_count_distribution: Histogram of hop counts.
        router_name: Routing algorithm used.
        duration: Simulation duration.
        num_nodes: Number of nodes.
    """

    total_bundles: int = 0
    delivered_bundles: int = 0
    dropped_bundles: int = 0
    expired_bundles: int = 0
    delivery_ratio: float = 0.0
    avg_latency_seconds: float = 0.0
    bundle_drop_rate: float = 0.0
    avg_encrypt_overhead_ms: float = 0.0
    avg_decrypt_overhead_ms: float = 0.0
    total_transfers: int = 0
    integrity_failures: int = 0
    avg_transmission_time_ms: float = 0.0
    hop_count_distribution: dict[str, int] = {}
    router_name: str = ""
    duration: int = 0
    num_nodes: int = 0


class SimulationEvent(BaseModel):
    """A single simulation event (streamed via WebSocket).

    Attributes:
        type: Event type string.
        time: Simulation timestamp.
        node_from: Source node ID.
        node_to: Destination node ID.
        bundle_id: Bundle identifier.
        event_data: Additional event-specific data.
    """

    type: str = ""
    time: float = 0.0
    node_from: str = ""
    node_to: str = ""
    bundle_id: str = ""
    event_data: dict = {}


class HopEntry(BaseModel):
    """A single hop in a bundle's path."""

    from_node: str = ""
    to_node: str = ""
    time: float = 0.0
    transmission_time_ms: float = 0.0


class BundleDetail(BaseModel):
    """Detailed information for a single bundle (inspector panel)."""

    bundle_id: str = ""
    source: str = ""
    destination: str = ""
    creation_time: float = 0.0
    delivered: bool = False
    delivery_time: float | None = None
    expired: bool = False
    dropped: bool = False
    hop_count: int = 0
    hop_history: list[HopEntry] = []
    encrypt_time_ms: float = 0.0
    decrypt_time_ms: float | None = None
    transmission_time_ms: float = 0.0
    payload_size_bytes: int = 0
    payload_hash: str = ""
    integrity_verified: bool | None = None
    cpabe_policy: str = ""
    plaintext_preview: str = ""
    encrypted_preview: str | None = None


class NodeDetail(BaseModel):
    """Detailed information for a single node (inspector panel)."""

    node_id: str = ""
    attributes: list[str] = []
    delivered_count: int = 0
    buffer_count: int = 0
    rsa_public_key_pem: str = ""


class SimulationResult(BaseModel):
    """Response model for POST /simulate.

    Attributes:
        metrics: Simulation metrics summary.
        event_log: List of all simulation events.
        pcap_file: Path to PCAP file if capture was enabled.
        bundle_details: Per-bundle detail data for inspector panel.
        node_details: Per-node detail data for inspector panel.
    """

    metrics: MetricsResponse
    event_log: list[SimulationEvent] = []
    pcap_file: str | None = None
    bundle_details: dict[str, BundleDetail] = {}
    node_details: dict[str, NodeDetail] = {}


class ScenarioInfo(BaseModel):
    """Description of a preset scenario.

    Attributes:
        key: Scenario identifier string.
        name: Human-readable scenario name.
        description: Short description of the scenario.
    """

    key: str
    name: str
    description: str


class HealthResponse(BaseModel):
    """Response model for GET /health.

    Attributes:
        status: Service status string.
        version: API version string.
    """

    status: str = "ok"
    version: str = "0.1.0"
