import { useRef, useEffect } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
} from "chart.js";
import type { SimulationEvent } from "../../types";

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

interface Props {
  events: SimulationEvent[];
}

export default function LatencyChart({ events }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const latenciesRef = useRef<number[]>([]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const chart = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: [] as string[],
        datasets: [
          {
            data: [],
            borderColor: "#4f8cff",
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: "#4f8cff",
            pointBorderColor: "#fff",
            pointBorderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: "rgba(18, 20, 28, 0.95)",
            titleColor: "#e5e7f0",
            bodyColor: "#8b8fa5",
            borderColor: "#2a2d3e",
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            callbacks: {
              title: (items) => `Bundle #${items[0].label}`,
              label: (item) => `Latency: ${(item.parsed.y ?? 0).toFixed(2)}s`,
            },
          },
        },
        scales: {
          x: {
            display: true,
            title: { display: true, text: "Bundle #", color: "#8b90a0", font: { size: 10 } },
            ticks: { color: "#8b90a0", font: { size: 10 }, maxTicksLimit: 10 },
            grid: { color: "#2d3140" },
          },
          y: {
            display: true,
            title: { display: true, text: "Seconds", color: "#8b90a0", font: { size: 10 } },
            ticks: { color: "#8b90a0", font: { size: 10 } },
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

    const deliveries = events.filter(
      (e) => e.type === "BUNDLE_DELIVER" && (e.latency != null || e.event_data?.latency != null),
    );
    const newLatencies = deliveries.map(
      (e) => (e.latency ?? e.event_data?.latency) as number,
    );

    if (newLatencies.length === latenciesRef.current.length) return;

    latenciesRef.current = newLatencies;
    const labels = newLatencies.map((_, i) => String(i + 1));
    const sliceStart = Math.max(0, newLatencies.length - 50);
    chart.data.labels = labels.slice(sliceStart);
    chart.data.datasets[0].data = newLatencies.slice(sliceStart);
    chart.update("none");
  }, [events]);

  return (
    <div className="chart-card">
      <h3>Latency Over Time</h3>
      <div className="chart-container">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
