import { useState, useMemo } from "react";
import type { ReactElement } from "react";
import type { SimulationEvent } from "../types";
import { Button, Badge, LogViewer } from "@omega-os/ui";
import type { LogLevel } from "@omega-os/ui";
import { List, Link, Unlink, Package, Send, Check, Clock, Trash2, ShieldAlert } from "lucide-react";

interface Props {
  events: SimulationEvent[];
}

const typeMeta: Record<string, { label: string; level: LogLevel; icon: ReactElement }> = {
    CONTACT_START: { label: "CONTACT", level: "info", icon: <Link size={12} aria-hidden /> },
    CONTACT_END: { label: "CONTACT", level: "debug", icon: <Unlink size={12} aria-hidden /> },
    BUNDLE_CREATE: { label: "CREATE", level: "info", icon: <Package size={12} aria-hidden /> },
    BUNDLE_TRANSFER: { label: "TRANSFER", level: "info", icon: <Send size={12} aria-hidden /> },
    BUNDLE_DELIVER: { label: "DELIVER", level: "info", icon: <Check size={12} aria-hidden /> },
    BUNDLE_EXPIRE: { label: "EXPIRE", level: "warn", icon: <Clock size={12} aria-hidden /> },
    BUNDLE_DROPPED: { label: "DROP", level: "error", icon: <Trash2 size={12} aria-hidden /> },
    INTEGRITY_FAIL: { label: "INTEGRITY", level: "error", icon: <ShieldAlert size={12} aria-hidden /> },
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
        return result;
    }, [events, activeFilter, searchText]);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <input
                    className="h-10 w-full rounded-ot-md border border-ot-border bg-ot-bg px-3 font-sans text-sm text-ot-text outline-none transition-shadow placeholder:text-ot-muted focus:border-navy"
                    style={{ flex: 1 }}
                    placeholder="Search events..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                />
                <span className="whitespace-nowrap text-xs text-ot-muted">{filtered.length} / {events.length}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
                <Button
                    variant={activeFilter === "ALL" ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setActiveFilter("ALL")}
                    icon={<List size={12} aria-hidden />}
                >
                    All <Badge tone={activeFilter === "ALL" ? "navy" : "grey"}>{events.length}</Badge>
                </Button>
                {eventTypes.map((t) => {
                    const meta = typeMeta[t];
                    return (
                        <Button
                            key={t}
                            variant={activeFilter === t ? "primary" : "secondary"}
                            size="sm"
                            onClick={() => setActiveFilter(activeFilter === t ? "ALL" : t)}
                            icon={meta?.icon ? <>{meta.icon}</> : undefined}
                        >
                            {meta?.label || t} <Badge tone={activeFilter === t ? "navy" : "grey"}>{typeCounts[t]}</Badge>
                        </Button>
                    );
                })}
            </div>
            <LogViewer
                lines={filtered.map((evt, i) => ({
                    id: `${evt.time}-${evt.bundle_id}-${i}`,
                    level: typeMeta[evt.type]?.level ?? "info",
                    text: `[${typeMeta[evt.type]?.label ?? evt.type}] ${getEventDetail(evt)}`,
                    time: `t=${evt.time.toFixed(1)}s`,
                }))}
            />
        </div>
    );
}
