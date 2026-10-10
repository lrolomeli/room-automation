import { useState } from 'react';
import Card from '../components/ui/Card';
import Collapsible from '../components/ui/Collapsible';
import Switch from '../components/ui/Switch';
import Banner from '../components/ui/Banner';
import Spinner from '../components/ui/Spinner';
import { api } from '../lib/api';
import { usePoll } from '../hooks/usePoll';

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MODE_LABELS = { auto: 'Auto', cool: 'Frío', dry: 'Seco', heat: 'Calor', fan: 'Ventilador' };
const FAN_LABELS = { auto: 'Auto', low: 'Baja', med: 'Media', high: 'Alta' };

function daysText(days = []) {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return 'Todos los días';
  if (sorted.length === 5 && sorted.every((d, i) => d === i + 1)) return 'Lunes a viernes';
  if (sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6) return 'Fines de semana';
  return sorted.map((d) => DAY_LABELS[d]).join(', ');
}

function routineDetail(routine) {
  const end = routine.endAction === 'off' ? 'y apagar' : 'y mantener';
  if (routine.adaptive) {
    return `${daysText(routine.days)} · objetivo ${routine.fromTemp}° a ${routine.toTemp}° durante la noche (+1° cada ${routine.stepMinutes} min). El setpoint se ajusta solo según la temperatura real, ${end}`;
  }
  if (routine.kind === 'ramp') {
    return `${daysText(routine.days)} · ${MODE_LABELS[routine.mode] || routine.mode} de ${routine.fromTemp}° a ${routine.toTemp}° subiendo 1° cada ${routine.stepMinutes} min, ${end}`;
  }
  const verb = routine.action === 'off' ? 'Apagar' : 'Encender';
  const state =
    routine.action === 'off'
      ? ''
      : ` · ${MODE_LABELS[routine.state.mode] || routine.state.mode} ${routine.state.temp}°C · Vent ${FAN_LABELS[routine.state.fan] || routine.state.fan}`;
  return `${daysText(routine.days)} · ${verb}${state}`;
}

function routineTime(routine) {
  if (routine.kind === 'ramp') return `${routine.start}–${routine.end}`;
  return routine.time;
}

export default function AutomationSection() {
  const { data: status, setData: setStatus, loading } = usePoll('/api/climate/status', 30000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggle = async () => {
    if (!status || busy) return;
    const next = !status.enabled;
    setBusy(true);
    setError('');
    setStatus((s) => ({ ...s, enabled: next }));
    try {
      const data = await api.post('/api/climate/enabled', { enabled: next });
      if (data?.status) setStatus(data.status);
    } catch (err) {
      setError(`No se pudo cambiar: ${err.message}`);
      setStatus((s) => ({ ...s, enabled: !next }));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !status) return <Spinner label="Cargando automatización…" />;
  if (!status) return null;

  const sensor = status.sensor;
  const ac = status.ac;
  const control = status.control;

  return (
    <Card title="Automatización">
      {error && <Banner variant="err" className="mb-3">{error}</Banner>}

      <div className="flex items-center justify-between gap-3">
        <div className="text-lg font-medium">{status.enabled ? 'Activada' : 'Desactivada'}</div>
        <Switch
          checked={status.enabled}
          onChange={toggle}
          disabled={busy}
          label="Activar o desactivar la automatización"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 pt-3 text-sm text-white/65">
        <span>
          Temperatura: <b className="text-white">{sensor?.temperature ?? '—'}°C</b>
        </span>
        <span>
          Humedad: <b className="text-white">{sensor?.humidity ?? '—'}%</b>
        </span>
        <span>
          Aire: <b className="text-white">{ac?.power ? `Encendido · ${ac.temp}°C` : 'Apagado'}</b>
        </span>
        {status.humidityActive && (
          <span className="rounded-full bg-ok/12 px-2.5 py-0.5 text-ok">Higrostato activo</span>
        )}
        {status.manualOverrideActive && (
          <span className="rounded-full bg-warn/12 px-2.5 py-0.5 text-warn">Pausa manual</span>
        )}
        {status.nextRoutine && (
          <span>
            Próxima: <b className="text-white">{status.nextRoutine.name}</b> {status.nextRoutine.time}
          </span>
        )}
      </div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3.5">
        <div className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-white/55">
          Control en vivo
        </div>
        {control ? (
          <>
            <div className="flex flex-col gap-1.5 text-sm text-white/70">
              <div className="flex justify-between">
                <span>Objetivo del cuarto</span>
                <b className="text-white">{control.targetTemp}°C</b>
              </div>
              <div className="flex justify-between">
                <span>Temperatura real</span>
                <b className="text-white">
                  {control.roomTemp == null ? '—' : `${control.roomTemp}°C`}
                </b>
              </div>
              <div className="flex justify-between">
                <span>Ritmo</span>
                <b className="text-white">
                  {control.slope > 0 ? '+' : ''}
                  {control.slope} °C/min
                </b>
              </div>
              <div className="flex justify-between">
                <span>Setpoint del aire</span>
                <b className="text-white">
                  {control.setpoint}°C · Vent {FAN_LABELS[control.fan] || control.fan}
                </b>
              </div>
            </div>
            <div className="mt-2 text-sm leading-relaxed text-white/55">{control.reason}</div>
          </>
        ) : (
          <p className="text-sm text-white/50">Sin datos del lazo de control.</p>
        )}
      </div>

      <Collapsible title="Reglas y actividad" className="mt-3">
        <ul className="flex flex-col gap-2.5">
          {status.schedule.map((routine) => (
            <li
              key={routine.id}
              className="rounded-xl border border-white/10 bg-white/3 p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-white">{routine.name}</span>
                <span className="whitespace-nowrap text-sm font-semibold text-accent-soft">
                  {routineTime(routine)}
                </span>
              </div>
              <div className="mt-1 text-xs leading-relaxed text-white/55">
                {routineDetail(routine)}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4">
          <div className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-white/55">
            Actividad reciente
          </div>
          {status.log.length === 0 && <p className="text-sm text-white/50">Sin actividad.</p>}
          <ul className="flex flex-col gap-2">
            {status.log.map((e, i) => (
              <li
                key={i}
                className={`flex flex-col gap-0.5 rounded-lg bg-white/4 px-2.5 py-2 text-xs text-white/75 ${
                  e.ok ? '' : 'border-l-2 border-danger/60'
                }`}
              >
                <span className="text-white/40">
                  {new Date(e.ts).toLocaleString('es-MX')}
                </span>
                <span className="font-semibold text-accent-soft">{e.rule}</span>
                <span className="text-white/60">
                  {e.detail}
                  {e.error ? ` (${e.error})` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Collapsible>
    </Card>
  );
}
