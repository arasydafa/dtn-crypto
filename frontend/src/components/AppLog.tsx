/**
 * @module components/AppLog
 * @description Application log viewer showing connection status, simulation progress, and errors.
 *
 * Displays log entries in reverse chronological order (newest first) with
 * colored level indicators. Entries are capped at 500 by the useSimulation hook.
 *
 * @example
 * ```tsx
 * <AppLog logs={sim.appLogs} onClear={sim.clearAppLogs} />
 * ```
 */

import type { AppLogEntry } from "../hooks/useSimulation";

/** Props for the AppLog component. */
interface Props {
  /** Array of application log entries (newest first). */
  logs: AppLogEntry[];

  /** Callback to clear all log entries. */
  onClear: () => void;
}

/** Color mapping for log levels. */
const levelColors: Record<string, string> = {
    info: "var(--accent)",
    warn: "var(--warn)",
    error: "var(--danger)",
    success: "var(--delivered)",
};

/** Icon mapping for log levels. */
const levelIcons: Record<string, string> = {
    info: "ℹ",
    warn: "⚠",
    error: "✕",
    success: "✓",
};

/**
 * Application log viewer.
 *
 * Each row shows:
 * - Timestamp (`HH:MM:SS`)
 * - Colored level badge (INFO, WARN, ERROR, SUCCESS)
 * - Log message
 * - Optional detail text (e.g., error stack, config summary)
 */
export default function AppLog({ logs, onClear }: Props) {
    return (
        <div className="app-log">
            <div className="app-log-header">
                <span className="app-log-count">{logs.length} entries</span>
                <button className="app-log-clear" onClick={onClear}>Clear</button>
            </div>
            {logs.length === 0 ? (
                <div className="app-log-empty">No application logs yet. Run a simulation to see logs.</div>
            ) : (
                <div className="app-log-list">
                    {logs.map((log) => (
                        <div key={log.id} className="app-log-row">
                            <span className="app-log-time">{log.time}</span>
                            <span className="app-log-level" style={{ color: levelColors[log.level] }}>
                                {levelIcons[log.level]} {log.level.toUpperCase()}
                            </span>
                            <span className="app-log-message">{log.message}</span>
                            {log.detail && <span className="app-log-detail">{log.detail}</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
