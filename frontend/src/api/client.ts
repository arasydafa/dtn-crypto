import type { SimulationConfig, SimulationResult, ScenarioInfo } from "../types";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

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

export async function getScenarios(): Promise<ScenarioInfo[]> {
    const resp = await fetch(`${API}/scenarios`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
}

export function getWsUrl(): string {
    return API.replace("http", "ws") + "/ws/live";
}
