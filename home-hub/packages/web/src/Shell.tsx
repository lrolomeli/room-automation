import { useState, type ReactNode } from 'react';
import { useSession } from './context/SessionContext';
import { useRealtime } from './hooks/useRealtime';
import AcSection from './sections/AcSection';
import ParentsSection from './sections/ParentsSection';
import MasSection from './sections/MasSection';
import Banner from './components/ui/Banner';

type Tab = 'mi-cuarto' | 'papas' | 'mas';

export default function Shell() {
  const { logout } = useSession();
  const { connected, devices, room, refresh, lastError } = useRealtime();
  const [tab, setTab] = useState<Tab>('mi-cuarto');
  const deviceList = Object.values(devices);
  const mySw = deviceList.find((device) => device.name === 'my-sw');
  const parSw = deviceList.find((device) => device.name === 'par-sw');

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#1a1730]/85 backdrop-blur">
        <div className="mx-auto flex max-w-[64rem] items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                connected ? 'bg-ok shadow-[0_0_10px_rgba(46,204,113,0.8)]' : 'bg-danger'
              }`}
              title={connected ? 'Conectado' : 'Reconectando'}
            />
            <h1 className="truncate text-base font-light text-white">
              Casa{' '}
              <span className="bg-gradient-to-r from-accent-soft to-hum bg-clip-text font-semibold text-transparent">
                LuisRLP
              </span>
            </h1>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm text-white transition-colors hover:bg-white/20"
          >
            Salir
          </button>
        </div>

        <nav className="mx-auto flex max-w-[64rem] gap-1 px-4 pb-2">
          <TabButton active={tab === 'mi-cuarto'} onClick={() => setTab('mi-cuarto')}>
            Mi cuarto
          </TabButton>
          <TabButton active={tab === 'papas'} onClick={() => setTab('papas')}>
            Papás
          </TabButton>
          <TabButton active={tab === 'mas'} onClick={() => setTab('mas')}>
            Más
          </TabButton>
        </nav>
      </header>

      <main className="mx-auto flex max-w-[64rem] flex-col gap-3.5 px-4 py-4 pb-28">
        {!connected && (
          <Banner variant="warn">Reconectando con el hub… Los datos pueden estar desactualizados.</Banner>
        )}
        {lastError && connected && <Banner variant="warn">{lastError}</Banner>}

        {tab === 'mi-cuarto' && <AcSection room={room} refresh={refresh} mySw={mySw} />}
        {tab === 'papas' && <ParentsSection parSw={parSw} />}
        {tab === 'mas' && <MasSection room={room} refresh={refresh} />}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm transition-colors ${
        active ? 'bg-accent/30 text-white' : 'text-white/55 hover:bg-white/5 hover:text-white/80'
      }`}
    >
      {children}
    </button>
  );
}
