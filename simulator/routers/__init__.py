# simulator/routers/__init__.py — Routing algorithm package.
# Purpose: Exposes all routing algorithm classes.
# Dependencies: None
# Usage: from simulator.routers import EpidemicRouter, PRoPHETRouter, SprayAndWaitRouter

"""DTN routing algorithm implementations."""

from simulator.routers.base import BaseRouter
from simulator.routers.epidemic import EpidemicRouter
from simulator.routers.prophet import PRoPHETRouter
from simulator.routers.spray import SprayAndWaitRouter

__all__ = [
    "BaseRouter",
    "EpidemicRouter",
    "PRoPHETRouter",
    "SprayAndWaitRouter",
]
