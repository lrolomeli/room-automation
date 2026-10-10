import { cn } from '../../lib/cn';

export default function StatTile({ label, value, accent = 'text-white', className = '' }) {
  return (
    <div className={cn('rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center', className)}>
      <div className="text-[0.65rem] uppercase tracking-wider text-white/50">{label}</div>
      <div className={cn('mt-1 text-lg font-semibold', accent)}>{value}</div>
    </div>
  );
}
