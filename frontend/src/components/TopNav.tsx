/**
 * @module components/TopNav
 * @description Top navigation bar with status display, theme toggle, fullscreen,
 * wiki, and simulation controls (Run, Reset, Export).
 *
 * Shows a colored status dot (idle/running/done/error) with a text label.
 * All buttons have keyboard shortcut hints in their tooltips.
 *
 * @example
 * ```tsx
 * <TopNav
 *   status={sim.status}
 *   statusText={sim.statusText}
 *   onRun={sim.run}
 *   ...
 * />
 * ```
 */

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

/**
 * Top navigation bar component.
 *
 * Layout:
 * - **Left**: hamburger toggle, brand name ("DTN Crypto Simulator v0.2")
 * - **Center**: status dot + status text
 * - **Right**: theme, wiki, fullscreen, bottom panel toggle, export, reset, run
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
  const statusClass =
    status === "running"
      ? "nav-status running"
      : status === "done"
        ? "nav-status done"
        : status === "error"
          ? "nav-status error"
          : "nav-status";

  return (
    <header className="top-nav">
      <div className="nav-left">
        <button
          className="nav-toggle"
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? "Expand sidebar (Ctrl+S)" : "Collapse sidebar (Ctrl+S)"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="nav-brand">
          <span className="nav-title">DTN Crypto</span>
          <span className="nav-subtitle">Simulator v0.2</span>
        </div>
      </div>

      <div className="nav-center">
        <div className={statusClass}>
          <span className="nav-status-dot" />
          <span className="nav-status-text">{statusText}</span>
        </div>
      </div>

      <div className="nav-right">
        <button className="nav-btn nav-btn-icon" onClick={onToggleTheme} title="Toggle theme">
          {theme === "dark" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        <button className="nav-btn nav-btn-icon" onClick={onWiki} title="DTN Crypto Wiki">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </button>

        <button className="nav-btn nav-btn-icon" onClick={onFullscreen} title={isFullscreen ? "Exit fullscreen (F11)" : "Fullscreen (F11)"}>
          {isFullscreen ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          )}
        </button>

        <button className="nav-btn nav-btn-icon" onClick={onToggleBottomPanel} title={bottomPanelOpen ? "Hide panel (Ctrl+B)" : "Show panel (Ctrl+B)"}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: bottomPanelOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <button className="nav-btn nav-btn-export" disabled={!hasResult} onClick={onExport} title="Export results">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Export</span>
        </button>

        <button className="nav-btn nav-btn-reset" onClick={onReset} title="Reset simulation">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          <span>Reset</span>
        </button>

        <button className="nav-btn nav-btn-run" disabled={status === "running"} onClick={onRun} title="Run simulation (Ctrl+R)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <span>Run</span>
        </button>
      </div>
    </header>
  );
}
