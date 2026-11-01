import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const ANOMALY = '#ff4757';
const TEMP = '#f5576c';
const HUM = '#4facfe';

export default function LineChart({ labels, temp, hum, anomalies = new Set(), height = 300 }) {
  const pointRadius = temp.map((_, i) => (anomalies.has(i) ? 6 : 0));
  const pointBackgroundColor = temp.map((_, i) => (anomalies.has(i) ? ANOMALY : TEMP));

  const data = {
    labels,
    datasets: [
      {
        label: 'Temperatura (°C)',
        data: temp,
        borderColor: TEMP,
        backgroundColor: 'rgba(245, 87, 108, 0.1)',
        yAxisID: 'yTemp',
        tension: 0.3,
        fill: true,
        pointRadius,
        pointBackgroundColor,
      },
      {
        label: 'Humedad (%)',
        data: hum,
        borderColor: HUM,
        backgroundColor: 'rgba(79, 172, 254, 0.1)',
        yAxisID: 'yHum',
        tension: 0.3,
        fill: true,
        pointRadius: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: 'rgba(255,255,255,0.7)', boxWidth: 12 } },
      tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', titleColor: '#fff', bodyColor: '#fff' },
    },
    scales: {
      x: {
        ticks: { color: 'rgba(255,255,255,0.5)', maxTicksLimit: 8 },
        grid: { color: 'rgba(255,255,255,0.05)' },
      },
      yTemp: { position: 'left', ticks: { color: TEMP }, grid: { color: 'rgba(255,255,255,0.05)' } },
      yHum: { position: 'right', ticks: { color: HUM }, grid: { drawOnChartArea: false } },
    },
  };

  return (
    <div style={{ height }}>
      <Line data={data} options={options} />
    </div>
  );
}
