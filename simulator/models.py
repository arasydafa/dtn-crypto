# simulator/models.py — Core data models for the DTN simulator.
# Purpose: Defines Node, SimBundle, ContactEvent, and EventType used by the
#          simulation engine and routing algorithms.
# Dependencies: dtn_crypto
# Usage: from simulator.models import Node, SimBundle, ContactEvent

"""Core data models for the DTN network simulator.

Provides Node, SimBundle (simulation-level bundle wrapper), ContactEvent,
and the EventType enum used by the discrete-event simulation engine.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any


class EventType(Enum):
    """Types of events in the discrete-event simulation.

    Attributes:
        CONTACT_START: Two nodes come into communication range.
        CONTACT_END: Two nodes leave communication range.
        BUNDLE_CREATE: A new bundle is generated.
        BUNDLE_DELIVER: A bundle reaches its destination.
        BUNDLE_EXPIRE: A bundle's TTL has expired.
    """

    CONTACT_START = auto()
    CONTACT_END = auto()
    BUNDLE_CREATE = auto()
    BUNDLE_DELIVER = auto()
    BUNDLE_EXPIRE = auto()


@dataclass
class ContactEvent:
    """Represents a scheduled contact between two nodes.

    Attributes:
        time: Simulation time when the contact starts (seconds).
        node_a: Identifier of the first node.
        node_b: Identifier of the second node.
        duration: Duration of the contact in seconds.
    """

    time: float
    node_a: str
    node_b: str
    duration: float

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "time": self.time,
            "node_a": self.node_a,
            "node_b": self.node_b,
            "duration": self.duration,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ContactEvent:
        """Deserialize from dictionary."""
        return cls(
            time=float(data["time"]),
            node_a=str(data["node_a"]),
            node_b=str(data["node_b"]),
            duration=float(data["duration"]),
        )


@dataclass
class SimBundle:
    """Simulation-level bundle with routing metadata.

    Wraps the cryptographic SecureBundle with simulation-specific fields
    needed by routing algorithms and the simulation engine.

    Attributes:
        bundle_id: Unique identifier for this bundle.
        source: Source node identifier.
        destination: Destination node identifier.
        creation_time: Simulation time when bundle was created (seconds).
        ttl: Time-to-live in simulation seconds.
        priority: Priority level (0=bulk, 1=normal, 2=expedited, 3=critical).
        payload: Raw plaintext payload bytes (pre-encryption).
        encrypted_payload: Encrypted payload dict (post-encryption), or None.
        hop_count: Number of hops traversed.
        max_hop_count: Maximum allowed hops.
        delivered: Whether this bundle has been delivered.
        expired: Whether this bundle has expired.
        dropped: Whether this bundle was dropped (hop limit, buffer full).
        delivery_time: Simulation time when delivered, or None.
        encrypt_time_ms: Time taken to encrypt in milliseconds.
        decrypt_time_ms: Time taken to decrypt in milliseconds, or None.
        spray_tokens: Token count for Spray-and-Wait routing.
        cpabe_policy: CP-ABE policy string for this bundle.
    """

    bundle_id: str = ""
    source: str = ""
    destination: str = ""
    creation_time: float = 0.0
    ttl: int = 3600
    priority: int = 1
    payload: bytes = b""
    encrypted_payload: dict[str, str] | None = None
    hop_count: int = 0
    max_hop_count: int = 32
    delivered: bool = False
    expired: bool = False
    dropped: bool = False
    delivery_time: float | None = None
    encrypt_time_ms: float = 0.0
    decrypt_time_ms: float | None = None
    spray_tokens: int = 0
    cpabe_policy: str = ""

    def __post_init__(self) -> None:
        """Generate bundle_id if not provided."""
        if not self.bundle_id:
            self.bundle_id = str(uuid.uuid4())[:8]

    def is_expired(self, current_time: float) -> bool:
        """Check if this bundle has expired.

        Args:
            current_time: Current simulation time in seconds.

        Returns:
            True if the bundle TTL has been exceeded.
        """
        return (current_time - self.creation_time) > self.ttl

    def is_hop_limited(self) -> bool:
        """Check if this bundle has exceeded its hop limit.

        Returns:
            True if hop_count exceeds max_hop_count.
        """
        return self.hop_count > self.max_hop_count

    def latency(self) -> float | None:
        """Calculate delivery latency.

        Returns:
            Latency in seconds if delivered, None otherwise.
        """
        if self.delivery_time is not None:
            return self.delivery_time - self.creation_time
        return None


@dataclass
class SimEvent:
    """A simulation event for the priority queue.

    Attributes:
        time: Simulation time when the event occurs.
        event_type: Type of the event.
        data: Event-specific data dictionary.
    """

    time: float
    event_type: EventType
    data: dict[str, Any] = field(default_factory=dict)

    def __lt__(self, other: SimEvent) -> bool:
        """Compare events by time for priority queue ordering."""
        return self.time < other.time

    def __le__(self, other: SimEvent) -> bool:
        """Compare events by time for priority queue ordering."""
        return self.time <= other.time


@dataclass
class Node:
    """Represents a node in the DTN network.

    Attributes:
        node_id: Unique identifier for this node.
        attributes: CP-ABE attribute strings for policy-based access.
        buffer: Message buffer holding bundles awaiting forwarding.
        buffer_size: Maximum number of bundles the buffer can hold.
        routing_table: Router-specific state (e.g., delivery predictabilities).
        contact_schedule: List of scheduled contacts for this node.
        delivered_count: Number of bundles successfully delivered to this node.
        rsa_private_key: RSA private key for this node (set by crypto layer).
        rsa_public_key: RSA public key for this node (set by crypto layer).
        cpabe_user_key: CP-ABE user key for this node (set by crypto layer).
    """

    node_id: str = ""
    attributes: list[str] = field(default_factory=list)
    buffer: list[SimBundle] = field(default_factory=list)
    buffer_size: int = 100
    routing_table: dict[str, Any] = field(default_factory=dict)
    contact_schedule: list[ContactEvent] = field(default_factory=list)
    delivered_count: int = 0
    rsa_private_key: Any = None
    rsa_public_key: Any = None
    cpabe_user_key: Any = None

    def buffer_has_space(self) -> bool:
        """Check if the node's buffer has room for another bundle.

        Returns:
            True if buffer is not full.
        """
        return len(self.buffer) < self.buffer_size

    def has_bundle(self, bundle_id: str) -> bool:
        """Check if a specific bundle is already in the buffer.

        Args:
            bundle_id: The bundle ID to look for.

        Returns:
            True if the bundle is in this node's buffer.
        """
        return any(b.bundle_id == bundle_id for b in self.buffer)

    def add_bundle(self, bundle: SimBundle) -> bool:
        """Add a bundle to the buffer if there is space.

        Args:
            bundle: The bundle to add.

        Returns:
            True if the bundle was added, False if buffer is full.
        """
        if not self.buffer_has_space():
            return False
        self.buffer.append(bundle)
        return True

    def remove_bundle(self, bundle_id: str) -> SimBundle | None:
        """Remove a bundle from the buffer by ID.

        Args:
            bundle_id: The bundle ID to remove.

        Returns:
            The removed bundle, or None if not found.
        """
        for i, b in enumerate(self.buffer):
            if b.bundle_id == bundle_id:
                return self.buffer.pop(i)
        return None

    def get_bundles_for_transfer(self) -> list[SimBundle]:
        """Get all bundles eligible for transfer.

        Returns:
            List of bundles that are not delivered, expired, or dropped.
        """
        return [
            b
            for b in self.buffer
            if not b.delivered and not b.expired and not b.dropped
        ]
