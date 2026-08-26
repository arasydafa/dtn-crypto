/**
 * @module components/charts/DeliveryGauge
 * @description Delivery ratio gauge display showing the percentage of bundles delivered.
 *
 * Uses the `delivery_ratio` from metrics if available, otherwise computes
 * from the delivered/total counts passed as props. Displays as a large
 * percentage value with a label.
 *
 * @example
 * ```tsx
 * <DeliveryGauge metrics={metrics} delivered={5} total={10} />
 * ```
 */

import type { MetricsResponse } from "../../types";

/** Props for the DeliveryGauge component. */
interface Props {
  /** Current simulation metrics. */
  metrics: MetricsResponse;

  /** Number of delivered bundles (live count from events). */
  delivered: number;

  /** Total number of bundles created (live count from events). */
  total: number;
}

/**
 * Delivery ratio gauge component.
 *
 * Displays a large percentage value indicating what fraction of bundles
 * were successfully delivered. Falls back to live event counts if metrics
 * haven't been populated yet.
 */
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
