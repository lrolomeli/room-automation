import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import Spinner from './ui/Spinner';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
const LEGEND = [
  { color: '#1e90ff', label: '<15°' },
  { color: '#2ed573', label: '15-20°' },
  { color: '#ffa502', label: '20-25°' },
  { color: '#ff6348', label: '25-30°' },
  { color: '#ff4757', label: '>30°' },
];

function tempColor(avg) {
  if (avg == null) return 'rgba(255,255,255,0.05)';
  if (avg < 15) return '#1e90ff';
  if (avg < 20) return '#2ed573';
  if (avg < 25) return '#ffa502';
  if (avg < 30) return '#ff6348';
  return '#ff4757';
}

export default function Heatmap() {
  const now = new Date();
  const [yearMonth, setYearMonth] = useState(now.toISOString().slice(0, 7));
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .get(`/api/sensors/heatmap?month=${yearMonth}`)
      .then((res) => {
        if (alive) setData(Array.isArray(res) ? res : []);
      })
      .catch(() => {
        if (alive) setData([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [yearMonth]);

  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const map = new Map(data.map((d) => [d.day, d]));

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${yearMonth}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, ...map.get(key) });
  }

  const currentYm = now.toISOString().slice(0, 7);
  const prevMonth = () => {
    const d = new Date(year, month - 2, 1);
    setYearMonth(d.toISOString().slice(0, 7));
  };
  const nextMonth = () => {
    const d = new Date(year, month, 1);
    if (d.toISOString().slice(0, 7) > currentYm) return;
    setYearMonth(d.toISOString().slice(0, 7));
  };

  if (loading) return <Spinner label="Cargando calendario…" />;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm font-semibold">
        <button
          type="button"
          onClick={prevMonth}
          className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20"
        >
          ‹
        </button>
        <span>
          {MONTHS[month - 1]} {year}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          disabled={yearMonth === currentYm}
          className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DAYS.map((d) => (
          <div key={d} className="py-1 text-center text-[0.7rem] text-white/40">
            {d}
          </div>
        ))}
        {cells.map((c, i) => (
          <div
            key={i}
            title={c?.day ? `${c.day}: ${c.avgTemp?.toFixed(1) ?? '—'}°C prom` : ''}
            style={{ background: c?.avgTemp != null ? tempColor(c.avgTemp) : 'rgba(255,255,255,0.05)' }}
            className="grid aspect-square place-items-center rounded-md text-[0.72rem] text-white/70"
          >
            {c?.day || ''}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[0.7rem] text-white/50">
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-1">
            <span className="h-3 w-3 rounded" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
