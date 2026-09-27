/**
 * @module components/MetricsPanel
 * @description Bottom panel — OmegaOS phase 3.
 *
 * Tab bar uses @omega-os/ui Tabs; collapsed summary uses Tailwind ot tokens.
 * Chart cards keep their Chart.js internals (canvas logic untouched).
 */

import { useState } from "react";
import type { MetricsResponse, SimulationEvent } from "../types";
import type { AppLogEntry } from "../hooks/useSimulation";
import { Tabs } from "@omega-os/ui";
import { Activity, List, FileText } from "lucide-react";
import DeliveryGauge from "./charts/DeliveryGauge";
import LatencyChart from "./charts/LatencyChart";
import CryptoChart from "./charts/CryptoChart";
import StatusChart from "./charts/StatusChart";
import HopDistributionChart from "./charts/HopDistributionChart";
import NetworkStats from "./NetworkStats";
import EventLog from "./EventLog";
import AppLog from "./AppLog";

/** Props for the MetricsPanel component. */
interface Props {
  /** Current simulation metrics. */
  metrics: MetricsResponse;

  /** Array of all simulation events. */
  events: SimulationEvent[];

  /** Whether the panel is currently open (expanded). */
  open: boolean;

  /** Array of application log entries. */
  appLogs: AppLogEntry[];

  /** Callback to clear all application log entries. */
  onClearAppLogs: () => void;
}

/**
 * Bottom metrics panel with tabbed interface.
 *
 * **Collapsed state**: horizontal summary bar with key metrics.
 * **Expanded state**: three tabs (Charts / Sim Events / App Log).
 */
export default function MetricsPanel({ metrics, events, open, appLogs, onClearAppLogs }: Props) {
    const [tab, setTab] = useState("charts");

    let delivered = 0;
    let total = 0;
    for (const e of events) {
        if (e.type === "BUNDLE_CREATE") total++;
        if (e.type === "BUNDLE_DELIVER") delivered++;
    }

    if (!open) {
        const cryptoOverhead = metrics.avg_encrypt_overhead_ms + metrics.avg_decrypt_overhead_ms;
        const items: Array<[string, string]> = [
            [`${metrics.delivered_bundles} / ${metrics.total_bundles}`, "delivered"],
            [`${(metrics.delivery_ratio * 100).toFixed(1)}%`, "Ratio"],
            [`${metrics.avg_latency_seconds.toFixed(1)}s`, "Latency"],
            [`${cryptoOverhead.toFixed(0)}ms`, "Crypto"],
            [`${metrics.dropped_bundles}`, "Dropped"],
            [`${metrics.expired_bundles}`, "Expired"],
            [`${events.length}`, "Events"],
        ];
        return (
            <div className="flex w-full items-center overflow-x-auto text-xs text-ot-muted">
                {items.map(([value, label], i) => (
                    <span
                        key={label}
                        className={`flex items-center gap-1 whitespace-nowrap px-4 ${i > 0 ? "border-l border-ot-border" : ""}`}
                    >
                        <strong className="font-bold tabular-nums text-ot-text">{value}</strong> {label}
                    </span>
                ))}
            </div>
        );
    }

    return (
        <>
            <div className="flex-shrink-0 border-b border-ot-border px-4 pt-2">
                <Tabs
                    value={tab}
                    onChange={setTab}
                    label="Bottom panel"
                    tabs={[
                        { id: "charts", label: "Charts", icon: <Activity size={14} aria-hidden /> },
                        { id: "events", label: `Sim Events (${events.length})`, icon: <List size={14} aria-hidden /> },
                        { id: "applog", label: `App Log (${appLogs.length})`, icon: <FileText size={14} aria-hidden /> },
                    ]}
                />
            </div>

            <div className="bottom-content">
                {tab === "charts" && (
                    <div className="bottom-charts" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                        <DeliveryGauge metrics={metrics} delivered={delivered} total={total} />
                        <LatencyChart events={events} />
                        <CryptoChart metrics={metrics} />
                        <StatusChart metrics={metrics} events={events} />
                        <HopDistributionChart metrics={metrics} />
                        <NetworkStats metrics={metrics} events={events} />
                    </div>
                )}
                {tab === "events" && <div className="px-4 py-2"><EventLog events={events} /></div>}
                {tab === "applog" && <div className="px-4 py-2"><AppLog logs={appLogs} onClear={onClearAppLogs} /></div>}
            </div>
        </>
    );
}
