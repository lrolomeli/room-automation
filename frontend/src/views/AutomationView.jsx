import { useState, useEffect, useCallback } from 'react';

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MODE_LABELS = { auto: 'Auto', cool: 'Cool', dry: 'Dry', heat: 'Heat', fan: 'Fan' };
const FAN_LABELS = { auto: 'Auto', low: 'Low', med: 'Media', high: 'Alta' };

function daysText(days = []) {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return 'Todos los días';
  if (sorted.length === 5 && sorted.every((d, i) => d === i + 1)) return 'Lunes a viernes';
  if (sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6) return 'Fines de semana';
  return sorted.map((d) => DAY_LABELS[d]).join(', ');
}

function AtRoutine({ routine }) {
  const verb = routine.action === 'off' ? 'Apagar' : 'Encender';
  const state = routine.action === 'off'
    ? ''
    : ` · ${MODE_LABELS[routine.state.mode] || routine.state.mode} ${routine.state.temp}°C · Fan ${FAN_LABELS[routine.state.fan] || routine.state.fan}`;
  return (
    <li className="cl-rule">
      <div className="cl-rule-head">
        <span className="cl-rule-name">{routine.name}</span>
        <span className="cl-rule-time">{routine.time}</span>
      </div>
      <div className="cl-rule-detail">{daysText(routine.days)} · {verb}{state}</div>
    </li>
  );
}

function RampRoutine({ routine }) {
  const end = routine.endAction === 'off' ? 'y apagar' : 'y mantener';
  if (routine.adaptive) {
    return (
      <li className="cl-rule">
        <div className="cl-rule-head">
          <span className="cl-rule-name">{routine.name}</span>
          <span className="cl-rule-time">{routine.start}–{routine.end}</span>
        </div>
        <div className="cl-rule-detail">
          {daysText(routine.days)} · objetivo {routine.fromTemp}° a {routine.toTemp}° durante la noche
          {' '}(+1° cada {routine.stepMinutes} min). El setpoint se ajusta solo según la temperatura real, {end}
        </div>
      </li>
    );
  }
  return (
    <li className="cl-rule">
      <div className="cl-rule-head">
        <span className="cl-rule-name">{routine.name}</span>
        <span className="cl-rule-time">{routine.start}–{routine.end}</span>
      </div>
      <div className="cl-rule-detail">
        {daysText(routine.days)} · {MODE_LABELS[routine.mode] || routine.mode} de {routine.fromTemp}° a {routine.toTemp}°
        {' '}subiendo 1° cada {routine.stepMinutes} min, {end}
      </div>
    </li>
  );
}

export default function AutomationView() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/climate/status', { credentials: 'include' });
      if (res.ok) setStatus(await res.json());
    } catch (err) {
      /* el estado no es crítico */
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  const toggle = async () => {
    if (!status || busy) return;
    const next = !status.enabled;
    setBusy(true);
    setError('');
    setStatus((s) => ({ ...s, enabled: next }));
    try {
      const res = await fetch('/api/climate/enabled', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'error');
      if (data.status) setStatus(data.status);
    } catch (err) {
      setError(`No se pudo cambiar: ${err.message}`);
      setStatus((s) => ({ ...s, enabled: !next }));
    } finally {
      setBusy(false);
    }
  };

  if (!status) {
    return (
      <div className="cl-container">
        {error ? <div className="cl-banner cl-banner-err">{error}</div> : <p className="cl-muted">Cargando…</p>}
      </div>
    );
  }

  const sensor = status.sensor;
  const ac = status.ac;
  const control = status.control;

  return (
    <div className="cl-container">
      {error && <div className="cl-banner cl-banner-err">{error}</div>}

      <div className="cl-card cl-master">
        <div className="cl-master-row">
          <div>
            <div className="cl-card-title">Automatización</div>
            <div className="cl-master-state">{status.enabled ? 'Activada' : 'Desactivada'}</div>
          </div>
          <button
            className={`cl-switch ${status.enabled ? 'cl-switch-on' : ''}`}
            onClick={toggle}
            disabled={busy}
            aria-pressed={status.enabled}
            aria-label="Activar o desactivar la automatización"
          >
            <span className="cl-switch-knob" />
          </button>
        </div>
        <div className="cl-status">
          <span>Temp: <b>{sensor?.temperature ?? '—'}°C</b></span>
          <span>Humedad: <b>{sensor?.humidity ?? '—'}%</b></span>
          <span>AC: <b>{ac?.power ? `Encendido · ${ac.temp}°C` : 'Apagado'}</b></span>
          {status.humidityActive && <span className="cl-tag cl-tag-on">Higrostato activo</span>}
          {status.manualOverrideActive && <span className="cl-tag cl-tag-warn">Pausa manual</span>}
          {status.nextRoutine && (
            <span>Próxima: <b>{status.nextRoutine.name}</b> {status.nextRoutine.time}</span>
          )}
        </div>
      </div>

      {control && (
        <div className="cl-card">
          <div className="cl-card-title">Control en vivo</div>
          <div className="cl-control">
            <div className="cl-control-row"><span>Objetivo del cuarto</span><b>{control.targetTemp}°C</b></div>
            <div className="cl-control-row"><span>Temperatura real</span><b>{control.roomTemp == null ? '—' : `${control.roomTemp}°C`}</b></div>
            <div className="cl-control-row">
              <span>Ritmo</span>
              <b>{control.slope > 0 ? '+' : ''}{control.slope} °C/min</b>
            </div>
            <div className="cl-control-row">
              <span>Setpoint del AC</span>
              <b>{control.setpoint}°C · Fan {FAN_LABELS[control.fan] || control.fan}</b>
            </div>
          </div>
          <div className="cl-rule-detail">{control.reason}</div>
        </div>
      )}

      <div className="cl-card">
        <div className="cl-card-title">Qué hace por ti</div>
        <ul className="cl-rules">
          {status.schedule.map((routine) => (
            routine.kind === 'ramp'
              ? <RampRoutine key={routine.id} routine={routine} />
              : <AtRoutine key={routine.id} routine={routine} />
          ))}
        </ul>
      </div>

      <div className="cl-card">
        <div className="cl-card-title">Actividad reciente</div>
        {status.log.length === 0 && <p className="cl-muted">Sin actividad.</p>}
        <ul className="cl-log">
          {status.log.map((e, i) => (
            <li key={i} className={e.ok ? '' : 'cl-log-fail'}>
              <span className="cl-log-time">{new Date(e.ts).toLocaleString()}</span>
              <span className="cl-log-rule">{e.rule}</span>
              <span className="cl-log-detail">{e.detail}{e.error ? ` (${e.error})` : ''}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
