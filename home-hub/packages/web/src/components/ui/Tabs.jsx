import { cn } from '../../lib/cn';

export default function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={cn('flex gap-1 rounded-xl bg-white/8 p-1', className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            'flex-1 rounded-lg py-1.5 text-sm transition-colors',
            value === t.id ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
