# simulator/engine.py — Discrete event simulation engine for DTN.
# Purpose: Implements the core simulation loop using a priority queue (heapq).
#          Manages contact events, bundle creation, delivery, expiration, and
#          routing algorithm dispatch. Supports event callbacks for WebSocket
#          streaming and PCAP capture for Wireshark analysis.
# Dependencies: heapq, simulator.models, simulator.routers, simulator.crypto_layer,
#               simulator.metrics, simulator.scenarios, simulator.pcap_logger
# Usage: engine = SimulationEngine(config); engine.run()

"""Discrete-event simulation engine for DTN networks.

Uses a priority queue (heapq) to process events in chronological order.
Integrates routing algorithms, cryptographic operations, metric collection,
optional PCAP bundle protocol capture, and real-time event streaming.
"""

from __future__ import annotations

import heapq
import logging
import os
import random
import time as wallclock
from collections.abc import Callable
from typing import Any

from simulator.crypto_layer import CryptoLayer
from simulator.metrics import MetricsCollector, SimulationMetrics
from simulator.models import EventType, Node, SimBundle, SimEvent
from simulator.pcap_logger import PcapBundleLogger
from simulator.routers.base import BaseRouter
from simulator.routers.epidemic import EpidemicRouter
from simulator.routers.prophet import PRoPHETRouter
from simulator.routers.spray import SprayAndWaitRouter
from simulator.scenarios import (
    assign_node_attributes,
    generate_contact_schedule,
    get_scenario_config,
)

logger = logging.getLogger(__name__)


def create_router(router_name: str) -> BaseRouter:
    """Create a routing algorithm instance by name.

    Args:
        router_name: One of "epidemic", "prophet", "spray".

    Returns:
        A BaseRouter subclass instance.

    Raises:
        ValueError: If the router name is not recognized.
    """
    routers: dict[str, type[BaseRouter]] = {
        "epidemic": EpidemicRouter,
        "prophet": PRoPHETRouter,
        "spray": SprayAndWaitRouter,
    }
    if router_name not in routers:
        raise ValueError(
            f"Unknown router: '{router_name}'. Available: {', '.join(routers.keys())}"
        )
    return routers[router_name]()


class SimulationEngine:
    """Discrete-event simulation engine for DTN networks.

    Manages the simulation lifecycle: node initialization, event scheduling,
    routing algorithm dispatch, crypto operations, metric collection,
    optional PCAP capture, and real-time event streaming via callbacks.

    Args:
        router: The routing algorithm to use.
        num_nodes: Number of nodes in the network.
        duration: Simulation duration in seconds.
        scenario: Scenario name for configuration.
        seed: Random seed for reproducibility.
        message_rate: Messages per minute generation rate.
        config: Optional custom configuration dict (overrides scenario).
        output_path: Directory for results output.
        event_callback: Optional callback for live event streaming.
        enable_pcap: If True, write BPv7 frames to a PCAP file.
        live_udp: If True, also send live UDP packets on localhost.
    """

    def __init__(
        self,
        router: BaseRouter,
        num_nodes: int = 10,
        duration: int = 3600,
        scenario: str = "disaster",
        seed: int = 42,
        message_rate: float = 1.0,
        config: dict[str, Any] | None = None,
        output_path: str = "./results/",
        event_callback: Callable[[dict[str, Any]], None] | None = None,
        enable_pcap: bool = False,
        live_udp: bool = False,
        custom_payload: bytes | None = None,
    ) -> None:
        """Initialize the simulation engine.

        Args:
            router: Routing algorithm instance.
            num_nodes: Number of network nodes.
            duration: Simulation duration in seconds.
            scenario: Scenario name.
            seed: Random seed.
            message_rate: Messages per minute.
            config: Optional custom config dict.
            output_path: Results output directory.
            event_callback: Optional callback invoked on every event for live
                streaming (e.g., to a WebSocket). Receives an event dict.
            enable_pcap: If True, write BPv7 bundle frames to a PCAP file.
            live_udp: If True and enable_pcap is True, also send live UDP
                packets on localhost for real-time Wireshark capture.
        """
        self.router = router
        self.seed = seed
        self.output_path = output_path
        self._rng = random.Random(seed)
        self._event_callback = event_callback
        self._enable_pcap = enable_pcap
        self._live_udp = live_udp
        self._custom_payload = custom_payload

        # Load scenario config
        if config is not None:
            self._config = config
        else:
            self._config = get_scenario_config(
                scenario, num_nodes, duration, seed, message_rate
            )

        self._params = self._config["params"]
        self.num_nodes: int = self._params["num_nodes"]
        self.duration: int = self._params["duration"]
        self.message_rate: float = self._params["message_rate"]

        # Simulation state
        self.current_time: float = 0.0
        self.nodes: dict[str, Node] = {}
        self._event_queue: list[SimEvent] = []
        self._active_contacts: set[tuple[str, str]] = set()
        self._all_bundles: dict[str, SimBundle] = {}

        # Subsystems
        self._crypto: CryptoLayer | None = None
        self._pcap: PcapBundleLogger | None = None
        self._metrics: MetricsCollector = MetricsCollector(
            router_name=router.name,
            duration=self.duration,
            num_nodes=self.num_nodes,
        )

    def _emit_event(self, event_dict: dict[str, Any]) -> None:
        """Emit an event to the callback if one is registered.

        Args:
            event_dict: The event data dictionary.
        """
        if self._event_callback is not None:
            try:
                self._event_callback(event_dict)
            except Exception:
                logger.warning("Event callback failed", exc_info=True)

    def _log_progress(self, message: str) -> None:
        """Log a progress message with timestamp.

        Args:
            message: The message to log.
        """
        sim_pct = (self.current_time / self.duration *
                   100) if self.duration > 0 else 0
        print(
            f"[t={self.current_time:>8.1f}s / {self.duration}s ({sim_pct:5.1f}%)] {message}",
            flush=True,
        )

    def _init_nodes(self) -> None:
        """Initialize all network nodes with keys and attributes."""
        scenario_attrs = self._config.get("node_attributes", {})
        if not scenario_attrs:
            scenario_attrs = {"default": ["role:node", "role:receiver"]}

        attr_assignments = assign_node_attributes(
            self.num_nodes, scenario_attrs, self.seed
        )

        self._crypto = CryptoLayer(attribute_assignments=attr_assignments)

        for i in range(self.num_nodes):
            node_id = f"node-{i}"
            attrs = attr_assignments.get(
                node_id, ["role:node", "role:receiver"])
            node = Node(
                node_id=node_id,
                attributes=attrs,
                buffer_size=self._params.get("buffer_size", 100),
            )
            self._crypto.setup_node_keys(node)
            self.router.on_node_join(node)
            self.nodes[node_id] = node

        self._log_progress(f"Initialized {self.num_nodes} nodes")

    def _init_pcap(self) -> None:
        """Initialize PCAP logger if enabled."""
        if self._enable_pcap:
            os.makedirs(self.output_path, exist_ok=True)
            pcap_path = os.path.join(
                self.output_path, f"bundles_{self.router.name}.pcap"
            )
            self._pcap = PcapBundleLogger(
                pcap_path=pcap_path,
                live_udp=self._live_udp,
            )
            self._log_progress(f"PCAP capture enabled -> {pcap_path}")

    def _schedule_contacts(self) -> None:
        """Generate and schedule all contact events."""
        contacts = generate_contact_schedule(
            num_nodes=self.num_nodes,
            duration=self.duration,
            contact_probability=self._params.get("contact_probability", 0.15),
            min_contact_duration=self._params.get("min_contact_duration", 20),
            max_contact_duration=self._params.get("max_contact_duration", 120),
            contact_interval_mean=self._params.get(
                "contact_interval_mean", 200),
            seed=self.seed,
        )

        for contact in contacts:
            heapq.heappush(
                self._event_queue,
                SimEvent(
                    time=contact.time,
                    event_type=EventType.CONTACT_START,
                    data={
                        "node_a": contact.node_a,
                        "node_b": contact.node_b,
                        "duration": contact.duration,
                    },
                ),
            )
            heapq.heappush(
                self._event_queue,
                SimEvent(
                    time=contact.time + contact.duration,
                    event_type=EventType.CONTACT_END,
                    data={
                        "node_a": contact.node_a,
                        "node_b": contact.node_b,
                    },
                ),
            )

        self._log_progress(f"Scheduled {len(contacts)} contact events")

    def _schedule_bundle_creations(self) -> None:
        """Schedule bundle creation events based on message rate."""
        if self.message_rate <= 0:
            return

        interval = 60.0 / self.message_rate
        t = self._rng.expovariate(1.0 / interval)
        node_ids = list(self.nodes.keys())

        count = 0
        while t < self.duration:
            source = self._rng.choice(node_ids)
            dest = self._rng.choice([n for n in node_ids if n != source])
            heapq.heappush(
                self._event_queue,
                SimEvent(
                    time=t,
                    event_type=EventType.BUNDLE_CREATE,
                    data={"source": source, "destination": dest},
                ),
            )
            count += 1
            t += self._rng.expovariate(1.0 / interval)

        self._log_progress(f"Scheduled {count} bundle creation events")

    def _handle_contact_start(self, event: SimEvent) -> None:
        """Handle a CONTACT_START event."""
        node_a_id = event.data["node_a"]
        node_b_id = event.data["node_b"]

        node_a = self.nodes.get(node_a_id)
        node_b = self.nodes.get(node_b_id)
        if node_a is None or node_b is None:
            return

        contact_key = (min(node_a_id, node_b_id), max(node_a_id, node_b_id))
        self._active_contacts.add(contact_key)

        evt = {
            "type": "CONTACT_START",
            "time": round(self.current_time, 3),
            "node_from": node_a_id,
            "node_to": node_b_id,
            "bundle_id": "",
            "event_data": {"duration": event.data.get("duration", 0)},
        }
        self._metrics.log_event(
            "CONTACT_START", self.current_time,
            node_from=node_a_id, node_to=node_b_id,
            event_data={"duration": event.data.get("duration", 0)},
        )
        self._emit_event(evt)

        # Run routing algorithm
        transfers = self.router.on_contact(node_a, node_b, self.current_time)

        for from_id, to_id, bundle in transfers:
            receiver = self.nodes.get(to_id)
            if receiver is None:
                continue

            if receiver.add_bundle(bundle):
                self._metrics.record_transfer()

                # Compute simulated transmission time
                bandwidth_bps = self._params.get("link_bandwidth_bps", 100_000)
                if bandwidth_bps > 0 and bundle.payload_size_bytes > 0:
                    tx_ms = (bundle.payload_size_bytes *
                             8 / bandwidth_bps) * 1000
                else:
                    tx_ms = 0.0
                bundle.transmission_time_ms += tx_ms

                # Track hop history (detach list to avoid shallow-copy mutation)
                bundle.hop_history = list(bundle.hop_history)
                bundle.hop_history.append({
                    "from_node": from_id,
                    "to_node": to_id,
                    "time": round(self.current_time, 3),
                    "transmission_time_ms": round(tx_ms, 3),
                })

                transfer_evt = {
                    "type": "BUNDLE_TRANSFER",
                    "time": round(self.current_time, 3),
                    "node_from": from_id,
                    "node_to": to_id,
                    "bundle_id": bundle.bundle_id,
                    "event_data": {"transmission_time_ms": round(tx_ms, 3)},
                }
                self._metrics.log_event(
                    "BUNDLE_TRANSFER", self.current_time,
                    node_from=from_id, node_to=to_id,
                    bundle_id=bundle.bundle_id,
                    event_data={"transmission_time_ms": round(tx_ms, 3)},
                )
                self._emit_event(transfer_evt)

                # PCAP: log bundle transfer
                if self._pcap is not None:
                    self._pcap.log_bundle_transfer(
                        from_node=from_id,
                        to_node=to_id,
                        bundle_payload=bundle.payload or b"<encrypted>",
                        sim_time=self.current_time,
                        bundle_id=bundle.bundle_id,
                        source=bundle.source,
                        destination=bundle.destination,
                        creation_time=bundle.creation_time,
                        ttl=bundle.ttl,
                    )

                if to_id == bundle.destination:
                    self._handle_delivery(bundle, receiver)

    def _handle_contact_end(self, event: SimEvent) -> None:
        """Handle a CONTACT_END event."""
        node_a_id = event.data["node_a"]
        node_b_id = event.data["node_b"]
        contact_key = (min(node_a_id, node_b_id), max(node_a_id, node_b_id))
        self._active_contacts.discard(contact_key)

        evt = {
            "type": "CONTACT_END",
            "time": round(self.current_time, 3),
            "node_from": node_a_id,
            "node_to": node_b_id,
            "bundle_id": "",
            "event_data": {},
        }
        self._metrics.log_event(
            "CONTACT_END", self.current_time,
            node_from=node_a_id, node_to=node_b_id,
        )
        self._emit_event(evt)

    def _handle_bundle_create(self, event: SimEvent) -> None:
        """Handle a BUNDLE_CREATE event."""
        source_id = event.data["source"]
        dest_id = event.data["destination"]

        source_node = self.nodes.get(source_id)
        dest_node = self.nodes.get(dest_id)
        if source_node is None or dest_node is None:
            return

        default_policy = self._config.get(
            "default_policy", "role:receiver OR role:node")

        if self._custom_payload is not None:
            payload = self._custom_payload
        else:
            payload = f"DTN-MSG from {source_id} to {dest_id} at t={self.current_time:.1f}".encode()
        bundle = SimBundle(
            source=source_id,
            destination=dest_id,
            creation_time=self.current_time,
            ttl=self._params.get("bundle_ttl", 3600),
            priority=1,
            payload=payload,
            max_hop_count=self._params.get("max_hop_count", 32),
            cpabe_policy=default_policy,
        )

        if isinstance(self.router, SprayAndWaitRouter):
            self.router.init_bundle_tokens(bundle)

        if self._crypto is not None:
            self._crypto.encrypt_bundle(bundle, dest_node)

        # Compute payload size for transmission time calculation
        if bundle.encrypted_payload is not None:
            import json as _json
            bundle.payload_size_bytes = len(
                _json.dumps(bundle.encrypted_payload))
        else:
            bundle.payload_size_bytes = len(bundle.payload)

        if not source_node.add_bundle(bundle):
            bundle.dropped = True
            self._metrics.log_event(
                "BUNDLE_DROPPED", self.current_time,
                node_from=source_id, bundle_id=bundle.bundle_id,
                event_data={"reason": "buffer_full"},
            )

        self._all_bundles[bundle.bundle_id] = bundle
        self._metrics.register_bundle(bundle)

        # Build content previews for inspector
        plaintext_preview = bundle.payload.decode(
            "utf-8", errors="replace")[:120] if bundle.payload else ""
        encrypted_preview = None
        if bundle.encrypted_payload is not None:
            import json as _ejson
            encrypted_preview = _ejson.dumps(bundle.encrypted_payload)[:80]

        create_evt = {
            "type": "BUNDLE_CREATE",
            "time": round(self.current_time, 3),
            "node_from": source_id,
            "node_to": dest_id,
            "bundle_id": bundle.bundle_id,
            "event_data": {
                "encrypt_time_ms": round(bundle.encrypt_time_ms, 3),
                "payload_size_bytes": bundle.payload_size_bytes,
                "plaintext_preview": plaintext_preview,
                "encrypted_preview": encrypted_preview,
                "payload_hash": bundle.payload_hash,
                "cpabe_policy": bundle.cpabe_policy,
            },
        }
        self._metrics.log_event(
            "BUNDLE_CREATE", self.current_time,
            node_from=source_id, node_to=dest_id,
            bundle_id=bundle.bundle_id,
        )
        self._emit_event(create_evt)

        # PCAP: log bundle creation
        if self._pcap is not None:
            self._pcap.log_bundle_creation(
                source=source_id,
                destination=dest_id,
                bundle_payload=payload,
                sim_time=self.current_time,
                bundle_id=bundle.bundle_id,
                ttl=bundle.ttl,
            )

        expire_time = self.current_time + bundle.ttl
        if expire_time <= self.duration:
            heapq.heappush(
                self._event_queue,
                SimEvent(
                    time=expire_time,
                    event_type=EventType.BUNDLE_EXPIRE,
                    data={"bundle_id": bundle.bundle_id},
                ),
            )

    def _handle_delivery(self, bundle: SimBundle, dest_node: Node) -> None:
        """Handle bundle delivery at the destination."""
        if bundle.delivered:
            return

        if self._crypto is not None and bundle.encrypted_payload is not None:
            plaintext = self._crypto.decrypt_bundle(bundle, dest_node)
            if plaintext is None:
                # Distinguish integrity failure from policy mismatch
                if bundle.integrity_verified is False:
                    reason = "integrity_fail"
                    event_type = "INTEGRITY_FAIL"
                else:
                    reason = "policy_mismatch"
                    event_type = "DECRYPT_FAIL"
                self._metrics.log_event(
                    event_type, self.current_time,
                    node_to=dest_node.node_id, bundle_id=bundle.bundle_id,
                    event_data={"reason": reason},
                )
                self._emit_event({
                    "type": event_type,
                    "time": round(self.current_time, 3),
                    "node_from": "", "node_to": dest_node.node_id,
                    "bundle_id": bundle.bundle_id,
                    "event_data": {"reason": reason},
                })
                return

        bundle.delivered = True
        bundle.delivery_time = self.current_time
        dest_node.delivered_count += 1

        master = self._all_bundles.get(bundle.bundle_id)
        if master is not None and not master.delivered:
            master.delivered = True
            master.delivery_time = self.current_time
            master.decrypt_time_ms = bundle.decrypt_time_ms
            master.hop_count = bundle.hop_count
            master.transmission_time_ms = bundle.transmission_time_ms
            master.integrity_verified = bundle.integrity_verified
            master.hop_history = list(bundle.hop_history)

        latency = round(self.current_time - bundle.creation_time, 3)
        deliver_evt = {
            "type": "BUNDLE_DELIVER",
            "time": round(self.current_time, 3),
            "node_from": bundle.source,
            "node_to": dest_node.node_id,
            "bundle_id": bundle.bundle_id,
            "event_data": {
                "latency": latency,
                "hops": bundle.hop_count,
                "encrypt_time_ms": round(bundle.encrypt_time_ms, 3),
                "decrypt_time_ms": round(bundle.decrypt_time_ms, 3) if bundle.decrypt_time_ms is not None else 0,
                "transmission_time_ms": round(bundle.transmission_time_ms, 3),
                "integrity_verified": bundle.integrity_verified,
                "payload_hash": bundle.payload_hash,
            },
        }
        self._metrics.log_event(
            "BUNDLE_DELIVER", self.current_time,
            node_to=dest_node.node_id, bundle_id=bundle.bundle_id,
            event_data={"latency": latency, "hops": bundle.hop_count},
        )
        self._emit_event(deliver_evt)

        # PCAP: log bundle delivery
        if self._pcap is not None:
            self._pcap.log_bundle_delivery(
                from_node=bundle.source,
                to_node=dest_node.node_id,
                bundle_payload=bundle.payload or b"<delivered>",
                sim_time=self.current_time,
                bundle_id=bundle.bundle_id,
                source=bundle.source,
                destination=bundle.destination,
                ttl=bundle.ttl,
            )

    def _handle_bundle_expire(self, event: SimEvent) -> None:
        """Handle a BUNDLE_EXPIRE event."""
        bundle_id = event.data["bundle_id"]
        bundle = self._all_bundles.get(bundle_id)
        if bundle is None or bundle.delivered or bundle.expired:
            return

        bundle.expired = True

        expire_evt = {
            "type": "BUNDLE_EXPIRE",
            "time": round(self.current_time, 3),
            "node_from": "", "node_to": "",
            "bundle_id": bundle_id,
            "event_data": {},
        }
        self._metrics.log_event(
            "BUNDLE_EXPIRE", self.current_time, bundle_id=bundle_id)
        self._emit_event(expire_evt)

    def run(self) -> SimulationMetrics:
        """Run the complete simulation.

        Returns:
            Computed simulation metrics.
        """
        wall_start = wallclock.perf_counter()

        print(f"\n{'='*60}")
        print(f"DTN Crypto Simulator -- {self.router.name.upper()} Router")
        print(
            f"Nodes: {self.num_nodes} | Duration: {self.duration}s | Seed: {self.seed}")
        print(f"Scenario: {self._config.get('name', 'custom')}")
        print(f"{'='*60}\n")

        # Initialize
        self._init_nodes()
        self._init_pcap()
        self._schedule_contacts()
        self._schedule_bundle_creations()

        total_events = len(self._event_queue)
        processed = 0
        last_progress = -1

        self._log_progress(f"Starting simulation with {total_events} events")

        # Main event loop
        while self._event_queue:
            event = heapq.heappop(self._event_queue)

            if event.time > self.duration:
                break

            self.current_time = event.time
            processed += 1

            pct = int(self.current_time / self.duration *
                      10) if self.duration > 0 else 10
            if pct > last_progress:
                last_progress = pct
                self._log_progress(
                    f"Processed {processed}/{total_events} events, "
                    f"{len(self._all_bundles)} bundles created"
                )

            if event.event_type == EventType.CONTACT_START:
                self._handle_contact_start(event)
            elif event.event_type == EventType.CONTACT_END:
                self._handle_contact_end(event)
            elif event.event_type == EventType.BUNDLE_CREATE:
                self._handle_bundle_create(event)
            elif event.event_type == EventType.BUNDLE_EXPIRE:
                self._handle_bundle_expire(event)

        # Mark remaining undelivered bundles
        for bundle in self._all_bundles.values():
            if not bundle.delivered and not bundle.expired and not bundle.dropped:
                if bundle.is_expired(self.duration):
                    bundle.expired = True

        # Close PCAP logger
        if self._pcap is not None:
            self._pcap.close()
            self._log_progress(
                f"PCAP capture saved: {self._pcap.packet_count} packets -> "
                f"{self._pcap.pcap_path}"
            )

        # Compute and export metrics
        metrics = self._metrics.compute_metrics()
        wall_elapsed = wallclock.perf_counter() - wall_start

        print(f"\n{'='*60}")
        print(f"Simulation Complete -- {self.router.name.upper()}")
        print(f"{'='*60}")
        print(f"  Wall-clock time:    {wall_elapsed:.2f}s")
        print(f"  Events processed:   {processed}")
        print(f"  Bundles created:    {metrics.total_bundles}")
        print(f"  Bundles delivered:  {metrics.delivered_bundles}")
        print(f"  Delivery ratio:     {metrics.delivery_ratio:.2%}")
        print(f"  Avg latency:        {metrics.avg_latency_seconds:.1f}s")
        print(f"  Bundle drop rate:   {metrics.bundle_drop_rate:.2%}")
        print(f"  Avg encrypt time:   {metrics.avg_encrypt_overhead_ms:.2f}ms")
        print(f"  Avg decrypt time:   {metrics.avg_decrypt_overhead_ms:.2f}ms")
        print(
            f"  Avg transmit time:  {metrics.avg_transmission_time_ms:.2f}ms")
        print(f"  Integrity failures: {metrics.integrity_failures}")
        print(f"  Total transfers:    {metrics.total_transfers}")
        if metrics.hop_count_distribution:
            print(
                f"  Hop distribution:   {dict(sorted(metrics.hop_count_distribution.items()))}"
            )
        print(f"{'='*60}\n")

        # Export results
        self._metrics.export_json(self.output_path, metrics)
        self._metrics.export_csv(self.output_path, metrics)

        # Emit completion event
        self._emit_event({
            "type": "SIMULATION_COMPLETE",
            "time": round(self.current_time, 3),
            "node_from": "", "node_to": "",
            "bundle_id": "",
            "event_data": {
                "total_bundles": metrics.total_bundles,
                "delivered": metrics.delivered_bundles,
                "delivery_ratio": round(metrics.delivery_ratio, 4),
                "avg_latency": round(metrics.avg_latency_seconds, 3),
            },
        })

        return metrics

    def get_event_log(self) -> list[dict[str, Any]]:
        """Get the simulation event log.

        Returns:
            List of event dictionaries.
        """
        return self._metrics.get_event_log()

    def get_bundle_details(self) -> dict[str, dict[str, Any]]:
        """Get detailed information for all bundles (for inspector panel).

        Returns:
            Dict mapping bundle_id to detail dict.
        """
        import json as _bjson
        details: dict[str, dict[str, Any]] = {}
        for bid, b in self._all_bundles.items():
            plaintext_preview = b.payload.decode(
                "utf-8", errors="replace")[:120] if b.payload else ""
            encrypted_preview = None
            if b.encrypted_payload is not None:
                encrypted_preview = _bjson.dumps(b.encrypted_payload)[:80]
            details[bid] = {
                "bundle_id": b.bundle_id,
                "source": b.source,
                "destination": b.destination,
                "creation_time": round(b.creation_time, 3),
                "delivered": b.delivered,
                "delivery_time": round(b.delivery_time, 3) if b.delivery_time is not None else None,
                "expired": b.expired,
                "dropped": b.dropped,
                "hop_count": b.hop_count,
                "hop_history": b.hop_history,
                "encrypt_time_ms": round(b.encrypt_time_ms, 3),
                "decrypt_time_ms": round(b.decrypt_time_ms, 3) if b.decrypt_time_ms is not None else None,
                "transmission_time_ms": round(b.transmission_time_ms, 3),
                "payload_size_bytes": b.payload_size_bytes,
                "payload_hash": b.payload_hash,
                "integrity_verified": b.integrity_verified,
                "cpabe_policy": b.cpabe_policy,
                "plaintext_preview": plaintext_preview,
                "encrypted_preview": encrypted_preview,
            }
        return details

    def get_node_details(self) -> dict[str, dict[str, Any]]:
        """Get detailed information for all nodes (for inspector panel).

        Returns:
            Dict mapping node_id to detail dict.
        """
        from dtn_crypto.utils import serialize_public_key
        details: dict[str, dict[str, Any]] = {}
        for nid, node in self.nodes.items():
            pem_preview = ""
            if node.rsa_public_key is not None:
                try:
                    pem_bytes = serialize_public_key(node.rsa_public_key)
                    pem_lines = pem_bytes.decode("utf-8").strip().splitlines()
                    pem_preview = "\n".join(pem_lines[:4])
                    if len(pem_lines) > 4:
                        pem_preview += "\n..."
                except Exception:
                    pem_preview = "<unavailable>"
            details[nid] = {
                "node_id": nid,
                "attributes": list(node.attributes),
                "delivered_count": node.delivered_count,
                "buffer_count": len(node.buffer),
                "rsa_public_key_pem": pem_preview,
            }
        return details
