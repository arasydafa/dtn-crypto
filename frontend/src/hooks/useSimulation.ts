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

export interface AppLogEntry {
  id: number;
  time: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
  detail?: string;
}

function safeClose(ws: WebSocket | null) {
  if (ws) {
    try { ws.close(); } catch { /* already closed */ }
  }
}

let logIdCounter = 0;

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

  const updateConfig = useCallback(
    (patch: Partial<SimulationConfig>) =>
      setConfig((prev) => ({ ...prev, ...patch })),
    [],
  );

  const selectBundle = useCallback(
    (id: string) => setSelectedTarget({ type: "bundle", id }),
    [],
  );

  const selectNode = useCallback(
    (id: string) => setSelectedTarget({ type: "node", id }),
    [],
  );

  const clearSelection = useCallback(() => setSelectedTarget(null), []);

  const toggleSidebar = useCallback(() => setSidebarCollapsed((prev) => !prev), []);

  const toggleBottomPanel = useCallback(() => setBottomPanelOpen((prev) => !prev), []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.body.classList.toggle("light-theme", next === "light");
      return next;
    });
  }, []);

  const clearAppLogs = useCallback(() => setAppLogs([]), []);

  const exportLogsCsv = useCallback(() => {
    const headers = "Time,Type,From,To,Bundle ID,Latency\n";
    const rows = events.map((e) => {
      const latency = e.latency != null ? e.latency.toFixed(2) : "";
      return `${e.time.toFixed(2)},${e.type},${e.node_from || ""},${e.node_to || ""},${e.bundle_id || ""},${latency}`;
    }).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dtn_events_${config.router}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [events, config.router]);

  const savePreset = useCallback((name: string) => {
    const presets = JSON.parse(localStorage.getItem("dtn_presets") || "[]");
    presets.push({ name, config, savedAt: Date.now() });
    localStorage.setItem("dtn_presets", JSON.stringify(presets));
    addAppLog("success", `Preset "${name}" saved`);
  }, [config, addAppLog]);

  const loadPreset = useCallback((preset: { name: string; config: SimulationConfig }) => {
    setConfig(preset.config);
    addAppLog("info", `Preset "${preset.name}" loaded`);
  }, [addAppLog]);

  const getPresets = useCallback(() => {
    return JSON.parse(localStorage.getItem("dtn_presets") || "[]");
  }, []);

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
        if (status === "running") {
          addAppLog("warn", "WebSocket closed unexpectedly");
        }
      };
    } catch (e) {
      addAppLog("error", "Failed to create WebSocket", e instanceof Error ? e.message : String(e));
      fallbackRest();
    }
  }, [config, status, addAppLog, flushPendingEvents]);

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
