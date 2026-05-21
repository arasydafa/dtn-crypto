import type { MetricsResponse } from "../../types";

interface Props {
  metrics: MetricsResponse;
  delivered: number;
  total: number;
}

export default function DeliveryGauge({ metrics, delivered, total }: Props) {
  const ratio =
    metrics.total_bundles > 0
      ? (metrics.delivery_ratio * 100).toFixed(1)
      : total > 0
        ? ((delivered / total) * 100).toFixed(1)
        : "--";

  return (
    <div className="chart-card">
      <h3>Delivery Ratio</h3>
      <div className="gauge-wrap">
        <div>
          <div className="gauge-value">{ratio === "--" ? ratio : ratio + "%"}</div>
          <div className="gauge-label">of bundles delivered</div>
        </div>
      </div>
    </div>
  );
}
