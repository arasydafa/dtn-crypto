import { useState, useMemo } from "react";
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
            return `${evt.node_from} ↔ ${evt.node_to} in range`;
        case "CONTACT_END":
            return `${evt.node_from} ↔ ${evt.node_to} out of range`;
        case "BUNDLE_CREATE":
            return `Bundle ${evt.bundle_id.slice(0, 8)} created at ${evt.node_from}`;
        case "BUNDLE_TRANSFER":
            return `Bundle ${evt.bundle_id.slice(0, 8)} forwarded: ${evt.node_from} → ${evt.node_to}`;
        case "BUNDLE_DELIVER":
            return `Bundle ${evt.bundle_id.slice(0, 8)} delivered to ${evt.node_to} (latency: ${evt.latency?.toFixed(1) ?? evt.event_data?.latency != null ? (evt.event_data.latency as number).toFixed(1) : "?"}s)`;
        case "BUNDLE_EXPIRE":
            return `Bundle ${evt.bundle_id.slice(0, 8)} expired (TTL reached)`;
        case "BUNDLE_DROPPED":
            return `Bundle ${evt.bundle_id.slice(0, 8)} dropped (buffer full or hop limit)`;
        case "INTEGRITY_FAIL":
            return `Bundle ${evt.bundle_id.slice(0, 8)} FAILED integrity check`;
        default:
            return JSON.stringify(evt.event_data);
    }
}

export default function EventLog({ events }: Props) {
    const [activeFilter, setActiveFilter] = useState<string>("ALL");
    const [searchText, setSearchText] = useState("");

    const eventTypes = useMemo(() => {
        const types = new Set<string>();
        for (const e of events) types.add(e.type);
        return Array.from(types).sort();
    }, [events]);

    const typeCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const e of events) {
            counts[e.type] = (counts[e.type] || 0) + 1;
        }
        return counts;
    }, [events]);

    const filtered = useMemo(() => {
        let result = events;
        if (activeFilter !== "ALL") {
            result = result.filter((e) => e.type === activeFilter);
        }
        if (searchText) {
            const q = searchText.toLowerCase();
            result = result.filter((e) =>
                e.bundle_id.toLowerCase().includes(q) ||
                e.node_from.toLowerCase().includes(q) ||
                e.node_to.toLowerCase().includes(q) ||
                getEventDetail(e).toLowerCase().includes(q)
            );
        }
        return [...result].reverse();
    }, [events, activeFilter, searchText]);

    return (
        <div className="app-log">
            <div className="app-log-header" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                        className="preset-input"
                        style={{ flex: 1 }}
                        placeholder="Search events..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                    />
                    <span className="app-log-count">{filtered.length} / {events.length}</span>
                </div>
                <div className="bundle-filter-chips">
                    <button
                        className={`bundle-filter-chip${activeFilter === "ALL" ? " active" : ""}`}
                        onClick={() => setActiveFilter("ALL")}
                    >
                        All <span className="chip-count">{events.length}</span>
                    </button>
                    {eventTypes.map((t) => {
                        const cfg = typeConfig[t];
                        return (
                            <button
                                key={t}
                                className={`bundle-filter-chip${activeFilter === t ? " active" : ""}`}
                                onClick={() => setActiveFilter(activeFilter === t ? "ALL" : t)}
                            >
                                {cfg?.icon} {cfg?.label || t} <span className="chip-count">{typeCounts[t]}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="event-log">
                {filtered.length === 0 ? (
                    <div className="event-log-empty">No events match the filter.</div>
                ) : (
                    filtered.map((evt, i) => {
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
        </div>
    );
}
