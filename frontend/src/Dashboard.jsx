import { useSession } from './context/SessionContext';
import NowSection from './sections/NowSection';
import ControlSection from './sections/ControlSection';
import AutomationSection from './sections/AutomationSection';
import HistorySection from './sections/HistorySection';

export default function Dashboard() {
  const { user, logout } = useSession();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#1a1730]/80 backdrop-blur">
        <div className="mx-auto flex max-w-[40rem] items-center justify-between gap-3 px-4 py-3">
          <a
            href="https://luisrlp.com"
            className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm text-white transition-colors hover:bg-white/20"
          >
            ← Inicio
          </a>
          <h1 className="text-lg font-light text-white">Aire</h1>
          <button
            type="button"
            onClick={logout}
            title={user?.username ? `Sesión de ${user.username}` : 'Cerrar sesión'}
            className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm text-white transition-colors hover:bg-white/20"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-[40rem] flex-col gap-3.5 px-4 py-4 pb-28">
        <NowSection />
        <ControlSection />
        <AutomationSection />
        <HistorySection />
      </main>
    </div>
  );
}
