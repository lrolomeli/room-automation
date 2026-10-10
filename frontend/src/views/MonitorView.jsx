import { useState, useEffect, useCallback } from 'react';
import LiveGauge from '../components/LiveGauge';
import LineChart24h from '../components/LineChart24h';
import DailyStats from '../components/DailyStats';
import MonthHeatmap from '../components/MonthHeatmap';
import TrendAnalysis from '../components/TrendAnalysis';

const TABS = [
  { id: 'live', label: 'Live' },
  { id: '24h', label: '24h' },
  { id: 'stats', label: 'Stats' },
  { id: 'month', label: 'Month' },
  { id: 'trends', label: 'Trends' },
];

const RANGES = [
  { id: '1h', label: '1h' },
  { id: '6h', label: '6h' },
  { id: '12h', label: '12h' },
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
];

export default function MonitorView() {
  const [tab, setTab] = useState('live');
  const [liveData, setLiveData] = useState(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [historyData, setHistoryData] = useState(null);
  const [dailyStats, setDailyStats] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [trendData, setTrendData] = useState(null);
  const [range, setRange] = useState('24h');
  const [statsDate, setStatsDate] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch('/api/sensors/current');
      if (res.ok) setLiveData(await res.json());
    } catch (err) {
      console.error('Live fetch failed:', err);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLive();
    const interval = setInterval(fetchLive, 60000);
    return () => clearInterval(interval);
  }, [fetchLive]);

  useEffect(() => {
    if (tab === '24h') {
      fetch(`/api/sensors/history?range=${range}`)
        .then(r => r.ok ? r.json() : [])
        .then(setHistoryData);
    }
  }, [tab, range]);

  useEffect(() => {
    if (tab === 'stats') {
      fetch(`/api/sensors/stats?date=${statsDate}`)
        .then(r => r.json())
        .then(setDailyStats);
    }
  }, [tab, statsDate]);

  useEffect(() => {
    if (tab === 'month') {
      const month = new Date().toISOString().slice(0, 7);
      fetch(`/api/sensors/heatmap?month=${month}`)
        .then(r => r.json())
        .then(setHeatmapData);
    }
  }, [tab]);

  useEffect(() => {
    if (tab === 'trends') {
      fetch('/api/sensors/trends?days=30')
        .then(r => r.json())
        .then(setTrendData);
    }
  }, [tab]);

  return (
    <div className="rm-container">
      <div className="rm-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`rm-tab ${tab === t.id ? 'rm-tab-active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="rm-content">
        {tab === 'live' && <LiveGauge data={liveData} loading={liveLoading} />}

        {tab === '24h' && (
          <>
            <div className="rm-range-bar">
              {RANGES.map(r => (
                <button key={r.id} className={`rm-range-btn ${range === r.id ? 'rm-range-active' : ''}`} onClick={() => setRange(r.id)}>
                  {r.label}
                </button>
              ))}
            </div>
            <LineChart24h data={historyData} />
          </>
        )}

        {tab === 'stats' && (
          <>
            <div className="rm-date-row">
              <input type="date" className="rm-date-input" value={statsDate} onChange={e => setStatsDate(e.target.value)} />
            </div>
            <DailyStats stats={dailyStats} />
          </>
        )}

        {tab === 'month' && <MonthHeatmap data={heatmapData} />}
        {tab === 'trends' && <TrendAnalysis data={trendData} />}
      </div>
    </div>
  );
}
