import type { MetricsResponse, SimulationEvent } from "../types";
import { Card } from "@omega-os/ui";

interface Props {
  metrics: MetricsResponse;
  events: SimulationEvent[];
}

export default function NetworkStats({ metrics, events }: Props) {
  const transfers = events.filter((e) => e.type === "BUNDLE_TRANSFER");
  const contacts = events.filter((e) => e.type === "CONTACT_START");

  const avgHops = metrics.total_bundles > 0
    ? Object.entries(metrics.hop_count_distribution).reduce<number>((sum, [k, v]) => sum + Number(k) * Number(v), 0) / metrics.total_bundles
    : 0;

  const uniquePairs = new Set(transfers.map((e) => `${e.node_from}->${e.node_to}`)).size;

  const stats: Array<[string | number, string]> = [
    [metrics.total_bundles, "Total Bundles"],
    [metrics.total_transfers, "Total Transfers"],
    [`${(metrics.delivery_ratio * 100).toFixed(1)}%`, "Delivery Ratio"],
    [`${metrics.avg_latency_seconds.toFixed(2)}s`, "Avg Latency"],
    [avgHops.toFixed(1), "Avg Hops"],
    [contacts.length, "Total Contacts"],
    [uniquePairs, "Unique Pairs"],
    [metrics.integrity_failures, "Integrity Fails"],
    [`${metrics.avg_encrypt_overhead_ms.toFixed(1)}ms`, "Avg Encrypt"],
    [`${metrics.avg_decrypt_overhead_ms.toFixed(1)}ms`, "Avg Decrypt"],
    [`${metrics.avg_transmission_time_ms.toFixed(1)}ms`, "Avg TX Time"],
    [`${(metrics.bundle_drop_rate * 100).toFixed(1)}%`, "Drop Rate"],
  ];

  return (
    <Card className="overflow-auto">
      <h3 className="mb-1.5 text-[10px] uppercase tracking-wider text-ot-muted">Network Statistics</h3>
      <div className="grid grid-cols-2 gap-2">
        {stats.map(([value, label]) => (
          <div key={label} className="rounded-ot-md bg-ot-bg px-3 py-2.5 text-center">
            <div className="text-xl font-bold text-navy-text">{value}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-ot-muted">{label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
