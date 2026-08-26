/**
 * @module hooks/useSimulation
 * @description Primary application hook managing all simulation state, WebSocket/REST
 * communication, event processing, presets, and UI state.
 *
 * This hook is the central state manager for the entire DTN Crypto Simulator
 * frontend. It handles:
 * - Simulation lifecycle (idle → running → done/error)
 * - WebSocket real-time event streaming with REST fallback
 * - Event batching to prevent excessive React re-renders
 * - Bundle and node detail tracking
 * - Inspector panel selection
 * - UI state (sidebar, bottom panel, theme, animation speed)
 * - Preset save/load via localStorage
 * - CSV and JSON export
 *
 * @example
 * ```typescript
 * function App() {
 *   const sim = useSimulation();
 *
 *   return (
 *     <Sidebar
 *       config={sim.config}
 *       onConfigChange={sim.updateConfig}
 *       ...
 *     />
 *     <NetworkGraph
 *       numNodes={sim.config.nodes}
 *       events={sim.events}
 *       ...
 *     />
 *   );
 * }
 * ```
 */

import { useState, useCallback, useRef } from "react";
import type {
  SimulationConfig,
  SimulationEvent,
  MetricsResponse,
  SimulationResult,
  SimStatus,
  BundleDetail,
  NodeDetail,
  InspectorTarget,
} from "../types";
import { runSimulation, getWsUrl } from "../api/client";

/** Default simulation configuration used when the app initializes or resets. */
const defaultConfig: SimulationConfig = {
  router: "epidemic",
  nodes: 10,
  duration: 3600,
  scenario: "disaster",
  seed: 42,
  message_rate: 1.0,
  enable_pcap: false,
  payload_text: null,
};

/** Empty metrics object returned before any simulation has run. */
const emptyMetrics: MetricsResponse = {
  total_bundles: 0,
  delivered_bundles: 0,
  dropped_bundles: 0,
  expired_bundles: 0,
  delivery_ratio: 0,
  avg_latency_seconds: 0,
  bundle_drop_rate: 0,
  avg_encrypt_overhead_ms: 0,
  avg_decrypt_overhead_ms: 0,
  total_transfers: 0,
  integrity_failures: 0,
  avg_transmission_time_ms: 0,
  hop_count_distribution: {},
  router_name: "",
  duration: 0,
  num_nodes: 0,
};

/**
 * A single entry in the application log.
 *
 * App logs record significant events during the simulation lifecycle:
 * connection status, simulation progress, errors, and user actions.
 */
export interface AppLogEntry {
  /** Unique sequential ID for React keying. */
  id: number;

  /** Timestamp string in `HH:MM:SS` format (24-hour). */
  time: string;

  /** Log level determining the entry's visual style and semantic meaning. */
  level: "info" | "warn" | "error" | "success";

  /** Human-readable log message. */
  message: string;

  /** Optional additional detail text (e.g., error stack, config summary). */
  detail?: string;
}

/**
 * Safely close a WebSocket connection, ignoring errors if already closed.
 * @param ws - WebSocket instance to close, or null.
 */
function safeClose(ws: WebSocket | null) {
  if (ws) {
    try { ws.close(); } catch { /* already closed */ }
  }
}

/** Global counter for generating unique log entry IDs. */
let logIdCounter = 0;

/**
 * Primary application hook for the DTN Crypto Simulator.
 *
 * @returns An object containing all state values, setter functions, and action
 * callbacks needed by the application. See individual property descriptions
 * for details.
 *
 * @returns config - Current simulation configuration.
 * @returns updateConfig - Partial-patch updater for the config.
 * @returns status - Current simulation lifecycle state (`"idle"`, `"running"`, `"done"`, `"error"`).
 * @returns statusText - Human-readable status message displayed in the top nav.
 * @returns events - Array of all simulation events received so far.
 * @returns metrics - Current metrics (empty defaults before first simulation).
 * @returns result - Complete simulation result, or null if not yet completed.
 * @returns bundleDetails - Map of bundle IDs to their detailed information.
 * @returns nodeDetails - Map of node IDs to their detailed information.
 * @returns selectedTarget - Current inspector panel target (bundle, node, or null).
 * @returns selectBundle - Select a bundle for inspection by ID.
 * @returns selectNode - Select a node for inspection by ID.
 * @returns clearSelection - Close the inspector panel.
 * @returns sidebarCollapsed - Whether the left sidebar is collapsed.
 * @returns bottomPanelOpen - Whether the bottom metrics panel is open.
 * @returns toggleSidebar - Toggle sidebar collapsed state.
 * @returns toggleBottomPanel - Toggle bottom panel open/closed.
 * @returns run - Start a new simulation with the current config.
 * @returns reset - Reset all state to defaults and close any active connection.
 * @returns exportResults - Download the full simulation result as JSON.
 * @returns appLogs - Array of application log entries (newest first).
 * @returns clearAppLogs - Clear all application log entries.
 * @returns animationSpeed - Animation speed multiplier (0.5x - 3x).
 * @returns setAnimationSpeed - Set the animation speed multiplier.
 * @returns theme - Current UI theme (`"dark"` or `"light"`).
 * @returns toggleTheme - Toggle between dark and light themes.
 * @returns bundleFilter - Current bundle list filter (`"all"`, `"delivered"`, `"dropped"`, `"expired"`, `"intransit"`).
 * @returns setBundleFilter - Set the bundle list filter.
 * @returns filteredBundleDetails - Bundle details filtered by the current filter.
 * @returns exportLogsCsv - Download the event log as a CSV file.
 * @returns savePreset - Save the current config to localStorage.
 * @returns loadPreset - Load a saved config from localStorage.
 * @returns getPresets - Retrieve all saved presets from localStorage.
 * @returns runId - Incrementing counter that resets on each new simulation (for D3 re-init).
 */
export function useSimulation() {
  const [config, setConfig] = useState<SimulationConfig>(defaultConfig);
  const [status, setStatus] = useState<SimStatus>("idle");
  const [statusText, setStatusText] = useState("Ready");
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [bundleDetails, setBundleDetails] = useState<Record<string, BundleDetail>>({});
  const [nodeDetails, setNodeDetails] = useState<Record<string, NodeDetail>>({});
  const [selectedTarget, setSelectedTarget] = useState<InspectorTarget>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(true);
  const [appLogs, setAppLogs] = useState<AppLogEntry[]>([]);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [bundleFilter, setBundleFilter] = useState<"all" | "delivered" | "dropped" | "expired" | "intransit">("all");
  const [runId, setRunId] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const eventCountRef = useRef(0);
  const pendingEventsRef = useRef<SimulationEvent[]>([]);
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Append a log entry to the application log.
   * Entries are prepended (newest first) and capped at 500 entries.
   */
  const addAppLog = useCallback((level: AppLogEntry["level"], message: string, detail?: string) => {
    const entry: AppLogEntry = {
      id: ++logIdCounter,
      time: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      level,
      message,
      detail,
    };
    setAppLogs((prev) => [entry, ...prev].slice(0, 500));
  }, []);

  /** Partial-patch updater for simulation configuration. */
  const updateConfig = useCallback(
    (patch: Partial<SimulationConfig>) =>
      setConfig((prev) => ({ ...prev, ...patch })),
    [],
  );

  /** Select a bundle for inspection in the right-side InspectorPanel. */
  const selectBundle = useCallback(
    (id: string) => setSelectedTarget({ type: "bundle", id }),
    [],
  );

  /** Select a node for inspection in the NodeInspectorModal. */
  const selectNode = useCallback(
    (id: string) => setSelectedTarget({ type: "node", id }),
    [],
  );

  /** Clear the inspector panel selection (close the panel). */
  const clearSelection = useCallback(() => setSelectedTarget(null), []);

  /** Toggle the left sidebar collapsed/expanded state. */
  const toggleSidebar = useCallback(() => setSidebarCollapsed((prev) => !prev), []);

  /** Toggle the bottom metrics panel open/closed. */
  const toggleBottomPanel = useCallback(() => setBottomPanelOpen((prev) => !prev), []);

  /** Toggle between dark and light UI themes, updating the body class. */
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.body.classList.toggle("light-theme", next === "light");
      return next;
    });
  }, []);

  /** Clear all application log entries. */
  const clearAppLogs = useCallback(() => setAppLogs([]), []);

  /**
   * Export the current event log as a CSV file.
   * Downloads a file named `dtn_events_{router}_{timestamp}.csv`.
   */
  const exportLogsCsv = useCallback(() => {
    const headers = "Time,Type,From,To,Bundle ID,Latency\n";
    const rows = events.map((e) => {
      const lat = e.latency ?? (e.event_data?.latency as number | undefined);
      const latencyStr = lat != null ? lat.toFixed(2) : "";
      return `${e.time.toFixed(2)},${e.type},${e.node_from || ""},${e.node_to || ""},${e.bundle_id || ""},${latencyStr}`;
    }).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dtn_events_${config.router}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [events, config.router]);

  /**
   * Save the current configuration as a named preset in localStorage.
   * @param name - User-friendly name for the preset.
   */
  const savePreset = useCallback((name: string) => {
    const presets = JSON.parse(localStorage.getItem("dtn_presets") || "[]");
    presets.push({ name, config, savedAt: Date.now() });
    localStorage.setItem("dtn_presets", JSON.stringify(presets));
    addAppLog("success", `Preset "${name}" saved`);
  }, [config, addAppLog]);

  /**
   * Load a saved preset, replacing the current configuration.
   * @param preset - Preset object containing a name and config.
   */
  const loadPreset = useCallback((preset: { name: string; config: SimulationConfig }) => {
    setConfig(preset.config);
    addAppLog("info", `Preset "${preset.name}" loaded`);
  }, [addAppLog]);

  /**
   * Retrieve all saved presets from localStorage.
   * @returns Array of preset objects sorted by save time (newest first).
   */
  const getPresets = useCallback(() => {
    return JSON.parse(localStorage.getItem("dtn_presets") || "[]");
  }, []);

  /**
   * Flush all pending events into React state.
   *
   * Events are batched in `pendingEventsRef` and flushed every 50ms to avoid
   * 500+ React re-renders per second during high-throughput simulations.
   */
  const flushPendingEvents = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    const batch = pendingEventsRef.current;
    if (batch.length === 0) return;
    pendingEventsRef.current = [];
    setEvents((prev) => [...prev, ...batch]);
  }, []);

  /**
   * Reset all simulation state to initial values and close any active WebSocket.
   * Returns the app to the idle state with an empty event log.
   */
  const reset = useCallback(() => {
    safeClose(wsRef.current);
    wsRef.current = null;
    flushPendingEvents();
    setStatus("idle");
    setStatusText("Ready");
    setEvents([]);
    setMetrics(null);
    setResult(null);
    setBundleDetails({});
    setNodeDetails({});
    setSelectedTarget(null);
    setAppLogs([]);
    eventCountRef.current = 0;
    addAppLog("info", "Simulation reset");
  }, [addAppLog, flushPendingEvents]);

  /**
   * Start a new simulation with the current configuration.
   *
   * Attempts WebSocket connection first for real-time streaming. Falls back
   * to REST API if WebSocket is unavailable. Events are batched at 50ms
   * intervals to prevent excessive re-renders.
   */
  const run = useCallback(() => {
    if (status === "running") return;
    safeClose(wsRef.current);
    wsRef.current = null;
    pendingEventsRef.current = [];
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    setRunId((prev) => prev + 1);
    setStatus("running");
    setStatusText("Connecting...");
    setEvents([]);
    setMetrics(null);
    setResult(null);
    setBundleDetails({});
    setNodeDetails({});
    setSelectedTarget(null);
    setAppLogs([]);
    eventCountRef.current = 0;
    addAppLog("info", "Starting simulation", `${config.router} | ${config.nodes} nodes | ${config.duration}s | ${config.scenario}`);

    /**
     * Fallback to REST API when WebSocket is unavailable.
     * Replays all events in batches of 20 with requestAnimationFrame delays.
     */
    async function fallbackRest() {
      addAppLog("warn", "WebSocket unavailable, falling back to REST API");
      setStatusText("Running via REST API...");
      try {
        const data = await runSimulation(config);
        addAppLog("success", "REST API simulation complete", `${data.metrics.delivered_bundles}/${data.metrics.total_bundles} delivered`);
        setResult(data);
        setMetrics(data.metrics);
        setBundleDetails(data.bundle_details ?? {});
        setNodeDetails(data.node_details ?? {});
        const log = data.event_log ?? [];
        addAppLog("info", `Replaying ${log.length} events...`);
        for (let i = 0; i < log.length; i += 20) {
          const batch = log.slice(i, i + 20);
          setEvents((prev) => [...prev, ...batch]);
          await new Promise((r) => requestAnimationFrame(r));
          setStatusText(
            `Replaying... ${Math.min(i + 20, log.length)}/${log.length} events`,
          );
        }
        setStatus("done");
        setStatusText(
          `Complete! ${data.metrics.delivered_bundles}/${data.metrics.total_bundles} delivered (${(data.metrics.delivery_ratio * 100).toFixed(1)}%)`,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        addAppLog("error", "REST API simulation failed", msg);
        setStatus("error");
        setStatusText("Error: " + msg);
      }
    }

    // Try WebSocket first
    try {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        addAppLog("success", "WebSocket connected", "Sending simulation config...");
        setStatusText("Simulation running...");
        ws.send(JSON.stringify(config));
      };

      ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);

        if (data.type === "FINAL_RESULT") {
          flushPendingEvents();
          addAppLog("success", "Simulation complete",
            `${data.metrics.delivered_bundles}/${data.metrics.total_bundles} delivered (${(data.metrics.delivery_ratio * 100).toFixed(1)}%)`
          );
          setResult(data as SimulationResult);
          setMetrics(data.metrics as MetricsResponse);
          setBundleDetails(data.bundle_details ?? {});
          setNodeDetails(data.node_details ?? {});
          setStatus("done");
          setStatusText(
            `Complete! ${data.metrics.delivered_bundles}/${data.metrics.total_bundles} delivered (${(data.metrics.delivery_ratio * 100).toFixed(1)}%)`,
          );
          safeClose(ws);
          wsRef.current = null;
          return;
        }

        if (data.type === "SIMULATION_COMPLETE") {
          flushPendingEvents();
          addAppLog("info", "Simulation engine finished", "Waiting for final results...");
          return;
        }

        if (data.error) {
          flushPendingEvents();
          addAppLog("error", "Simulation error", data.error);
          setStatus("error");
          setStatusText("Error: " + data.error);
          safeClose(ws);
          wsRef.current = null;
          return;
        }

        // Batch events to avoid 500+ React re-renders per second
        eventCountRef.current++;
        const count = eventCountRef.current;
        pendingEventsRef.current.push(data as SimulationEvent);
        if (!flushTimeoutRef.current) {
          flushTimeoutRef.current = setTimeout(() => {
            flushTimeoutRef.current = null;
            flushPendingEvents();
          }, 50);
        }
        setStatusText(`Running... ${count} events`);
      };

      ws.onerror = () => {
        addAppLog("error", "WebSocket connection failed");
        ws.close();
        wsRef.current = null;
        fallbackRest();
      };

      ws.onclose = () => {
        addAppLog("warn", "WebSocket closed unexpectedly");
      };
    } catch (e) {
      addAppLog("error", "Failed to create WebSocket", e instanceof Error ? e.message : String(e));
      fallbackRest();
    }
  }, [config, status, addAppLog, flushPendingEvents]);

  /**
   * Export the complete simulation result as a JSON file.
   * Downloads a file named `dtn_sim_{router}_{timestamp}.json`.
   */
  const exportResults = useCallback(() => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dtn_sim_${config.router}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    addAppLog("info", "Results exported to JSON");
  }, [result, config.router, addAppLog]);

  /**
   * Compute filtered bundle details based on the current filter.
   * @returns Filtered array of BundleDetail objects.
   */
  const filteredBundleDetails = useCallback(() => {
    const all = Object.values(bundleDetails);
    if (bundleFilter === "all") return all;
    if (bundleFilter === "delivered") return all.filter((b) => b.delivered);
    if (bundleFilter === "dropped") return all.filter((b) => b.dropped);
    if (bundleFilter === "expired") return all.filter((b) => b.expired);
    if (bundleFilter === "intransit") return all.filter((b) => !b.delivered && !b.dropped && !b.expired);
    return all;
  }, [bundleDetails, bundleFilter]);

  return {
    config,
    updateConfig,
    status,
    statusText,
    events,
    metrics: metrics ?? emptyMetrics,
    result,
    bundleDetails,
    nodeDetails,
    selectedTarget,
    selectBundle,
    selectNode,
    clearSelection,
    sidebarCollapsed,
    bottomPanelOpen,
    toggleSidebar,
    toggleBottomPanel,
    run,
    reset,
    exportResults,
    appLogs,
    clearAppLogs,
    animationSpeed,
    setAnimationSpeed,
    theme,
    toggleTheme,
    bundleFilter,
    setBundleFilter,
    filteredBundleDetails: filteredBundleDetails(),
    exportLogsCsv,
    savePreset,
    loadPreset,
    getPresets,
    runId,
  };
}
