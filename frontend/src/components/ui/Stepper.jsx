import { cn } from '../../lib/cn';

const ROUND_BTN =
  'grid h-13 w-13 place-items-center rounded-full border border-white/15 bg-white/5 text-3xl leading-none text-white transition-colors hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-white/5';

export default function Stepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled = false,
  format = (v) => v,
  className = '',
}) {
  return (
    <div className={cn('flex items-center justify-center gap-6', className)}>
      <button
        type="button"
        className={ROUND_BTN}
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={disabled || value <= min}
        aria-label="Bajar"
      >
        −
      </button>
      <span className="min-w-[6rem] text-center text-4xl font-bold text-white">{format(value)}</span>
      <button
        type="button"
        className={ROUND_BTN}
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={disabled || value >= max}
        aria-label="Subir"
      >
        +
      </button>
    </div>
  );
}
