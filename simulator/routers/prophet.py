# simulator/routers/prophet.py — PRoPHET routing algorithm for DTN.
# Purpose: Implements Probabilistic Routing using History of Encounters and
#          Transitivity. Nodes maintain delivery predictability scores that
#          are updated on contact and age over time.
# Dependencies: simulator.models, simulator.routers.base
# Usage: router = PRoPHETRouter(p_init=0.75, gamma=0.98, beta=0.25)

"""PRoPHET routing algorithm — Probabilistic Routing using History of
Encounters and Transitivity.

Nodes maintain a delivery predictability P(a,b) for each known destination.
When two nodes meet:
1. Direct encounter update: P(a,b) = P(a,b)_old + (1 - P(a,b)_old) * p_init
2. Aging: P(a,b) = P(a,b)_old * gamma^k  (k = time units since last aging)
3. Transitivity: P(a,c) = P(a,c)_old + (1 - P(a,c)_old) * P(a,b) * P(b,c) * beta

Bundles are forwarded only to nodes with higher predictability for the
destination than the current holder.
"""

from __future__ import annotations

import copy
import logging

from simulator.models import Node, SimBundle
from simulator.routers.base import BaseRouter

logger = logging.getLogger(__name__)


class PRoPHETRouter(BaseRouter):
    """PRoPHET (Probabilistic Routing Protocol using History of Encounters
    and Transitivity) router for DTN.

    Maintains per-node delivery predictability tables and forwards bundles
    only to nodes with higher predictability for the destination.

    Args:
        p_init: Initial encounter probability increment (default 0.75).
        gamma: Aging constant per time unit, in range (0, 1] (default 0.98).
        beta: Transitivity scaling factor in range [0, 1] (default 0.25).
        aging_interval: Time interval in seconds for aging (default 30).
    """

    name = "prophet"

    def __init__(
        self,
        p_init: float = 0.75,
        gamma: float = 0.98,
        beta: float = 0.25,
        aging_interval: float = 30.0,
    ) -> None:
        """Initialize PRoPHET router.

        Args:
            p_init: Initial encounter probability increment.
            gamma: Aging constant per time unit.
            beta: Transitivity scaling factor.
            aging_interval: Time interval for aging in seconds.
        """
        self.p_init = p_init
        self.gamma = gamma
        self.beta = beta
        self.aging_interval = aging_interval

    def on_node_join(self, node: Node) -> None:
        """Initialize PRoPHET state on a new node.

        Args:
            node: The node that joined.
        """
        node.routing_table.setdefault("predictabilities", {})
        node.routing_table.setdefault("last_aging_time", 0.0)

    def _get_predictability(self, node: Node, dest_id: str) -> float:
        """Get the delivery predictability for a destination.

        Args:
            node: The node to query.
            dest_id: The destination node ID.

        Returns:
            Predictability value in [0, 1].
        """
        preds: dict[str, float] = node.routing_table.get(
            "predictabilities", {})
        return preds.get(dest_id, 0.0)

    def _set_predictability(self, node: Node, dest_id: str, value: float) -> None:
        """Set the delivery predictability for a destination.

        Args:
            node: The node to update.
            dest_id: The destination node ID.
            value: New predictability value.
        """
        preds: dict[str, float] = node.routing_table.setdefault(
            "predictabilities", {})
        preds[dest_id] = min(max(value, 0.0), 1.0)

    def _age_predictabilities(self, node: Node, current_time: float) -> None:
        """Age all predictability values based on elapsed time.

        Formula: P(a,b) = P(a,b)_old * gamma^k
        where k = number of aging intervals elapsed.

        Args:
            node: The node whose predictabilities to age.
            current_time: Current simulation time.
        """
        last_time: float = node.routing_table.get("last_aging_time", 0.0)
        elapsed = current_time - last_time
        if elapsed <= 0 or self.aging_interval <= 0:
            return

        k = elapsed / self.aging_interval
        aging_factor = self.gamma**k

        preds: dict[str, float] = node.routing_table.get(
            "predictabilities", {})
        to_remove: list[str] = []
        for dest_id, pred in preds.items():
            new_pred = pred * aging_factor
            if new_pred < 0.001:
                to_remove.append(dest_id)
            else:
                preds[dest_id] = new_pred

        for dest_id in to_remove:
            del preds[dest_id]

        node.routing_table["last_aging_time"] = current_time

    def _update_encounter(self, node: Node, encountered_id: str) -> None:
        """Update predictability for a directly encountered node.

        Formula: P(a,b) = P(a,b)_old + (1 - P(a,b)_old) * p_init

        Args:
            node: The node to update.
            encountered_id: ID of the node encountered.
        """
        p_old = self._get_predictability(node, encountered_id)
        p_new = p_old + (1 - p_old) * self.p_init
        self._set_predictability(node, encountered_id, p_new)

    def _update_transitivity(self, node_a: Node, node_b: Node) -> None:
        """Update transitive predictabilities between two nodes.

        Formula: P(a,c) = P(a,c)_old + (1 - P(a,c)_old) * P(a,b) * P(b,c) * beta

        For each destination c known to node_b, node_a updates its
        predictability for c using the transitive relationship through b.

        Args:
            node_a: First node (updates its predictabilities).
            node_b: Second node (provides transitive info).
        """
        p_ab = self._get_predictability(node_a, node_b.node_id)
        b_preds: dict[str, float] = node_b.routing_table.get(
            "predictabilities", {})

        for dest_c, p_bc in b_preds.items():
            if dest_c == node_a.node_id:
                continue
            p_ac_old = self._get_predictability(node_a, dest_c)
            p_ac_new = p_ac_old + (1 - p_ac_old) * p_ab * p_bc * self.beta
            self._set_predictability(node_a, dest_c, p_ac_new)

    def on_contact(
        self,
        node_a: Node,
        node_b: Node,
        current_time: float,
    ) -> list[tuple[str, str, SimBundle]]:
        """Handle contact: update predictabilities and forward bundles.

        Bundles are forwarded only if the receiving node has a higher
        delivery predictability for the bundle's destination.

        Args:
            node_a: First node in the contact.
            node_b: Second node in the contact.
            current_time: Current simulation time.

        Returns:
            List of bundle transfers.
        """
        # Age predictabilities for both nodes
        self._age_predictabilities(node_a, current_time)
        self._age_predictabilities(node_b, current_time)

        # Update encounter predictabilities
        self._update_encounter(node_a, node_b.node_id)
        self._update_encounter(node_b, node_a.node_id)

        # Update transitive predictabilities
        self._update_transitivity(node_a, node_b)
        self._update_transitivity(node_b, node_a)

        transfers: list[tuple[str, str, SimBundle]] = []

        # Forward bundles from A to B if B has higher predictability
        for bundle in node_a.get_bundles_for_transfer():
            if bundle.is_expired(current_time):
                continue
            dest = bundle.destination
            # Always forward if B is the destination
            if dest == node_b.node_id:
                if not node_b.has_bundle(bundle.bundle_id) and node_b.buffer_has_space():
                    bundle_copy = copy.copy(bundle)
                    bundle_copy.hop_count += 1
                    transfers.append(
                        (node_a.node_id, node_b.node_id, bundle_copy))
                continue
            p_a = self._get_predictability(node_a, dest)
            p_b = self._get_predictability(node_b, dest)
            if p_b > p_a:
                if not node_b.has_bundle(bundle.bundle_id) and node_b.buffer_has_space():
                    bundle_copy = copy.copy(bundle)
                    bundle_copy.hop_count += 1
                    transfers.append(
                        (node_a.node_id, node_b.node_id, bundle_copy))

        # Forward bundles from B to A if A has higher predictability
        for bundle in node_b.get_bundles_for_transfer():
            if bundle.is_expired(current_time):
                continue
            dest = bundle.destination
            if dest == node_a.node_id:
                if not node_a.has_bundle(bundle.bundle_id) and node_a.buffer_has_space():
                    bundle_copy = copy.copy(bundle)
                    bundle_copy.hop_count += 1
                    transfers.append(
                        (node_b.node_id, node_a.node_id, bundle_copy))
                continue
            p_a = self._get_predictability(node_a, dest)
            p_b = self._get_predictability(node_b, dest)
            if p_a > p_b:
                if not node_a.has_bundle(bundle.bundle_id) and node_a.buffer_has_space():
                    bundle_copy = copy.copy(bundle)
                    bundle_copy.hop_count += 1
                    transfers.append(
                        (node_b.node_id, node_a.node_id, bundle_copy))

        return transfers
