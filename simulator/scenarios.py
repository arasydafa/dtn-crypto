# simulator/scenarios.py — Preset scenario configurations for the DTN simulator.
# Purpose: Defines preset simulation scenarios (deepspace, disaster, military)
#          and provides contact schedule generation for each.
# Dependencies: json, random
# Usage: config = get_scenario_config("deepspace", num_nodes=10, duration=3600)

"""Preset scenario configurations and contact schedule generators.

Each scenario defines network parameters, contact patterns, and
cryptographic policies appropriate for its environment.
"""

from __future__ import annotations

import json
import os
import random
from typing import Any

from simulator.models import ContactEvent


def get_scenario_config(
    scenario: str,
    num_nodes: int = 10,
    duration: int = 3600,
    seed: int = 42,
    message_rate: float = 1.0,
) -> dict[str, Any]:
    """Get a complete scenario configuration.

    Args:
        scenario: Scenario name ("deepspace", "disaster", "military", "custom").
        num_nodes: Number of nodes in the simulation.
        duration: Simulation duration in seconds.
        seed: Random seed for reproducibility.
        message_rate: Messages per minute generation rate.

    Returns:
        Complete configuration dictionary.

    Raises:
        ValueError: If scenario name is not recognized.
    """
    scenarios: dict[str, dict[str, Any]] = {
        "deepspace": {
            "name": "Deep Space Communication",
            "description": (
                "High delay (minutes), rare contacts, critical data integrity. "
                "Simulates interplanetary communication between spacecraft, "
                "orbiters, and ground stations."
            ),
            "params": {
                "num_nodes": num_nodes,
                "duration": duration,
                "contact_probability": 0.08,
                "min_contact_duration": 60,
                "max_contact_duration": 300,
                "contact_interval_mean": 600,
                "bundle_ttl": max(1800, duration // 2),
                "max_hop_count": 10,
                "buffer_size": 50,
                "message_rate": message_rate,
                "seed": seed,
            },
            "node_attributes": {
                "ground_station": ["role:receiver", "clearance:high", "type:ground"],
                "orbiter": ["role:relay", "type:satellite", "clearance:medium"],
                "rover": ["role:node", "type:surface"],
            },
            "default_policy": "role:receiver OR role:relay",
        },
        "disaster": {
            "name": "Disaster Recovery Network",
            "description": (
                "Node failures, intermittent links, priority message routing. "
                "Simulates emergency communication after infrastructure collapse "
                "with mobile responders and base stations."
            ),
            "params": {
                "num_nodes": num_nodes,
                "duration": duration,
                "contact_probability": 0.20,
                "min_contact_duration": 10,
                "max_contact_duration": 120,
                "contact_interval_mean": 120,
                "bundle_ttl": max(600, duration // 4),
                "max_hop_count": 20,
                "buffer_size": 80,
                "message_rate": message_rate,
                "seed": seed,
            },
            "node_attributes": {
                "base_station": ["role:receiver", "type:base", "clearance:high"],
                "responder": ["role:responder", "role:receiver", "type:field"],
                "drone": ["role:relay", "type:uav"],
            },
            "default_policy": "role:receiver OR role:responder",
        },
        "military": {
            "name": "Military Tactical Mesh",
            "description": (
                "CP-ABE policy enforcement, attribute-based access, secure multi-hop. "
                "Simulates tactical communication with strict access control "
                "between command, field units, and logistics."
            ),
            "params": {
                "num_nodes": num_nodes,
                "duration": duration,
                "contact_probability": 0.15,
                "min_contact_duration": 20,
                "max_contact_duration": 180,
                "contact_interval_mean": 200,
                "bundle_ttl": max(900, duration // 3),
                "max_hop_count": 15,
                "buffer_size": 60,
                "message_rate": message_rate,
                "seed": seed,
            },
            "node_attributes": {
                "command": ["role:admin", "role:receiver", "clearance:top"],
                "field_unit": ["role:receiver", "clearance:medium", "type:field"],
                "logistics": ["role:relay", "clearance:low", "type:logistics"],
            },
            "default_policy": "role:receiver AND clearance:medium",
        },
    }

    if scenario == "custom":
        return {
            "name": "Custom Scenario",
            "description": "User-defined custom scenario from JSON config.",
            "params": {
                "num_nodes": num_nodes,
                "duration": duration,
                "contact_probability": 0.15,
                "min_contact_duration": 20,
                "max_contact_duration": 120,
                "contact_interval_mean": 200,
                "bundle_ttl": max(600, duration // 3),
                "max_hop_count": 20,
                "buffer_size": 100,
                "message_rate": message_rate,
                "seed": seed,
            },
            "node_attributes": {
                "default": ["role:node", "role:receiver"],
            },
            "default_policy": "role:receiver OR role:node",
        }

    if scenario not in scenarios:
        raise ValueError(
            f"Unknown scenario: '{scenario}'. "
            f"Available: {', '.join(scenarios.keys())}, custom"
        )

    config = scenarios[scenario]
    # Override with explicit parameters
    config["params"]["num_nodes"] = num_nodes
    config["params"]["duration"] = duration
    config["params"]["seed"] = seed
    config["params"]["message_rate"] = message_rate
    return config


def generate_contact_schedule(
    num_nodes: int,
    duration: int,
    contact_probability: float = 0.15,
    min_contact_duration: float = 20,
    max_contact_duration: float = 120,
    contact_interval_mean: float = 200,
    seed: int = 42,
) -> list[ContactEvent]:
    """Generate a random contact schedule for the simulation.

    Creates contact events between node pairs based on the scenario's
    contact probability and timing parameters.

    Args:
        num_nodes: Number of nodes in the simulation.
        duration: Simulation duration in seconds.
        contact_probability: Probability that any pair has contacts.
        min_contact_duration: Minimum contact duration in seconds.
        max_contact_duration: Maximum contact duration in seconds.
        contact_interval_mean: Mean time between contacts for a pair.
        seed: Random seed for reproducibility.

    Returns:
        Sorted list of ContactEvent instances.
    """
    rng = random.Random(seed)
    contacts: list[ContactEvent] = []
    node_ids = [f"node-{i}" for i in range(num_nodes)]

    for i in range(num_nodes):
        for j in range(i + 1, num_nodes):
            # Decide if this pair has contacts
            if rng.random() > contact_probability:
                continue

            # Generate contacts for this pair
            t = rng.expovariate(1.0 / contact_interval_mean)
            while t < duration:
                contact_dur = rng.uniform(
                    min_contact_duration, max_contact_duration)
                contacts.append(
                    ContactEvent(
                        time=t,
                        node_a=node_ids[i],
                        node_b=node_ids[j],
                        duration=min(contact_dur, duration - t),
                    )
                )
                t += contact_dur + rng.expovariate(1.0 / contact_interval_mean)

    contacts.sort(key=lambda c: c.time)
    return contacts


def assign_node_attributes(
    num_nodes: int,
    scenario_attrs: dict[str, list[str]],
    seed: int = 42,
) -> dict[str, list[str]]:
    """Assign CP-ABE attributes to nodes based on scenario roles.

    Distributes roles across nodes, ensuring at least one node of each type.

    Args:
        num_nodes: Number of nodes.
        scenario_attrs: Dict mapping role name to attribute list.
        seed: Random seed.

    Returns:
        Dict mapping node_id to attribute list.
    """
    rng = random.Random(seed)
    node_ids = [f"node-{i}" for i in range(num_nodes)]
    roles = list(scenario_attrs.keys())
    assignments: dict[str, list[str]] = {}

    # Ensure at least one node of each role
    for i, role in enumerate(roles):
        if i < num_nodes:
            assignments[node_ids[i]] = list(scenario_attrs[role])

    # Assign remaining nodes randomly
    for i in range(len(roles), num_nodes):
        role = rng.choice(roles)
        assignments[node_ids[i]] = list(scenario_attrs[role])

    return assignments


def load_custom_config(config_path: str) -> dict[str, Any]:
    """Load a custom scenario configuration from a JSON file.

    Args:
        config_path: Path to the JSON configuration file.

    Returns:
        Configuration dictionary.

    Raises:
        FileNotFoundError: If the config file doesn't exist.
        json.JSONDecodeError: If the file is not valid JSON.
    """
    with open(config_path, encoding="utf-8") as f:
        return json.load(f)


def save_scenario_config(config: dict[str, Any], output_path: str) -> str:
    """Save a scenario configuration to a JSON file.

    Args:
        config: Configuration dictionary.
        output_path: Directory path for the output file.

    Returns:
        Path to the written JSON file.
    """
    os.makedirs(output_path, exist_ok=True)
    filepath = os.path.join(output_path, "scenario_config.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
    return filepath


def get_all_scenario_info() -> list[dict[str, str]]:
    """Get summary info for all preset scenarios.

    Returns:
        List of dicts with name, key, and description for each scenario.
    """
    return [
        {
            "key": "deepspace",
            "name": "Deep Space Communication",
            "description": (
                "High delay (minutes), rare contacts, critical data integrity"
            ),
        },
        {
            "key": "disaster",
            "name": "Disaster Recovery Network",
            "description": (
                "Node failures, intermittent links, priority message routing"
            ),
        },
        {
            "key": "military",
            "name": "Military Tactical Mesh",
            "description": (
                "CP-ABE policy enforcement, attribute-based access, secure multi-hop"
            ),
        },
    ]
