import { useRef, useEffect } from "react";
import {
    Chart,
    DoughnutController,
    ArcElement,
    Legend,
} from "chart.js";
import type { MetricsResponse, SimulationEvent } from "../../types";

Chart.register(DoughnutController, ArcElement, Legend);

interface Props {
    metrics: MetricsResponse;
    events: SimulationEvent[];
}

export default function StatusChart({ metrics, events }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<Chart | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;
        const chart = new Chart(canvasRef.current, {
            type: "doughnut",
            data: {
                labels: ["Delivered", "In-Transit", "Dropped", "Expired"],
                datasets: [
                    {
                        data: [0, 0, 0, 0],
                        backgroundColor: ["#36d399", "#facc15", "#ef4444", "#6b7280"],
                        borderWidth: 0,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: "right",
                        labels: {
                            color: "#8b90a0",
                            font: { size: 10 },
                            boxWidth: 10,
                            padding: 6,
                        },
                    },
                },
            },
        });
        chartRef.current = chart;
        return () => {
            chart.destroy();
        };
    }, []);

    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;

        if (metrics.total_bundles > 0) {
            // Use final metrics
            const inTransit =
                metrics.total_bundles -
                metrics.delivered_bundles -
                metrics.dropped_bundles -
                metrics.expired_bundles;
            chart.data.datasets[0].data = [
                metrics.delivered_bundles,
                Math.max(0, inTransit),
                metrics.dropped_bundles,
                metrics.expired_bundles,
            ];
        } else {
            // Count from events
            let delivered = 0,
                dropped = 0,
                expired = 0,
                inTransit = 0;
            for (const e of events) {
                if (e.type === "BUNDLE_CREATE") inTransit++;
                else if (e.type === "BUNDLE_DELIVER") {
                    delivered++;
                    inTransit = Math.max(0, inTransit - 1);
                } else if (e.type === "BUNDLE_DROPPED") {
                    dropped++;
                    inTransit = Math.max(0, inTransit - 1);
                } else if (e.type === "BUNDLE_EXPIRE") {
                    expired++;
                    inTransit = Math.max(0, inTransit - 1);
                }
            }
            chart.data.datasets[0].data = [delivered, inTransit, dropped, expired];
        }
        chart.update("none");
    }, [metrics, events]);

    return (
        <div className="chart-card">
            <h3>Bundle Status</h3>
            <div className="chart-container">
                <canvas ref={canvasRef} />
            </div>
        </div>
    );
}
