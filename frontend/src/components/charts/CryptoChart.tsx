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

interface Props {
    metrics: MetricsResponse;
}

export default function CryptoChart({ metrics }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<Chart | null>(null);

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
