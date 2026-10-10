import { useState, useEffect, useCallback } from 'react';

function fmtRemaining(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function TimerCard({ draft }) {
  const [minutes, setMinutes] = useState(30);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/ac-timer/status', { credentials: 'include' });
      if (res.ok) setStatus(await res.json());
    } catch (err) {
      /* el estado no es crítico */
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  const start = async (loop) => {
    const mins = Math.round(Number(minutes));
    if (!Number.isFinite(mins) || mins < 1) {
      setError('Ingresa una cantidad de minutos válida');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/ac-timer/start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: mins, loop, state: draft }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.detail || data.error || 'error');
      setStatus(data.status);
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
      const res = await fetch('/api/ac-timer/stop', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.status) setStatus(data.status);
    } catch (err) {
      setError(`No se pudo detener: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const active = !!status?.active;

  return (
    <div className="ir-card ir-timer">
      <div className="ir-card-title">Temporizador</div>

      {error && <div className="ir-banner ir-banner-err">{error}</div>}

      {active ? (
        <div className="ir-timer-active">
          <div className="ir-timer-line">
            <span className={`ir-timer-dot ${status.phase === 'on' ? 'ir-timer-dot-on' : 'ir-timer-dot-off'}`} />
            <b>{status.phase === 'on' ? 'Encendido' : 'Apagado'}</b>
            <span className="ir-timer-mode">
              {status.mode === 'loop'
                ? `Bucle · ${status.onMinutes} min on / ${status.offMinutes} min off`
                : 'Una vez'}
            </span>
          </div>
          <div className="ir-timer-count">
            {status.phase === 'on' ? 'Se apaga en' : 'Se enciende en'}{' '}
            <b>{fmtRemaining(status.secondsRemaining)}</b>
          </div>
          <button className="ir-power ir-power-off" onClick={stop} disabled={busy}>
            <span className="ir-power-icon">⭘</span>
            Detener y apagar
          </button>
        </div>
      ) : (
        <div className="ir-timer-setup">
          <label className="ir-timer-label">
            Minutos encendido
            <input
              type="number"
              min="1"
              max="1440"
              className="ir-timer-input"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              disabled={busy}
            />
          </label>
          <div className="ir-timer-actions">
            <button className="ir-send ir-timer-once" onClick={() => start(false)} disabled={busy}>
              Encender por {Math.max(1, Math.round(Number(minutes) || 0))} min
            </button>
            <button className="ir-send ir-timer-loop" onClick={() => start(true)} disabled={busy}>
              Bucle {Math.max(1, Math.round(Number(minutes) || 0))} / 15 min
            </button>
          </div>
          <p className="ir-send-hint">Usa los ajustes actuales de la pantalla. El bucle se repite hasta que pulses Detener.</p>
        </div>
      )}
    </div>
  );
}
