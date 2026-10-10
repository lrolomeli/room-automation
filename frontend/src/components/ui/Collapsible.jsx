import { useState } from 'react';
import { cn } from '../../lib/cn';

export default function Collapsible({ title, subtitle, defaultOpen = false, children, className = '' }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn('rounded-2xl border border-white/10 bg-white/5', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span className="min-w-0">
          <span className="text-[0.72rem] uppercase tracking-[0.14em] text-white/55">{title}</span>
          {subtitle && <span className="mt-1 block text-sm text-white/70">{subtitle}</span>}
        </span>
        <span
          className={cn('shrink-0 text-lg text-white/50 transition-transform', open && 'rotate-180')}
        >
          ▾
        </span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
