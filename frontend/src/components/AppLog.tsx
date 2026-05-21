import type { AppLogEntry } from "../hooks/useSimulation";

interface Props {
    logs: AppLogEntry[];
    onClear: () => void;
}

const levelColors: Record<string, string> = {
    info: "var(--accent)",
    warn: "var(--warn)",
    error: "var(--danger)",
    success: "var(--delivered)",
};

const levelIcons: Record<string, string> = {
    info: "ℹ",
    warn: "⚠",
    error: "✕",
    success: "✓",
};

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
