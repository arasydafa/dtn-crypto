# api/scenarios.py — Preset scenario configs for the API.
# Purpose: Thin wrapper around simulator.scenarios for the API layer.
# Dependencies: simulator.scenarios
# Usage: from api.scenarios import get_presets

"""Preset scenario configurations for the API."""

from __future__ import annotations

from api.schemas import ScenarioInfo
from simulator.scenarios import get_all_scenario_info


def get_presets() -> list[ScenarioInfo]:
    """Get all preset scenario descriptions for the API.

    Returns:
        List of ScenarioInfo models.
    """
    return [ScenarioInfo(**info) for info in get_all_scenario_info()]
