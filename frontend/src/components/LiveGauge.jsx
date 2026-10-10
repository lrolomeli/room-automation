export default function LiveGauge({ data, loading }) {
  if (loading) return <div className="rm-loading"><div className="rm-spinner" /><p>Connecting to sensor...</p></div>;

  if (!data) {
    return (
      <div className="rm-live">
        <div className="rm-stale-banner">⚠ Sensor unreachable — no readings stored yet</div>
        <div className="rm-gauges">
          <div className="rm-gauge rm-gauge-offline">
            <div className="rm-gauge-label">Temperature</div>
            <div className="rm-gauge-value">--°C</div>
            <div className="rm-gauge-bar"><div className="rm-gauge-fill" style={{ width: '0%' }} /></div>
          </div>
          <div className="rm-gauge rm-gauge-offline">
            <div className="rm-gauge-label">Humidity</div>
            <div className="rm-gauge-value">--%</div>
            <div className="rm-gauge-bar"><div className="rm-gauge-fill" style={{ width: '0%' }} /></div>
          </div>
        </div>
        <div className="rm-status">
          <span className="rm-status-dot rm-status-err" />
          <span>Offline</span>
        </div>
      </div>
    );
  }

  const tempColor = data.temperature > 35 ? '#ff4757' : data.temperature > 28 ? '#ffa502' : data.temperature > 20 ? '#2ed573' : '#1e90ff';
  const humColor = data.humidity > 80 ? '#ff6b81' : data.humidity > 60 ? '#ffa502' : '#2ed573';
  const isStale = data.status === 'stale';

  return (
    <div className="rm-live">
      {isStale && <div className="rm-stale-banner">⚠ Sensor unreachable — showing last reading</div>}
      <div className="rm-gauges">
        <div className="rm-gauge" style={{ '--gauge-color': tempColor }}>
          <div className="rm-gauge-label">Temperature</div>
          <div className="rm-gauge-value">{Number(data.temperature).toFixed(1)}°{data.unit === 'celsius' ? 'C' : 'F'}</div>
          <div className="rm-gauge-bar"><div className="rm-gauge-fill" style={{ width: `${Math.min(100, ((data.temperature + 10) / 60) * 100)}%`, background: tempColor }} /></div>
        </div>
        <div className="rm-gauge" style={{ '--gauge-color': humColor }}>
          <div className="rm-gauge-label">Humidity</div>
          <div className="rm-gauge-value">{Number(data.humidity).toFixed(1)}%</div>
          <div className="rm-gauge-bar"><div className="rm-gauge-fill" style={{ width: `${Math.min(100, data.humidity)}%`, background: humColor }} /></div>
        </div>
      </div>
      <div className="rm-status">
        <span className={`rm-status-dot ${isStale ? 'rm-status-err' : 'rm-status-ok'}`} />
        <span>{isStale ? 'Stale' : 'Live'}</span>
        {data.timestamp && <span className="rm-status-time">· {new Date(data.timestamp).toLocaleTimeString()}</span>}
      </div>
    </div>
  );
}
