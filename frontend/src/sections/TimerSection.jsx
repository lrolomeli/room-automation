import { useState } from 'react';
import Card from '../components/ui/Card';
import Banner from '../components/ui/Banner';
import { api } from '../lib/api';
import { usePoll } from '../hooks/usePoll';

const PRESETS = [15, 30, 60, 120];

function fmtRemaining(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function TimerSection({ draft }) {
  const [minutes, setMinutes] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { data: status, refresh, setData: setStatus } = usePoll('/api/ac-timer/status', 5000);

  const start = async (loop) => {
    const mins = Math.round(Number(minutes));
    if (!Number.isFinite(mins) || mins < 1) {
      setError('Ingresa una cantidad de minutos válida');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await api.post('/api/ac-timer/start', { minutes: mins, loop, state: draft });
      if (data?.status) setStatus(data.status);
    } catch (err) {
      setError(`No se pudo iniciar: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await api.post('/api/ac-timer/stop');
      if (data?.status) setStatus(data.status);
      else refresh();
    } catch (err) {
      setError(`No se pudo detener: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const active = !!status?.active;

  return (
    <Card title="Temporizador">
      {error && <Banner variant="err" className="mb-3">{error}</Banner>}

      {active ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full ${
                status.phase === 'on'
                  ? 'bg-ok shadow-[0_0_10px_rgba(46,204,113,0.7)]'
                  : 'bg-warn shadow-[0_0_10px_rgba(243,156,18,0.7)]'
              }`}
            />
            <b>{status.phase === 'on' ? 'Encendido' : 'Apagado'}</b>
            <span className="text-sm text-white/55">
              {status.mode === 'loop'
                ? `Bucle · ${status.onMinutes} min encendido / ${status.offMinutes} min apagado`
                : 'Una vez'}
            </span>
          </div>
          <div className="text-sm text-white/70">
            {status.phase === 'on' ? 'Se apaga en' : 'Se enciende en'}{' '}
            <b className="text-lg text-white">{fmtRemaining(status.secondsRemaining)}</b>
          </div>
          <button
            type="button"
            onClick={stop}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-2xl border border-danger/50 bg-danger/15 py-3 text-danger transition-colors hover:bg-danger/25 disabled:opacity-50"
          >
            <span className="text-lg">⭘</span>
            Detener y apagar
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                disabled={busy}
                onClick={() => setMinutes(p)}
                className={[
                  'min-w-[3.4rem] flex-1 rounded-lg border px-2 py-2 text-sm transition-colors disabled:opacity-40',
                  Number(minutes) === p
                    ? 'border-accent/70 bg-accent/35 text-white'
                    : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white',
                ].join(' ')}
              >
                {p} min
              </button>
            ))}
          </div>

          <label className="flex items-center justify-between gap-3 text-sm text-white/70">
            Minutos encendido
            <input
              type="number"
              min="1"
              max="1440"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              disabled={busy}
              className="w-28 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-center text-base text-white outline-none focus:border-accent"
            />
          </label>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => start(false)}
              disabled={busy}
              className="rounded-xl bg-ok/75 py-3 font-semibold text-white transition-colors hover:bg-ok disabled:opacity-45"
            >
              Encender por {Math.max(1, Math.round(Number(minutes) || 0))} min
            </button>
            <button
              type="button"
              onClick={() => start(true)}
              disabled={busy}
              className="rounded-xl bg-accent/80 py-3 font-semibold text-white transition-colors hover:bg-accent disabled:opacity-45"
            >
              Bucle {Math.max(1, Math.round(Number(minutes) || 0))} / 15 min
            </button>
          </div>
          <p className="text-center text-xs leading-relaxed text-white/45">
            Usa los ajustes actuales del control. El bucle se repite hasta que pulses Detener.
          </p>
        </div>
      )}
    </Card>
  );
}
