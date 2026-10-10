export default function DailyStats({ stats }) {
  if (!stats || stats.error) return <div className="rm-chart-empty">{stats?.error || 'No data'}</div>;

  return (
    <div className="rm-stats-grid">
      <div className="rm-stat-card rm-stat-temp">
        <div className="rm-stat-label">Temperature</div>
        <div className="rm-stat-row"><span className="rm-stat-key">Min</span><span className="rm-stat-val">{stats.minTemp}°C</span></div>
        <div className="rm-stat-row"><span className="rm-stat-key">Max</span><span className="rm-stat-val">{stats.maxTemp}°C</span></div>
        <div className="rm-stat-row"><span className="rm-stat-key">Avg</span><span className="rm-stat-val">{stats.avgTemp}°C</span></div>
      </div>
      <div className="rm-stat-card rm-stat-hum">
        <div className="rm-stat-label">Humidity</div>
        <div className="rm-stat-row"><span className="rm-stat-key">Min</span><span className="rm-stat-val">{stats.minHumidity}%</span></div>
        <div className="rm-stat-row"><span className="rm-stat-key">Max</span><span className="rm-stat-val">{stats.maxHumidity}%</span></div>
        <div className="rm-stat-row"><span className="rm-stat-key">Avg</span><span className="rm-stat-val">{stats.avgHumidity}%</span></div>
      </div>
      <div className="rm-stat-card rm-stat-samples">
        <div className="rm-stat-label">Samples</div>
        <div className="rm-stat-big">{stats.sampleCount}</div>
      </div>
    </div>
  );
}
