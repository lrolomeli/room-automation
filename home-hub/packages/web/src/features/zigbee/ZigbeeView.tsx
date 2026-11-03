import { useEffect, useState } from 'react';
import Card from '../../components/ui/Card';
import Banner from '../../components/ui/Banner';
import Switch from '../../components/ui/Switch';
import { api } from '../../lib/api';
import type { AutomationStatus, Bridge, ZigbeeDevice } from '@home-hub/contract';

function formatWhen(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function availabilityLabel(device: ZigbeeDevice) {
  if (device.availability === 'offline') return 'Sin conexión';
  if (device.state === 'ON') return 'Encendido';
  if (device.state === 'OFF') return 'Apagado';
  return 'Sin estado';
}

function StatusPill({ device }: { device: ZigbeeDevice }) {
  const tone =
    device.availability === 'offline'
      ? 'bg-danger/15 text-danger'
      : device.state === 'ON'
        ? 'bg-ok/15 text-ok'
        : 'bg-white/10 text-white/60';
  return <span className={`rounded-full px-2.5 py-0.5 text-xs ${tone}`}>{availabilityLabel(device)}</span>;
}

function RelayCard({ device }: { device: ZigbeeDevice }) {
  const [optimistic, setOptimistic] = useState<'ON' | 'OFF' | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (optimistic && device.state === optimistic) {
      setOptimistic(null);
      setPending(false);
      setError('');
    }
  }, [device.state, optimistic]);

  useEffect(() => {
    if (!pending) return undefined;
    const timer = setTimeout(() => {
      setPending(false);
      setOptimistic(null);
      setError('Sin confirmación del relé');
    }, 4500);
    return () => clearTimeout(timer);
  }, [pending]);

  const state = optimistic ?? device.state;
  const on = state === 'ON';
  const disabled = !device.controllable || device.availability === 'offline' || pending;

  const toggle = async (next: boolean) => {
    const target = next ? 'ON' : 'OFF';
    setOptimistic(target);
    setPending(true);
    setError('');
    try {
      await api.post(`/api/zigbee/devices/${encodeURIComponent(device.ieee)}/command`, {
        state: target,
      });
    } catch (err) {
      setOptimistic(null);
      setPending(false);
      setError(err instanceof Error ? err.message : 'No se pudo enviar el comando');
    }
  };

  return (
    <Card
      title={device.name}
      action={<StatusPill device={device} />}
      className="transition-colors hover:border-white/20"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold text-white">
            {state === 'ON' ? 'Encendido' : state === 'OFF' ? 'Apagado' : '—'}
          </div>
          <div className="mt-1 text-xs text-white/45">
            {device.model || device.vendor || 'Relé Zigbee'}
          </div>
        </div>
        <Switch
          checked={on}
          onChange={toggle}
          disabled={disabled}
          label={`Cambiar ${device.name}`}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/45">
        <span>LQI: <b className="text-white/70">{device.linkquality ?? '—'}</b></span>
        <span>Última actualización: <b className="text-white/70">{formatWhen(device.updatedAt)}</b></span>
        {pending && <span className="text-warn">Enviando…</span>}
      </div>

      {error && <Banner variant="err" className="mt-3">{error}</Banner>}
    </Card>
  );
}

function SensorCard({ device }: { device: ZigbeeDevice }) {
  const occupancy = device.readings.occupancy;
  const illumination = device.readings.illumination;
  const battery = device.readings.battery;
  return (
    <Card
      title={device.name}
      action={
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs ${
            device.availability === 'offline'
              ? 'bg-danger/15 text-danger'
              : device.availability === 'online'
                ? 'bg-ok/15 text-ok'
                : 'bg-white/10 text-white/60'
          }`}
        >
          {device.availability === 'offline'
            ? 'Sin conexión'
            : device.availability === 'online'
              ? 'En línea'
              : 'Sin datos'}
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[0.68rem] uppercase tracking-[0.12em] text-white/40">Ocupación</div>
          <div className="mt-0.5 text-white">
            {typeof occupancy === 'boolean' ? (occupancy ? 'Ocupado' : 'Libre') : '—'}
          </div>
        </div>
        <div>
          <div className="text-[0.68rem] uppercase tracking-[0.12em] text-white/40">Iluminación</div>
          <div className="mt-0.5 text-white">
            {illumination == null ? '—' : String(illumination)}
          </div>
        </div>
        <div>
          <div className="text-[0.68rem] uppercase tracking-[0.12em] text-white/40">Batería</div>
          <div className="mt-0.5 text-white">{battery == null ? '—' : `${String(battery)}%`}</div>
        </div>
        <div>
          <div className="text-[0.68rem] uppercase tracking-[0.12em] text-white/40">LQI</div>
          <div className="mt-0.5 text-white">{device.linkquality ?? '—'}</div>
        </div>
      </div>

      <div className="mt-3 text-xs text-white/45">
        Último reporte: <b className="text-white/70">{formatWhen(device.lastSeen || device.updatedAt)}</b>
      </div>
    </Card>
  );
}

function AutomationCard({ automations }: { automations: AutomationStatus | null }) {
  const mode = automations?.mode || '—';
  const entries = (automations?.log || []).slice(0, 3);
  return (
    <Card
      title="Automatizaciones Zigbee"
      action={
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs ${
            mode === 'live' ? 'bg-ok/15 text-ok' : 'bg-warn/15 text-warn'
          }`}
        >
          {mode}
        </span>
      }
    >
      <p className="text-xs text-white/45">
        Movimiento → relé. En <b className="text-white/70">shadow</b> solo registra; en{' '}
        <b className="text-white/70">live</b> envía comandos.
      </p>
      <ul className="mt-2 flex flex-col gap-1.5 text-xs text-white/60">
        {entries.length === 0 ? (
          <li className="rounded-lg bg-white/5 px-2.5 py-1.5">Sin actividad.</li>
        ) : (
          entries.map((entry, index) => (
            <li key={`${String(entry.ts)}-${index}`} className="rounded-lg bg-white/5 px-2.5 py-1.5">
              <span className="text-white/35">{formatWhen(String(entry.ts || ''))}</span>{' '}
              <span className="text-accent-soft">{String(entry.rule || '')}</span>{' '}
              {String(entry.detail || '')}
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}

export default function ZigbeeView({
  devices,
  bridge,
  automations,
  connected,
}: {
  devices: ZigbeeDevice[];
  bridge: Bridge | null;
  automations: AutomationStatus | null;
  connected: boolean;
}) {
  const relays = devices.filter((device) => device.kind === 'relay');
  const sensors = devices.filter((device) => device.kind === 'sensor');
  const mqttOk = !!bridge?.mqttConnected;

  return (
    <div className="flex flex-col gap-3.5">
      {!connected && <Banner variant="warn">WebSocket desconectado.</Banner>}
      {!mqttOk && <Banner variant="warn">MQTT desconectado. Comprueba el stack de Zigbee.</Banner>}

      <Card title="Zigbee" action={null}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <div className="text-[0.68rem] uppercase tracking-[0.12em] text-white/40">MQTT</div>
            <div className={mqttOk ? 'text-ok' : 'text-danger'}>
              {mqttOk ? 'Conectado' : 'Desconectado'}
            </div>
          </div>
          <div>
            <div className="text-[0.68rem] uppercase tracking-[0.12em] text-white/40">Zigbee2MQTT</div>
            <div className="text-white">{bridge?.state || '—'}</div>
          </div>
          <div>
            <div className="text-[0.68rem] uppercase tracking-[0.12em] text-white/40">Versión</div>
            <div className="text-white">{bridge?.version || '—'}</div>
          </div>
          <div>
            <div className="text-[0.68rem] uppercase tracking-[0.12em] text-white/40">Dispositivos</div>
            <div className="text-white">{devices.length}</div>
          </div>
        </div>
      </Card>

      <AutomationCard automations={automations} />

      <section>
        <h2 className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-white/55">
          Interruptores
        </h2>
        {relays.length === 0 ? (
          <Banner variant="info">Esperando relés de Zigbee2MQTT…</Banner>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {relays.map((device) => (
              <RelayCard key={device.ieee} device={device} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-white/55">Sensores</h2>
        {sensors.length === 0 ? (
          <Banner variant="info">Esperando sensores de Zigbee2MQTT…</Banner>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {sensors.map((device) => (
              <SensorCard key={device.ieee} device={device} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
