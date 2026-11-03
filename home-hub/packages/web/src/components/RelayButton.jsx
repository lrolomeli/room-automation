import { useEffect, useState } from 'react';
import Banner from './ui/Banner';
import { api } from '../lib/api';

export default function RelayButton({ device, label }) {
  const [optimistic, setOptimistic] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (optimistic && device?.state === optimistic) {
      setOptimistic(null);
      setPending(false);
      setError('');
    }
  }, [device?.state, optimistic]);

  useEffect(() => {
    if (!pending) return undefined;
    const timer = setTimeout(() => {
      setPending(false);
      setOptimistic(null);
      setError('Sin confirmación del relé');
    }, 4500);
    return () => clearTimeout(timer);
  }, [pending]);

  if (!device) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/45">
        {label || 'Relé'} no disponible
      </div>
    );
  }

  const state = optimistic ?? device.state;
  const on = state === 'ON';
  const offline = device.availability === 'offline';
  const disabled = !device.controllable || offline || pending;

  const toggle = async () => {
    const target = on ? 'OFF' : 'ON';
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
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={[
          'flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition-colors disabled:opacity-50',
          on
            ? 'border-ok/50 bg-ok/12 text-ok'
            : 'border-white/12 bg-white/5 text-white hover:bg-white/10',
        ].join(' ')}
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium">{label || device.name}</span>
          <span className="mt-0.5 block text-xs text-white/50">
            {offline
              ? 'Sin conexión'
              : state === 'ON'
                ? 'Encendido'
                : state === 'OFF'
                  ? 'Apagado'
                  : 'Sin estado'}
            {pending ? ' · Enviando…' : ''}
          </span>
        </span>
        <span
          className={[
            'shrink-0 rounded-full px-3 py-1 text-xs font-semibold',
            on ? 'bg-ok/20 text-ok' : 'bg-white/10 text-white/70',
          ].join(' ')}
        >
          {on ? 'Apagar' : 'Encender'}
        </span>
      </button>

      {error && (
        <Banner variant="err" className="mt-2">
          {error}
        </Banner>
      )}
    </div>
  );
}
