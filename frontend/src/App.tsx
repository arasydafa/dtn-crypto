/**
 * @module App
 * @description Root application component for the DTN Crypto Simulator.
 *
 * Manages the overall layout with a top navigation bar, left sidebar,
 * central network graph, right inspector panel, and resizable bottom
 * metrics panel. Handles keyboard shortcuts (Ctrl+R, Ctrl+B, Ctrl+S, F11),
 * fullscreen toggling, and drag-to-resize for the bottom panel.
 *
 * @example
 * ```tsx
 * import { AppWithBoundary } from "./App";
 * ReactDOM.createRoot(document.getElementById("root")!).render(<AppWithBoundary />);
 * ```
 */

import { useMemo, useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { Button } from "@omega-os/ui";
import { Zap, Circle, Grid2x2, TreePine, ChevronDown } from "lucide-react";
import { useSimulation } from "./hooks/useSimulation";
import TopNav from "./components/TopNav";
import Sidebar from "./components/Sidebar";
import NetworkGraph from "./components/NetworkGraph";
import MetricsPanel from "./components/MetricsPanel";
import InspectorPanel from "./components/InspectorPanel";
import NodeInspectorModal from "./components/NodeInspectorModal";
import ErrorBoundary from "./components/ErrorBoundary";

// Lazy: pulls in react-markdown via @omega-os/ui Markdown only when opened.
const WikiModal = lazy(() => import("./components/WikiModal"));

/** Default height of the bottom metrics panel in pixels. */
const DEFAULT_BOTTOM_HEIGHT = 260;

/** Minimum allowed height for the bottom panel before auto-collapsing. */
const MIN_BOTTOM_HEIGHT = 120;

/** Maximum allowed height for the bottom panel. */
const MAX_BOTTOM_HEIGHT = 500;

/**
 * Root application component.
 *
 * Renders the complete DTN Simulator dashboard layout:
 * - {@link TopNav} — status bar, theme toggle, fullscreen, reset
 * - {@link Sidebar} — configuration controls, presets, bundle list
 * - {@link NetworkGraph} — D3.js force-directed network visualization
 * - {@link InspectorPanel} — right-side bundle/node detail panel
 * - {@link MetricsPanel} — bottom tabbed panel with charts, events, app log
 * - {@link WikiModal} — optional wiki overlay
 */
export default function App() {
  const sim = useSimulation();
  const [showWiki, setShowWiki] = useState(false);
  const [bottomHeight, setBottomHeight] = useState(DEFAULT_BOTTOM_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [graphLayout, setGraphLayout] = useState<"force" | "circular" | "grid" | "tree">("force");
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const collapseThreshold = 80;
  const bottomHeightRef = useRef(bottomHeight);

  /**
   * Compute the highlighted path for the network graph based on the
   * currently selected bundle. Extracts node IDs from hop history.
   */
  const highlightPath = useMemo(() => {
    if (!sim.selectedTarget || sim.selectedTarget.type !== "bundle") return undefined;
    const bundle = sim.bundleDetails[sim.selectedTarget.id];
    if (!bundle || bundle.hop_history.length === 0) return undefined;
    const path = [bundle.hop_history[0].from_node];
    for (const hop of bundle.hop_history) {
      path.push(hop.to_node);
    }
    return path;
  }, [sim.selectedTarget, sim.bundleDetails]);

  /** Toggle browser fullscreen mode. */
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  /** Sync fullscreen state with browser fullscreen changes. */
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  /**
   * Keyboard shortcuts:
   * - Ctrl+R: Run simulation
   * - Ctrl+B: Toggle bottom panel
   * - Ctrl+S: Toggle sidebar
   * - F11: Toggle fullscreen
   */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "r") {
        e.preventDefault();
        if (sim.status !== "running") sim.run();
      }
      if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        sim.toggleBottomPanel();
      }
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        sim.toggleSidebar();
      }
      if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sim, toggleFullscreen]);

  /** Begin dragging the bottom panel resize handle. */
  const onDragStart = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartHeight.current = bottomHeight;
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
  }, [bottomHeight]);

  useEffect(() => {
    bottomHeightRef.current = bottomHeight;
  }, [bottomHeight]);

  /**
   * Handle mouse move/up during bottom panel drag resize.
   * Auto-collapses panel if dragged below the collapse threshold.
   */
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const delta = dragStartY.current - e.clientY;
      const newHeight = Math.max(MIN_BOTTOM_HEIGHT, Math.min(MAX_BOTTOM_HEIGHT, dragStartHeight.current + delta));
      setBottomHeight(newHeight);
    };
    const onUp = () => {
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (bottomHeightRef.current < collapseThreshold) {
        sim.toggleBottomPanel();
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, sim]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-ot-bg text-ot-text">
      <TopNav
        sidebarCollapsed={sim.sidebarCollapsed}
        onToggleSidebar={sim.toggleSidebar}
        bottomPanelOpen={sim.bottomPanelOpen}
        onToggleBottomPanel={sim.toggleBottomPanel}
        status={sim.status}
        statusText={sim.statusText}
        hasResult={sim.result !== null}
        onRun={sim.run}
        onReset={sim.reset}
        onExport={sim.exportResults}
        onFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
        theme={sim.theme}
        onToggleTheme={sim.toggleTheme}
        onWiki={() => setShowWiki(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          collapsed={sim.sidebarCollapsed}
          config={sim.config}
          onConfigChange={sim.updateConfig}
          bundleDetails={sim.filteredBundleDetails}
          onSelectBundle={sim.selectBundle}
          selectedTarget={sim.selectedTarget}
          animationSpeed={sim.animationSpeed}
          onAnimationSpeedChange={sim.setAnimationSpeed}
          bundleFilter={sim.bundleFilter}
          onBundleFilterChange={(f) => sim.setBundleFilter(f as "all" | "delivered" | "dropped" | "expired" | "intransit")}
          onSavePreset={sim.savePreset}
          onLoadPreset={sim.loadPreset}
          getPresets={sim.getPresets}
          onExportCsv={sim.exportLogsCsv}
          hasEvents={sim.events.length > 0}
          onToggleSidebar={sim.toggleSidebar}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <NetworkGraph
              numNodes={sim.config.nodes}
              events={sim.events}
              onNodeSelect={sim.selectNode}
              highlightPath={highlightPath}
              animationSpeed={sim.animationSpeed}
              runId={sim.runId}
              layout={graphLayout}
            />
            {/* Layout selector — OmegaOS phase 1, lucide icons only */}
            <div className="absolute left-3 top-3 z-30 flex gap-1 rounded-ot-md border border-ot-border bg-ot-bg p-1 shadow-ot-sm">
              {(["force", "circular", "grid", "tree"] as const).map((l) => {
                const Icon = l === "force" ? Zap : l === "circular" ? Circle : l === "grid" ? Grid2x2 : TreePine;
                return (
                  <Button
                    key={l}
                    variant={graphLayout === l ? "primary" : "ghost"}
                    size="sm"
                    onClick={() => setGraphLayout(l)}
                    icon={<Icon size={12} aria-hidden />}
                    title={`${l} layout`}
                  >
                    <span className="capitalize">{l}</span>
                  </Button>
                );
              })}
            </div>
            <InspectorPanel
              target={sim.selectedTarget?.type === "bundle" ? sim.selectedTarget : null}
              bundleDetails={sim.bundleDetails}
              nodeDetails={sim.nodeDetails}
              onClose={sim.clearSelection}
              onSelectBundle={sim.selectBundle}
            />
          </div>

          <div
            className={`group relative flex h-1.5 flex-shrink-0 cursor-ns-resize items-center justify-center transition-colors hover:bg-navy-bg ${sim.bottomPanelOpen ? "" : "cursor-pointer"}`}
            onMouseDown={sim.bottomPanelOpen ? onDragStart : undefined}
            onClick={sim.bottomPanelOpen ? undefined : () => sim.toggleBottomPanel()}
            title={sim.bottomPanelOpen ? "Drag to resize or click to collapse" : "Click to expand panel"}
          >
            <div className="h-[3px] w-10 rounded-full bg-ot-border transition-colors group-hover:bg-navy" />
            <span className="absolute right-3 grid h-5 w-5 place-items-center rounded-ot-sm border border-ot-border bg-ot-surface text-ot-muted opacity-0 transition-opacity group-hover:opacity-100">
              <ChevronDown size={12} aria-hidden className={sim.bottomPanelOpen ? "" : "rotate-180"} />
            </span>
          </div>

          <div
            className={
              sim.bottomPanelOpen
                ? "flex min-h-0 flex-col overflow-hidden border-t border-ot-border bg-ot-bg transition-[height] duration-150"
                : "flex min-h-[52px] items-center border-t border-ot-border bg-ot-bg px-4"
            }
            style={sim.bottomPanelOpen ? { height: bottomHeight } : undefined}
          >
            <MetricsPanel
              metrics={sim.metrics}
              events={sim.events}
              open={sim.bottomPanelOpen}
              appLogs={sim.appLogs}
              onClearAppLogs={sim.clearAppLogs}
            />
          </div>
        </div>
      </div>

      {showWiki && (
        <Suspense fallback={null}>
          <WikiModal onClose={() => setShowWiki(false)} />
        </Suspense>
      )}

      {sim.selectedTarget?.type === "node" && sim.nodeDetails[sim.selectedTarget.id] && (
        <NodeInspectorModal
          node={sim.nodeDetails[sim.selectedTarget.id]}
          nodeBundles={Object.values(sim.bundleDetails).filter(
            (b) => b.source === sim.selectedTarget!.id || b.destination === sim.selectedTarget!.id || b.hop_history.some((h) => h.from_node === sim.selectedTarget!.id || h.to_node === sim.selectedTarget!.id)
          )}
          onSelectBundle={sim.selectBundle}
          onClose={sim.clearSelection}
        />
      )}
    </div>
  );
}

/**
 * Application entry point wrapped in an {@link ErrorBoundary}.
 *
 * Catches unhandled rendering errors and displays a fallback UI
 * with a reload button.
 */
export function AppWithBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
