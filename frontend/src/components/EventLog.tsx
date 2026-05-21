import type { SimulationEvent } from "../types";

interface Props {
    events: SimulationEvent[];
}

const typeConfig: Record<string, { label: string; color: string; icon: string }> = {
    CONTACT_START: { label: "CONTACT", color: "var(--active)", icon: "🔗" },
    CONTACT_END: { label: "CONTACT", color: "var(--idle)", icon: "❌" },
    BUNDLE_CREATE: { label: "CREATE", color: "var(--accent2)", icon: "📦" },
    BUNDLE_TRANSFER: { label: "TRANSFER", color: "var(--warn)", icon: "📤" },
    BUNDLE_DELIVER: { label: "DELIVER", color: "var(--delivered)", icon: "✅" },
    BUNDLE_EXPIRE: { label: "EXPIRE", color: "var(--danger)", icon: "⏰" },
    BUNDLE_DROPPED: { label: "DROP", color: "var(--danger)", icon: "🗑" },
    INTEGRITY_FAIL: { label: "INTEGRITY", color: "var(--danger)", icon: "🔒" },
};

function getEventDetail(evt: SimulationEvent): string {
    switch (evt.type) {
        case "CONTACT_START":
            return `Nodes ${evt.node_from} and ${evt.node_to} entered communication range`;
        case "CONTACT_END":
            return `Nodes ${evt.node_from} and ${evt.node_to} left communication range`;
        case "BUNDLE_CREATE":
            return `Bundle ${evt.bundle_id} created at ${evt.node_from}`;
        case "BUNDLE_TRANSFER":
            return `Bundle ${evt.bundle_id} forwarded: ${evt.node_from} → ${evt.node_to}`;
        case "BUNDLE_DELIVER":
            return `Bundle ${evt.bundle_id} delivered to ${evt.node_to} (latency: ${evt.latency?.toFixed(1) ?? "?"}s)`;
        case "BUNDLE_EXPIRE":
            return `Bundle ${evt.bundle_id} expired (TTL reached)`;
        case "BUNDLE_DROPPED":
            return `Bundle ${evt.bundle_id} dropped (buffer full or hop limit)`;
        case "INTEGRITY_FAIL":
            return `Bundle ${evt.bundle_id} FAILED integrity check!`;
        default:
            return JSON.stringify(evt);
    }
}

export default function EventLog({ events }: Props) {
    const reversed = [...events].reverse();

    return (
        <div className="event-log">
            {reversed.length === 0 ? (
                <div className="event-log-empty">No simulation events yet. Run a simulation to see the event log.</div>
            ) : (
                reversed.map((evt, i) => {
                    const cfg = typeConfig[evt.type] || { label: evt.type, color: "var(--text2)", icon: "•" };
                    return (
                        <div key={i} className="event-log-row">
                            <span className="event-log-time">t={evt.time.toFixed(1)}s</span>
                            <span className="event-log-badge" style={{ color: cfg.color, borderColor: cfg.color }}>
                                {cfg.icon} {cfg.label}
                            </span>
                            <span className="event-log-detail">{getEventDetail(evt)}</span>
                        </div>
                    );
                })
            )}
        </div>
    );
}
