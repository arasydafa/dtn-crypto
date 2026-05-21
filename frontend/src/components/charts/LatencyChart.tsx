import { useRef, useEffect } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
} from "chart.js";
import type { SimulationEvent } from "../../types";

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler);

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
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
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

    const deliveries = events.filter(
      (e) => e.type === "BUNDLE_DELIVER" && e.event_data?.latency != null,
    );
    const newLatencies = deliveries.map(
      (e) => e.event_data.latency as number,
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
