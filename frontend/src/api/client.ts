/**
 * @module api/client
 * @description HTTP and WebSocket client for communicating with the DTN Crypto Simulator backend.
 *
 * All API calls go through this module. The base URL defaults to `http://localhost:8000`
 * but can be overridden via the `VITE_API_URL` environment variable.
 *
 * @example
 * ```typescript
 * import { runSimulation, getScenarios, getWsUrl } from "./api/client";
 *
 * // REST mode
 * const result = await runSimulation({ router: "epidemic", nodes: 10, ... });
 *
 * // WebSocket mode
 * const ws = new WebSocket(getWsUrl());
 * ```
 */

import type { SimulationConfig, SimulationResult, ScenarioInfo } from "../types";

/** Base URL for the FastAPI backend. Defaults to `http://localhost:8000`. */
const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/**
 * Run a simulation via the REST API.
 *
 * Sends a `POST /simulate` request with the given configuration and waits
 * for the complete result. For real-time streaming, use the WebSocket
 * endpoint instead (see {@link getWsUrl}).
 *
 * @param config - Simulation configuration (router, nodes, duration, etc.).
 * @returns The complete simulation result including metrics, event log, and details.
 * @throws {Error} If the HTTP response is not OK (e.g., 422 validation error, 500 server error).
 *
 * @example
 * ```typescript
 * const result = await runSimulation({
 *   router: "prophet",
 *   nodes: 15,
 *   duration: 1800,
 *   scenario: "deepspace",
 *   seed: 42,
 *   message_rate: 1.0,
 *   enable_pcap: false,
 * });
 *
 * console.log(`Delivery ratio: ${result.metrics.delivery_ratio}`);
 * console.log(`Events: ${result.event_log.length}`);
 * ```
 */
export async function runSimulation(
    config: SimulationConfig,
): Promise<SimulationResult> {
    const resp = await fetch(`${API}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
}

/**
 * Fetch the list of available preset scenarios.
 *
 * @returns Array of scenario metadata (key, name, description).
 * @throws {Error} If the HTTP response is not OK.
 *
 * @example
 * ```typescript
 * const scenarios = await getScenarios();
 * scenarios.forEach(s => {
 *   console.log(`${s.key}: ${s.description}`);
 * });
 * // "deepspace: Interplanetary communication with high delays..."
 * ```
 */
export async function getScenarios(): Promise<ScenarioInfo[]> {
    const resp = await fetch(`${API}/scenarios`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
}

/**
 * Construct the WebSocket URL for real-time simulation streaming.
 *
 * Converts the HTTP base URL to a WebSocket URL by replacing `http` with `ws`
 * and appending the `/ws/live` path.
 *
 * @returns WebSocket URL string (e.g., `"ws://localhost:8000/ws/live"`).
 *
 * @example
 * ```typescript
 * const ws = new WebSocket(getWsUrl());
 * ws.onopen = () => {
 *   ws.send(JSON.stringify({ router: "epidemic", nodes: 10, ... }));
 * };
 * ws.onmessage = (event) => {
 *   const data = JSON.parse(event.data);
 *   // Process CONTACT_START, BUNDLE_TRANSFER, FINAL_RESULT, etc.
 * };
 * ```
 */
export function getWsUrl(): string {
    return API.replace("http", "ws") + "/ws/live";
}
