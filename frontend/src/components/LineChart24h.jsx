import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export default function LineChart24h({ data }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!data || data.length === 0) return;
    if (chartRef.current) chartRef.current.destroy();

    const labels = data.map(d => new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const temps = data.map(d => d.temperature);
    const hums = data.map(d => d.humidity);

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Temperature (°C)',
            data: temps,
            borderColor: '#f5576c',
            backgroundColor: 'rgba(245, 87, 108, 0.1)',
            yAxisID: 'yTemp',
            tension: 0.3,
            fill: true,
            pointRadius: 0,
          },
          {
            label: 'Humidity (%)',
            data: hums,
            borderColor: '#4facfe',
            backgroundColor: 'rgba(79, 172, 254, 0.1)',
            yAxisID: 'yHum',
            tension: 0.3,
            fill: true,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: 'rgba(255,255,255,0.7)' } },
          tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', titleColor: '#fff', bodyColor: '#fff' },
        },
        scales: {
          x: { ticks: { color: 'rgba(255,255,255,0.5)', maxTicksLimit: 8 }, grid: { color: 'rgba(255,255,255,0.05)' } },
          yTemp: { position: 'left', ticks: { color: '#f5576c' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          yHum: { position: 'right', ticks: { color: '#4facfe' }, grid: { drawOnChartArea: false } },
        },
      },
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [data]);

  if (!data || data.length === 0) return <div className="rm-chart-empty">No data for this period</div>;

  return <div className="rm-chart-wrapper"><canvas ref={canvasRef} /></div>;
}
