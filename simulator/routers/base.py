# simulator/routers/base.py — Abstract base class for DTN routing algorithms.
# Purpose: Defines the interface that all routing strategies must implement.
# Dependencies: simulator.models
# Usage: Subclass BaseRouter and implement on_contact()

"""Abstract base class for DTN routing algorithms."""

from __future__ import annotations

import abc
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from simulator.models import Node, SimBundle

logger = logging.getLogger(__name__)


class BaseRouter(abc.ABC):
    """Abstract base class for DTN routing algorithms.

    All routing strategies must implement the on_contact method, which
    decides which bundles to forward when two nodes come into contact.

    Attributes:
        name: Human-readable name of the routing algorithm.
    """

    name: str = "base"

    @abc.abstractmethod
    def on_contact(
        self,
        node_a: Node,
        node_b: Node,
        current_time: float,
    ) -> list[tuple[str, str, SimBundle]]:
        """Handle a contact event between two nodes.

        Decides which bundles to forward between the two nodes based on
        the routing strategy.

        Args:
            node_a: The first node in the contact.
            node_b: The second node in the contact.
            current_time: Current simulation time in seconds.

        Returns:
            List of (from_node_id, to_node_id, bundle) tuples representing
            bundle transfers to execute.
        """

    def on_node_join(self, node: Node) -> None:  # noqa: B027
        """Called when a node joins the network.

        Override to initialize router-specific state on the node.

        Args:
            node: The node that joined.
        """

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}()"
