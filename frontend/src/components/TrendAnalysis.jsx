import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export default function TrendAnalysis({ data }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const hasData = data && data.daily && data.daily.length > 0;

  useEffect(() => {
    if (!hasData) return;
    if (chartRef.current) chartRef.current.destroy();

    const labels = data.daily.map(d => {
      const date = new Date(d.day + 'T00:00:00');
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    });
    const avgTemps = data.daily.map(d => d.avgTemp);
    const avgHums = data.daily.map(d => d.avgHumidity);

    const anomalyIndices = new Set((data.anomalies || []).map(a => {
      return data.daily.findIndex(d => d.day === a.day);
    }).filter(i => i >= 0));

    const pointColors = avgTemps.map((_, i) => anomalyIndices.has(i) ? '#ff4757' : 'rgba(245, 87, 108, 0.8)');
    const pointRadii = avgTemps.map((_, i) => anomalyIndices.has(i) ? 6 : 2);

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Avg Temp (°C)',
            data: avgTemps,
            borderColor: '#f5576c',
            backgroundColor: 'rgba(245, 87, 108, 0.1)',
            yAxisID: 'yTemp',
            tension: 0.3,
            fill: true,
            pointBackgroundColor: pointColors,
            pointRadius: pointRadii,
          },
          {
            label: 'Avg Humidity (%)',
            data: avgHums,
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
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            callbacks: {
              afterBody(items) {
                const idx = items[0].dataIndex;
                if (anomalyIndices.has(idx)) return ['⚠ Anomaly detected'];
                return [];
              },
            },
          },
        },
        scales: {
          x: { ticks: { color: 'rgba(255,255,255,0.5)', maxTicksLimit: 10 }, grid: { color: 'rgba(255,255,255,0.05)' } },
          yTemp: { position: 'left', ticks: { color: '#f5576c' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          yHum: { position: 'right', ticks: { color: '#4facfe' }, grid: { drawOnChartArea: false } },
        },
      },
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [hasData, data]);

  if (!hasData) {
    return <div className="rm-chart-empty">No trend data available</div>;
  }

  const anomalyCount = (data.anomalies || []).length;

  return (
    <div className="rm-trend">
      <div className="rm-chart-wrapper"><canvas ref={canvasRef} /></div>
      {anomalyCount > 0 && (
        <div className="rm-anomalies">
          <h4>Anomalies ({anomalyCount})</h4>
          <div className="rm-anomaly-list">
            {data.anomalies.map((a, i) => (
              <div key={i} className="rm-anomaly-item">
                <span className="rm-anomaly-date">{new Date(a.day + 'T00:00:00').toLocaleDateString()}</span>
                <span className="rm-anomaly-val">{a.avgTemp.toFixed(1)}°C</span>
                <span className="rm-anomaly-dev">σ {a.deviation}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
