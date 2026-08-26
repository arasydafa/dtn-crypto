/**
 * @module components/charts/CryptoChart
 * @description Bar chart showing crypto and transmission overhead in milliseconds.
 *
 * Displays three bars: encrypt overhead, decrypt overhead, and transmission
 * time. Values are sourced from the aggregated metrics response.
 *
 * @example
 * ```tsx
 * <CryptoChart metrics={metrics} />
 * ```
 */

import { useRef, useEffect } from "react";
import {
    Chart,
    BarController,
    BarElement,
    LinearScale,
    CategoryScale,
} from "chart.js";
import type { MetricsResponse } from "../../types";

Chart.register(BarController, BarElement, LinearScale, CategoryScale);

/** Props for the CryptoChart component. */
interface Props {
  /** Current simulation metrics with crypto overhead values. */
  metrics: MetricsResponse;
}

/**
 * Crypto overhead bar chart.
 *
 * Three bars:
 * - **Encrypt** (blue) — average time to encrypt at source
 * - **Decrypt** (green) — average time to decrypt at destination
 * - **Transmit** (orange) — average transmission time per hop
 */
export default function CryptoChart({ metrics }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<Chart | null>(null);

    /** Initialize the Chart.js bar chart on mount. */
    useEffect(() => {
        if (!canvasRef.current) return;
        const chart = new Chart(canvasRef.current, {
            type: "bar",
            data: {
                labels: ["Encrypt", "Decrypt", "Transmit"],
                datasets: [
                    {
                        data: [0, 0, 0],
                        backgroundColor: ["#4f8cff", "#36d399", "#f59e42"],
                        borderRadius: 4,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        display: true,
                        ticks: { color: "#8b90a0", font: { size: 10 } },
                        grid: { display: false },
                    },
                    y: {
                        display: true,
                        ticks: { color: "#8b90a0", font: { size: 10 } },
                        grid: { color: "#2d3140" },
                    },
                },
            },
        });
        chartRef.current = chart;
        return () => {
            chart.destroy();
        };
    }, []);

    /** Update bar data when metrics change. */
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;
        chart.data.datasets[0].data = [
            metrics.avg_encrypt_overhead_ms,
            metrics.avg_decrypt_overhead_ms,
            metrics.avg_transmission_time_ms,
        ];
        chart.update();
    }, [metrics]);

    return (
        <div className="chart-card">
            <h3>Crypto Overhead (ms)</h3>
            <div className="chart-container">
                <canvas ref={canvasRef} />
            </div>
        </div>
    );
}
