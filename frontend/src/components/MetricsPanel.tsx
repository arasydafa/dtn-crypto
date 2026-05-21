import { useState } from "react";
import type { MetricsResponse, SimulationEvent } from "../types";
import type { AppLogEntry } from "../hooks/useSimulation";
import DeliveryGauge from "./charts/DeliveryGauge";
import LatencyChart from "./charts/LatencyChart";
import CryptoChart from "./charts/CryptoChart";
import StatusChart from "./charts/StatusChart";
import EventLog from "./EventLog";
import AppLog from "./AppLog";

interface Props {
    metrics: MetricsResponse;
    events: SimulationEvent[];
    open: boolean;
    appLogs: AppLogEntry[];
    onClearAppLogs: () => void;
}

export default function MetricsPanel({ metrics, events, open, appLogs, onClearAppLogs }: Props) {
    const [tab, setTab] = useState<"charts" | "events" | "applog">("charts");

    let delivered = 0;
    let total = 0;
    for (const e of events) {
        if (e.type === "BUNDLE_CREATE") total++;
        if (e.type === "BUNDLE_DELIVER") delivered++;
    }

    if (!open) {
        const cryptoOverhead = metrics.avg_encrypt_overhead_ms + metrics.avg_decrypt_overhead_ms;
        return (
            <div className="bottom-summary">
                <span className="bottom-summary-item">
                    <strong>{metrics.delivered_bundles}</strong> / {metrics.total_bundles} delivered
                </span>
                <span className="bottom-summary-item">
                    Ratio: <strong>{(metrics.delivery_ratio * 100).toFixed(1)}%</strong>
                </span>
                <span className="bottom-summary-item">
                    Latency: <strong>{metrics.avg_latency_seconds.toFixed(1)}s</strong>
                </span>
                <span className="bottom-summary-item">
                    Crypto: <strong>{cryptoOverhead.toFixed(0)}ms</strong>
                </span>
                <span className="bottom-summary-item">
                    Dropped: <strong>{metrics.dropped_bundles}</strong>
                </span>
                <span className="bottom-summary-item">
                    Expired: <strong>{metrics.expired_bundles}</strong>
                </span>
                <span className="bottom-summary-item">
                    Events: <strong>{events.length}</strong>
                </span>
            </div>
        );
    }

    return (
        <>
            <div className="bottom-tabs">
                <button
                    className={"bottom-tab" + (tab === "charts" ? " active" : "")}
                    onClick={() => setTab("charts")}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                    Charts
                </button>
                <button
                    className={"bottom-tab" + (tab === "events" ? " active" : "")}
                    onClick={() => setTab("events")}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                    Sim Events ({events.length})
                </button>
                <button
                    className={"bottom-tab" + (tab === "applog" ? " active" : "")}
                    onClick={() => setTab("applog")}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                    </svg>
                    App Log ({appLogs.length})
                </button>
            </div>

            <div className="bottom-content">
                {tab === "charts" && (
                    <div className="bottom-charts">
                        <DeliveryGauge metrics={metrics} delivered={delivered} total={total} />
                        <LatencyChart events={events} />
                        <CryptoChart metrics={metrics} />
                        <StatusChart metrics={metrics} events={events} />
                    </div>
                )}
                {tab === "events" && <EventLog events={events} />}
                {tab === "applog" && <AppLog logs={appLogs} onClear={onClearAppLogs} />}
            </div>
        </>
    );
}
