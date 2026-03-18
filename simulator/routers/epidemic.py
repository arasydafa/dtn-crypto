# simulator/routers/epidemic.py — Epidemic routing algorithm for DTN.
# Purpose: Implements flood-based replication where every contact results
#          in exchanging all bundles the other node doesn't have.
# Dependencies: simulator.models, simulator.routers.base
# Usage: router = EpidemicRouter()

"""Epidemic routing algorithm — flood-based bundle replication.

Every time two nodes come into contact, they exchange all bundles that
the other node does not already have. This maximizes delivery probability
at the cost of high network resource usage.
"""

from __future__ import annotations

import copy
import logging

from simulator.models import Node, SimBundle
from simulator.routers.base import BaseRouter

logger = logging.getLogger(__name__)


class EpidemicRouter(BaseRouter):
    """Epidemic (flooding) router for DTN.

    On every contact, each node copies all of its non-delivered, non-expired
    bundles to the other node, skipping bundles the peer already has.

    This is the simplest DTN routing algorithm. It provides the highest
    delivery ratio but also the highest overhead.
    """

    name = "epidemic"

    def on_contact(
        self,
        node_a: Node,
        node_b: Node,
        current_time: float,
    ) -> list[tuple[str, str, SimBundle]]:
        """Exchange all bundles between two nodes.

        Args:
            node_a: First node in the contact.
            node_b: Second node in the contact.
            current_time: Current simulation time.

        Returns:
            List of bundle transfers (from_id, to_id, bundle_copy).
        """
        transfers: list[tuple[str, str, SimBundle]] = []

        # Node A -> Node B: copy all bundles B doesn't have
        for bundle in node_a.get_bundles_for_transfer():
            if bundle.is_expired(current_time):
                continue
            if not node_b.has_bundle(bundle.bundle_id) and node_b.buffer_has_space():
                bundle_copy = copy.copy(bundle)
                bundle_copy.hop_count += 1
                transfers.append((node_a.node_id, node_b.node_id, bundle_copy))

        # Node B -> Node A: copy all bundles A doesn't have
        for bundle in node_b.get_bundles_for_transfer():
            if bundle.is_expired(current_time):
                continue
            if not node_a.has_bundle(bundle.bundle_id) and node_a.buffer_has_space():
                bundle_copy = copy.copy(bundle)
                bundle_copy.hop_count += 1
                transfers.append((node_b.node_id, node_a.node_id, bundle_copy))

        return transfers
