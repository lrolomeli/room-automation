import { cn } from '../../lib/cn';

export default function Card({ title, action, children, className = '' }) {
  return (
    <section className={cn('rounded-2xl border border-white/10 bg-white/5 p-4', className)}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title && (
            <h2 className="text-[0.72rem] uppercase tracking-[0.14em] text-white/55">{title}</h2>
          )}
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
