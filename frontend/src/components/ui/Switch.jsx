import { cn } from '../../lib/cn';

export default function Switch({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-8 w-14 shrink-0 rounded-full border transition-colors disabled:opacity-60',
        checked ? 'border-accent/90 bg-accent/60' : 'border-white/15 bg-white/10',
      )}
    >
      <span
        className={cn(
          'absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow transition-all',
          checked ? 'left-[calc(100%-1.4rem)]' : 'left-1',
        )}
      />
    </button>
  );
}
