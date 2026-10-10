import { useState } from 'react';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function tempColor(avg) {
  if (avg == null) return 'rgba(255,255,255,0.05)';
  if (avg < 15) return '#1e90ff';
  if (avg < 20) return '#2ed573';
  if (avg < 25) return '#ffa502';
  if (avg < 30) return '#ff6348';
  return '#ff4757';
}

export default function MonthHeatmap({ data }) {
  const now = new Date();
  const [yearMonth, setYearMonth] = useState(now.toISOString().slice(0, 7));
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const map = new Map((data || []).map(d => [d.day, d]));

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${yearMonth}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, ...map.get(key) });
  }

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1);
    setYearMonth(d.toISOString().slice(0, 7));
  };
  const nextMonth = () => {
    const d = new Date(year, month, 1);
    if (d > now) return;
    setYearMonth(d.toISOString().slice(0, 7));
  };

  return (
    <div className="rm-heatmap">
      <div className="rm-heatmap-nav">
        <button onClick={prevMonth}>‹</button>
        <span>{MONTH_NAMES[month - 1]} {year}</span>
        <button onClick={nextMonth} disabled={yearMonth === now.toISOString().slice(0, 7)}>›</button>
      </div>
      <div className="rm-heatmap-grid">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d} className="rm-heatmap-day-label">{d}</div>)}
        {cells.map((c, i) => (
          <div key={i} className="rm-heatmap-cell" style={{ background: c?.avgTemp != null ? tempColor(c.avgTemp) : 'rgba(255,255,255,0.05)' }} title={c?.day ? `${c.day}: ${c.avgTemp?.toFixed(1)}°C avg` : ''}>
            {c?.day || ''}
          </div>
        ))}
      </div>
      <div className="rm-heatmap-legend">
        <span>&lt;15°</span><span className="rm-legend-dot" style={{ background: '#1e90ff' }} />
        <span>15-20°</span><span className="rm-legend-dot" style={{ background: '#2ed573' }} />
        <span>20-25°</span><span className="rm-legend-dot" style={{ background: '#ffa502' }} />
        <span>25-30°</span><span className="rm-legend-dot" style={{ background: '#ff6348' }} />
        <span>&gt;30°</span><span className="rm-legend-dot" style={{ background: '#ff4757' }} />
      </div>
    </div>
  );
}
