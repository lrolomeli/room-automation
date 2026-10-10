export default function Spinner({ label = 'Cargando…' }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-white/60">
      <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/15 border-t-accent" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
