import { useRef, useEffect } from "react";
import {
  Chart,
  BarController,
  BarElement,
  LinearScale,
  CategoryScale,
  Tooltip,
} from "chart.js";
import type { MetricsResponse } from "../../types";

Chart.register(BarController, BarElement, LinearScale, CategoryScale, Tooltip);

interface Props {
  metrics: MetricsResponse;
}

export default function HopDistributionChart({ metrics }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const chart = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: [] as string[],
        datasets: [{
          data: [],
          backgroundColor: "#4f8cff",
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: "rgba(18, 20, 28, 0.95)",
            titleColor: "#e5e7f0",
            bodyColor: "#8b8fa5",
            borderColor: "#2a2d3e",
            borderWidth: 1,
            callbacks: {
              label: (item) => `${item.parsed.y} bundles`,
            },
          },
        },
        scales: {
          x: {
            display: true,
            title: { display: true, text: "Hop Count", color: "#8b90a0", font: { size: 10 } },
            ticks: { color: "#8b90a0", font: { size: 10 } },
            grid: { display: false },
          },
          y: {
            display: true,
            title: { display: true, text: "Bundles", color: "#8b90a0", font: { size: 10 } },
            ticks: { color: "#8b90a0", font: { size: 10 }, stepSize: 1 },
            grid: { color: "#2d3140" },
          },
        },
      },
    });
    chartRef.current = chart;
    return () => { chart.destroy(); };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const dist = metrics.hop_count_distribution || {};
    const keys = Object.keys(dist).sort((a, b) => Number(a) - Number(b));
    chart.data.labels = keys.map((k) => `Hop ${k}`);
    chart.data.datasets[0].data = keys.map((k) => dist[k]);
    chart.update("none");
  }, [metrics]);

  return (
    <div className="chart-card">
      <h3>Hop Count Distribution</h3>
      <div className="chart-container">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
