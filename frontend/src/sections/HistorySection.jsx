import { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Collapsible from '../components/ui/Collapsible';
import SegmentedControl from '../components/ui/SegmentedControl';
import StatTile from '../components/ui/StatTile';
import Tabs from '../components/ui/Tabs';
import Spinner from '../components/ui/Spinner';
import Banner from '../components/ui/Banner';
import LineChart from '../components/chart/LineChart';
import Heatmap from '../components/Heatmap';
import { api } from '../lib/api';
import { usePoll } from '../hooks/usePoll';

const RANGES = [
  { value: '1h', label: '1h' },
  { value: '6h', label: '6h' },
  { value: '12h', label: '12h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

const LONG_RANGES = new Set(['7d', '30d']);

const ANALYSIS_TABS = [
  { id: 'calendar', label: 'Calendario' },
  { id: 'trends', label: 'Tendencias' },
];

function computeStats(rows) {
  if (!rows?.length) return null;
  const temps = rows.map((r) => Number(r.temperature)).filter(Number.isFinite);
  const hums = rows.map((r) => Number(r.humidity)).filter(Number.isFinite);
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  return {
    samples: rows.length,
    minTemp: temps.length ? Math.min(...temps) : null,
    maxTemp: temps.length ? Math.max(...temps) : null,
    avgTemp: avg(temps),
    minHum: hums.length ? Math.min(...hums) : null,
    maxHum: hums.length ? Math.max(...hums) : null,
    avgHum: avg(hums),
  };
}

const fmt = (n) => (n == null ? '—' : n.toFixed(1));

function Trends() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .get('/api/sensors/trends?days=30')
      .then((res) => {
        if (alive) setData(res);
      })
      .catch(() => {
        if (alive) setData(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <Spinner label="Cargando tendencias…" />;
  if (!data?.daily?.length) return <Banner variant="info">Sin datos de tendencias.</Banner>;

  const labels = data.daily.map((d) =>
    new Date(`${d.day}T00:00:00`).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }),
  );
  const temp = data.daily.map((d) => d.avgTemp);
  const hum = data.daily.map((d) => d.avgHumidity);
  const anomalyIndices = new Set(
    (data.anomalies || [])
      .map((a) => data.daily.findIndex((d) => d.day === a.day))
      .filter((i) => i >= 0),
  );

  return (
    <div className="flex flex-col gap-4">
      <LineChart labels={labels} temp={temp} hum={hum} anomalies={anomalyIndices} height={260} />
      {data.anomalies?.length > 0 && (
        <div className="rounded-xl border border-danger/20 bg-danger/10 p-4">
          <h4 className="mb-2 text-sm text-danger">Anomalías ({data.anomalies.length})</h4>
          <div className="flex flex-col gap-1.5">
            {data.anomalies.map((a, i) => (
              <div
                key={i}
                className="flex justify-between rounded-md bg-white/5 px-2.5 py-1 text-sm text-white/70"
              >
                <span>{new Date(`${a.day}T00:00:00`).toLocaleDateString('es-MX')}</span>
                <span>{a.avgTemp.toFixed(1)}°C</span>
                <span className="font-semibold text-danger">σ {a.deviation}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HistorySection() {
  const [range, setRange] = useState('24h');
  const [analysis, setAnalysis] = useState('calendar');
  const { data: history, loading } = usePoll(`/api/sensors/history?range=${range}`, 120000);

  const rows = Array.isArray(history) ? history : [];
  const stats = computeStats(rows);

  const labels = rows.map((r) =>
    LONG_RANGES.has(range)
      ? new Date(r.timestamp).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
      : new Date(r.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
  );
  const temp = rows.map((r) => r.temperature);
  const hum = rows.map((r) => r.humidity);

  return (
    <Card title="Historial">
      <SegmentedControl options={RANGES} value={range} onChange={setRange} className="mb-3" />
      {loading ? (
        <Spinner label="Cargando historial…" />
      ) : rows.length === 0 ? (
        <Banner variant="info">Sin datos para este periodo.</Banner>
      ) : (
        <div className="flex flex-col gap-3">
          <LineChart labels={labels} temp={temp} hum={hum} height={300} />

          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Mín" value={`${fmt(stats.minTemp)}°`} accent="text-hum" />
            <StatTile label="Prom" value={`${fmt(stats.avgTemp)}°`} accent="text-temp" />
            <StatTile label="Máx" value={`${fmt(stats.maxTemp)}°`} accent="text-danger" />
            <StatTile label="Mín" value={`${fmt(stats.minHum)}%`} accent="text-hum" />
            <StatTile label="Prom" value={`${fmt(stats.avgHum)}%`} accent="text-hum" />
            <StatTile label="Máx" value={`${fmt(stats.maxHum)}%`} accent="text-danger" />
          </div>

          <Collapsible
            title="Calendario y tendencias"
            subtitle={`${stats.samples} muestras en este periodo`}
          >
            <Tabs tabs={ANALYSIS_TABS} value={analysis} onChange={setAnalysis} className="mb-4" />
            {analysis === 'calendar' ? <Heatmap /> : <Trends />}
          </Collapsible>
        </div>
      )}
    </Card>
  );
}
