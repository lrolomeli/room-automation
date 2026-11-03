import { cn } from '../../lib/cn';

const VARIANTS = {
  err: 'text-danger border-danger/25 bg-danger/10',
  ok: 'text-ok border-ok/25 bg-ok/10',
  warn: 'text-warn border-warn/25 bg-warn/10',
  info: 'text-white/70 border-white/10 bg-white/5',
};

export default function Banner({ variant = 'info', children, className = '' }) {
  return (
    <div className={cn('rounded-xl border px-4 py-2 text-center text-sm', VARIANTS[variant], className)}>
      {children}
    </div>
  );
}
