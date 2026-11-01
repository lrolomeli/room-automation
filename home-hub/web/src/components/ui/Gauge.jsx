export default function Gauge({ label, value, unit, color, pct }) {
  return (
    <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
      <div className="text-[0.68rem] uppercase tracking-[0.18em] text-white/60">{label}</div>
      <div className="my-2 text-4xl font-bold" style={{ color }}>
        {value}
        <span className="text-xl">{unit}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }}
        />
      </div>
    </div>
  );
}
