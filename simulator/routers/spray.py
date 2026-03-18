# simulator/routers/spray.py — Spray-and-Wait routing algorithm for DTN.
# Purpose: Implements controlled replication with L token copies using
#          binary mode (split tokens on forward).
# Dependencies: simulator.models, simulator.routers.base
# Usage: router = SprayAndWaitRouter(num_copies=6)

"""Spray-and-Wait routing algorithm — controlled replication with binary spray.

The source generates L copies (tokens) of each bundle. In binary spray mode,
when a node with n>1 tokens meets another node that has no copy, it hands
over floor(n/2) tokens and keeps ceil(n/2). When a node has only 1 token
left, it enters "wait" mode and only delivers directly to the destination.

This provides a good balance between delivery ratio and overhead.
"""

from __future__ import annotations

import copy
import logging

from simulator.models import Node, SimBundle
from simulator.routers.base import BaseRouter

logger = logging.getLogger(__name__)


class SprayAndWaitRouter(BaseRouter):
    """Spray-and-Wait router with binary spray mode.

    Args:
        num_copies: Number of initial token copies L per bundle (default 6).
    """

    name = "spray"

    def __init__(self, num_copies: int = 6) -> None:
        """Initialize Spray-and-Wait router.

        Args:
            num_copies: Number of initial copies (L) for each new bundle.
        """
        self.num_copies = num_copies

    def on_contact(
        self,
        node_a: Node,
        node_b: Node,
        current_time: float,
    ) -> list[tuple[str, str, SimBundle]]:
        """Handle contact: spray tokens using binary mode.

        Binary spray: if a node has n>1 tokens, it gives floor(n/2) to the
        peer and keeps ceil(n/2). With 1 token, only direct delivery.

        Args:
            node_a: First node in the contact.
            node_b: Second node in the contact.
            current_time: Current simulation time.

        Returns:
            List of bundle transfers.
        """
        transfers: list[tuple[str, str, SimBundle]] = []

        # Process A -> B transfers
        transfers.extend(
            self._spray_bundles(node_a, node_b, current_time)
        )

        # Process B -> A transfers
        transfers.extend(
            self._spray_bundles(node_b, node_a, current_time)
        )

        return transfers

    def _spray_bundles(
        self,
        sender: Node,
        receiver: Node,
        current_time: float,
    ) -> list[tuple[str, str, SimBundle]]:
        """Attempt to spray bundles from sender to receiver.

        Args:
            sender: Node sending bundles.
            receiver: Node receiving bundles.
            current_time: Current simulation time.

        Returns:
            List of bundle transfers from sender to receiver.
        """
        transfers: list[tuple[str, str, SimBundle]] = []

        for bundle in sender.get_bundles_for_transfer():
            if bundle.is_expired(current_time):
                continue

            # Direct delivery: always forward to destination
            if bundle.destination == receiver.node_id:
                if not receiver.has_bundle(bundle.bundle_id) and receiver.buffer_has_space():
                    bundle_copy = copy.copy(bundle)
                    bundle_copy.hop_count += 1
                    bundle_copy.spray_tokens = 1
                    transfers.append(
                        (sender.node_id, receiver.node_id, bundle_copy))
                continue

            # Binary spray: only forward if we have >1 tokens
            if bundle.spray_tokens <= 1:
                # Wait phase: only direct delivery (handled above)
                continue

            if receiver.has_bundle(bundle.bundle_id):
                continue
            if not receiver.buffer_has_space():
                continue

            # Split tokens: give floor(n/2) to receiver, keep ceil(n/2)
            tokens_to_give = bundle.spray_tokens // 2
            bundle.spray_tokens = bundle.spray_tokens - tokens_to_give

            bundle_copy = copy.copy(bundle)
            bundle_copy.hop_count += 1
            bundle_copy.spray_tokens = tokens_to_give
            transfers.append((sender.node_id, receiver.node_id, bundle_copy))

        return transfers

    def init_bundle_tokens(self, bundle: SimBundle) -> None:
        """Initialize spray tokens on a newly created bundle.

        Args:
            bundle: The bundle to initialize tokens on.
        """
        bundle.spray_tokens = self.num_copies
