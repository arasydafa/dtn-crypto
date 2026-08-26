import type { MetricsResponse, SimulationEvent } from "../types";

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

  return (
    <div className="chart-card" style={{ overflow: "auto" }}>
      <h3>Network Statistics</h3>
      <div className="stats-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="stat-item">
          <div className="stat-value">{metrics.total_bundles}</div>
          <div className="stat-label">Total Bundles</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{metrics.total_transfers}</div>
          <div className="stat-label">Total Transfers</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{(metrics.delivery_ratio * 100).toFixed(1)}%</div>
          <div className="stat-label">Delivery Ratio</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{metrics.avg_latency_seconds.toFixed(2)}s</div>
          <div className="stat-label">Avg Latency</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{avgHops.toFixed(1)}</div>
          <div className="stat-label">Avg Hops</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{contacts.length}</div>
          <div className="stat-label">Total Contacts</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{uniquePairs}</div>
          <div className="stat-label">Unique Pairs</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{metrics.integrity_failures}</div>
          <div className="stat-label">Integrity Fails</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{metrics.avg_encrypt_overhead_ms.toFixed(1)}ms</div>
          <div className="stat-label">Avg Encrypt</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{metrics.avg_decrypt_overhead_ms.toFixed(1)}ms</div>
          <div className="stat-label">Avg Decrypt</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{metrics.avg_transmission_time_ms.toFixed(1)}ms</div>
          <div className="stat-label">Avg TX Time</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{(metrics.bundle_drop_rate * 100).toFixed(1)}%</div>
          <div className="stat-label">Drop Rate</div>
        </div>
      </div>
    </div>
  );
}
