import { cn } from '../../lib/cn';

export default function SegmentedControl({
  options,
  value,
  onChange,
  disabled = false,
  wrap = false,
  className = '',
}) {
  return (
    <div className={cn('flex gap-1.5', wrap && 'flex-wrap', className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={cn(
              'min-w-[2.5rem] flex-1 rounded-lg border px-2 py-2 text-sm transition-colors disabled:opacity-40',
              active
                ? 'border-accent/70 bg-accent/35 text-white'
                : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
