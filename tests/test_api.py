# tests/test_api.py — Unit tests for the FastAPI simulator API.
# Purpose: Tests all API endpoints: POST /simulate, GET /scenarios,
#          GET /health, and basic schema validation.
# Dependencies: pytest, httpx, fastapi
# Usage: pytest tests/test_api.py -v

"""Tests for the FastAPI simulator API."""

from __future__ import annotations

from fastapi.testclient import TestClient

from api.app import app

client = TestClient(app)


class TestHealthEndpoint:
    """Tests for GET /health."""

    def test_health_returns_ok(self) -> None:
        """Health endpoint returns status ok."""
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "version" in data

    def test_health_has_version(self) -> None:
        """Health endpoint includes version string."""
        resp = client.get("/health")
        data = resp.json()
        assert data["version"] == "0.1.0"


class TestScenariosEndpoint:
    """Tests for GET /scenarios."""

    def test_scenarios_returns_list(self) -> None:
        """Scenarios endpoint returns a list of presets."""
        resp = client.get("/scenarios")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 3

    def test_scenarios_have_required_fields(self) -> None:
        """Each scenario has key, name, and description."""
        resp = client.get("/scenarios")
        data = resp.json()
        for scenario in data:
            assert "key" in scenario
            assert "name" in scenario
            assert "description" in scenario

    def test_scenarios_include_deepspace(self) -> None:
        """Scenarios include the deep space preset."""
        resp = client.get("/scenarios")
        data = resp.json()
        keys = [s["key"] for s in data]
        assert "deepspace" in keys

    def test_scenarios_include_disaster(self) -> None:
        """Scenarios include the disaster recovery preset."""
        resp = client.get("/scenarios")
        data = resp.json()
        keys = [s["key"] for s in data]
        assert "disaster" in keys

    def test_scenarios_include_military(self) -> None:
        """Scenarios include the military tactical preset."""
        resp = client.get("/scenarios")
        data = resp.json()
        keys = [s["key"] for s in data]
        assert "military" in keys


class TestSimulateEndpoint:
    """Tests for POST /simulate."""

    def test_simulate_with_defaults(self) -> None:
        """Simulation runs with default parameters."""
        resp = client.post("/simulate", json={
            "router": "epidemic",
            "nodes": 5,
            "duration": 120,
            "scenario": "disaster",
            "seed": 42,
            "message_rate": 0.5,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "metrics" in data
        assert "event_log" in data

    def test_simulate_metrics_structure(self) -> None:
        """Simulation result contains expected metric fields."""
        resp = client.post("/simulate", json={
            "router": "epidemic",
            "nodes": 5,
            "duration": 120,
            "scenario": "disaster",
            "seed": 42,
            "message_rate": 0.5,
        })
        metrics = resp.json()["metrics"]
        assert "total_bundles" in metrics
        assert "delivered_bundles" in metrics
        assert "delivery_ratio" in metrics
        assert "avg_latency_seconds" in metrics
        assert "avg_encrypt_overhead_ms" in metrics
        assert "avg_decrypt_overhead_ms" in metrics
        assert "router_name" in metrics

    def test_simulate_prophet_router(self) -> None:
        """Simulation runs with PRoPHET router."""
        resp = client.post("/simulate", json={
            "router": "prophet",
            "nodes": 5,
            "duration": 120,
            "scenario": "disaster",
            "seed": 42,
            "message_rate": 0.5,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["metrics"]["router_name"] == "prophet"

    def test_simulate_spray_router(self) -> None:
        """Simulation runs with Spray-and-Wait router."""
        resp = client.post("/simulate", json={
            "router": "spray",
            "nodes": 5,
            "duration": 120,
            "scenario": "disaster",
            "seed": 42,
            "message_rate": 0.5,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["metrics"]["router_name"] == "spray"

    def test_simulate_deepspace_scenario(self) -> None:
        """Simulation runs with deepspace scenario."""
        resp = client.post("/simulate", json={
            "router": "epidemic",
            "nodes": 5,
            "duration": 120,
            "scenario": "deepspace",
            "seed": 42,
            "message_rate": 0.5,
        })
        assert resp.status_code == 200

    def test_simulate_military_scenario(self) -> None:
        """Simulation runs with military scenario."""
        resp = client.post("/simulate", json={
            "router": "epidemic",
            "nodes": 5,
            "duration": 120,
            "scenario": "military",
            "seed": 42,
            "message_rate": 0.5,
        })
        assert resp.status_code == 200

    def test_simulate_reproducible_with_seed(self) -> None:
        """Two runs with the same seed produce the same results."""
        config = {
            "router": "epidemic",
            "nodes": 5,
            "duration": 120,
            "scenario": "disaster",
            "seed": 99,
            "message_rate": 0.5,
        }
        resp1 = client.post("/simulate", json=config)
        resp2 = client.post("/simulate", json=config)
        m1 = resp1.json()["metrics"]
        m2 = resp2.json()["metrics"]
        assert m1["total_bundles"] == m2["total_bundles"]
        assert m1["delivered_bundles"] == m2["delivered_bundles"]
        assert m1["delivery_ratio"] == m2["delivery_ratio"]

    def test_simulate_event_log_not_empty(self) -> None:
        """Simulation produces a non-empty event log."""
        resp = client.post("/simulate", json={
            "router": "epidemic",
            "nodes": 5,
            "duration": 300,
            "scenario": "disaster",
            "seed": 42,
            "message_rate": 1.0,
        })
        events = resp.json()["event_log"]
        assert len(events) > 0

    def test_simulate_event_log_has_types(self) -> None:
        """Event log contains expected event types."""
        resp = client.post("/simulate", json={
            "router": "epidemic",
            "nodes": 8,
            "duration": 600,
            "scenario": "disaster",
            "seed": 42,
            "message_rate": 1.0,
        })
        events = resp.json()["event_log"]
        types = {e["type"] for e in events}
        assert "BUNDLE_CREATE" in types
        assert "CONTACT_START" in types

    def test_simulate_invalid_router_rejected(self) -> None:
        """Invalid router name is rejected with 422."""
        resp = client.post("/simulate", json={
            "router": "invalid",
            "nodes": 5,
            "duration": 120,
        })
        assert resp.status_code == 422

    def test_simulate_nodes_too_low_rejected(self) -> None:
        """Node count below minimum is rejected."""
        resp = client.post("/simulate", json={
            "router": "epidemic",
            "nodes": 1,
            "duration": 120,
        })
        assert resp.status_code == 422

    def test_simulate_duration_too_low_rejected(self) -> None:
        """Duration below minimum is rejected."""
        resp = client.post("/simulate", json={
            "router": "epidemic",
            "nodes": 5,
            "duration": 10,
        })
        assert resp.status_code == 422
