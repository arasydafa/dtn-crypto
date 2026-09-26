/**
 * @module components/TopNav
 * @description Top navigation bar — OmegaOS phase 1.
 *
 * Uses @omega-os/ui Button + Badge + Tooltip with lucide-react icons.
 * Layout: brand left, status center, controls right.
 */

import { Button } from "@omega-os/ui";
import { Badge } from "@omega-os/ui";
import { Tooltip } from "@omega-os/ui";
import {
  Menu,
  Sun,
  Moon,
  BookOpen,
  Maximize,
  Minimize,
  PanelBottom,
  Download,
  RotateCcw,
  Play,
} from "lucide-react";

/** Props for the TopNav component. */
interface Props {
  /** Whether the left sidebar is currently collapsed. */
  sidebarCollapsed: boolean;

  /** Toggle sidebar collapsed state. */
  onToggleSidebar: () => void;

  /** Whether the bottom metrics panel is open. */
  bottomPanelOpen: boolean;

  /** Toggle bottom panel open/closed. */
  onToggleBottomPanel: () => void;

  /** Current simulation lifecycle state. */
  status: "idle" | "running" | "done" | "error";

  /** Human-readable status message displayed in the center. */
  statusText: string;

  /** Whether simulation results are available for export. */
  hasResult: boolean;

  /** Start a new simulation. */
  onRun: () => void;

  /** Reset all simulation state. */
  onReset: () => void;

  /** Export simulation results as JSON. */
  onExport: () => void;

  /** Toggle browser fullscreen mode. */
  onFullscreen: () => void;

  /** Whether the browser is currently in fullscreen mode. */
  isFullscreen: boolean;

  /** Current UI theme (`"dark"` or `"light"`). */
  theme: "dark" | "light";

  /** Toggle between dark and light themes. */
  onToggleTheme: () => void;

  /** Open the wiki modal. */
  onWiki: () => void;
}

function statusTone(status: Props["status"]): "grey" | "warning" | "success" | "danger" {
  if (status === "running") return "warning";
  if (status === "done") return "success";
  if (status === "error") return "danger";
  return "grey";
}

/**
 * Top navigation bar component (OmegaOS).
 */
export default function TopNav({
  sidebarCollapsed,
  onToggleSidebar,
  bottomPanelOpen,
  onToggleBottomPanel,
  status,
  statusText,
  hasResult,
  onRun,
  onReset,
  onExport,
  onFullscreen,
  isFullscreen,
  theme,
  onToggleTheme,
  onWiki,
}: Props) {
  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between gap-3 border-b border-ot-border bg-ot-bg px-4">
      <div className="flex items-center gap-3">
        <Tooltip content={sidebarCollapsed ? "Expand sidebar (Ctrl+S)" : "Collapse sidebar (Ctrl+S)"}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            icon={<Menu size={18} aria-hidden />}
            aria-label="Toggle sidebar"
          />
        </Tooltip>
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-bold tracking-tight text-ot-text">DTN Crypto</span>
          <span className="text-[11px] font-medium text-ot-muted">Simulator v0.2</span>
        </div>
      </div>

      <div className="flex items-center">
        <Badge tone={statusTone(status)}>
          <span
            aria-hidden
            className={`inline-block h-2 w-2 rounded-full ${
              status === "running"
                ? "bg-warning"
                : status === "done"
                  ? "bg-success"
                  : status === "error"
                    ? "bg-danger"
                    : "bg-ot-muted"
            }`}
          />
          {statusText}
        </Badge>
      </div>

      <div className="flex items-center gap-1.5">
        <Tooltip content="Toggle theme">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleTheme}
            icon={theme === "dark" ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
            aria-label="Toggle theme"
          />
        </Tooltip>

        <Tooltip content="DTN Crypto Wiki">
          <Button
            variant="ghost"
            size="sm"
            onClick={onWiki}
            icon={<BookOpen size={16} aria-hidden />}
            aria-label="Open wiki"
          />
        </Tooltip>

        <Tooltip content={isFullscreen ? "Exit fullscreen (F11)" : "Fullscreen (F11)"}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onFullscreen}
            icon={isFullscreen ? <Minimize size={16} aria-hidden /> : <Maximize size={16} aria-hidden />}
            aria-label="Toggle fullscreen"
          />
        </Tooltip>

        <Tooltip content={bottomPanelOpen ? "Hide panel (Ctrl+B)" : "Show panel (Ctrl+B)"}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleBottomPanel}
            icon={<PanelBottom size={16} aria-hidden />}
            aria-label="Toggle bottom panel"
          />
        </Tooltip>

        <Tooltip content="Export results">
          <Button
            variant="secondary"
            size="sm"
            disabled={!hasResult}
            onClick={onExport}
            icon={<Download size={16} aria-hidden />}
          >
            Export
          </Button>
        </Tooltip>

        <Tooltip content="Reset simulation">
          <Button variant="secondary" size="sm" onClick={onReset} icon={<RotateCcw size={16} aria-hidden />}>
            Reset
          </Button>
        </Tooltip>

        <Tooltip content="Run simulation (Ctrl+R)">
          <Button
            variant="primary"
            size="sm"
            disabled={status === "running"}
            onClick={onRun}
            icon={<Play size={16} aria-hidden />}
          >
            Run
          </Button>
        </Tooltip>
      </div>
    </header>
  );
}
