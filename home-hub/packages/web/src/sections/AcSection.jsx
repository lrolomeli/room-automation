import { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Banner from '../components/ui/Banner';
import Spinner from '../components/ui/Spinner';
import Stepper from '../components/ui/Stepper';
import RelayButton from '../components/RelayButton';
import AcAdvancedModal from './AcAdvancedModal';
import { api } from '../lib/api';

const DEFAULT_AC = {
  power: false,
  temp: 24,
  mode: 'cool',
  fan: 'med',
  swing_v: 'off',
  swing_h: 'middle',
  turbo: false,
  quiet: false,
  sleep: false,
  health: false,
};

const FIELDS = Object.keys(DEFAULT_AC);

const MODE_RAW = { auto: 0, cool: 1, dry: 2, heat: 4, fan: 6 };
const FAN_RAW = { high: 1, med: 2, low: 3, auto: 5 };
const SWING_V_RAW = { off: 0, top: 1, middle: 2, bottom: 3, down: 10, auto: 12 };
const SWING_H_RAW = { middle: 0, left_max: 3, left: 4, right: 5, right_max: 6, auto: 7 };

function rawToLabel(map, raw) {
  const found = Object.entries(map).find(([, value]) => value === raw);
  return found ? found[0] : null;
}

function mapState(state) {
  if (!state || !state.valid) return null;
  return {
    power: !!state.power,
    temp: state.temp || 24,
    mode: rawToLabel(MODE_RAW, state.mode_raw) || 'cool',
    fan: rawToLabel(FAN_RAW, state.fan_raw) || 'med',
    swing_v: rawToLabel(SWING_V_RAW, state.swing_v_raw) || 'off',
    swing_h: rawToLabel(SWING_H_RAW, state.swing_h_raw) || 'middle',
    turbo: !!state.turbo,
    quiet: !!state.quiet,
    sleep: !!state.sleep,
    health: !!state.health,
  };
}

function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

export default function AcSection({ room, refresh, mySw }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState(DEFAULT_AC);

  const mapped = mapState(room?.ac);
  const applied = mapped || DEFAULT_AC;
  const hasState = !!mapped;
  const appliedKey = JSON.stringify(applied);
  const changed = FIELDS.filter((field) => draft[field] !== applied[field]).length;
  const dirty = changed > 0;

  const sensor = room?.sensor;
  const stale = !!sensor?.stale;
  const currentTemp = sensor?.temperature;
  const humidity = sensor?.humidity;

  useEffect(() => {
    if (!dirty) setDraft(JSON.parse(appliedKey));
  }, [appliedKey, dirty]);

  const updateDraft = (partial) => {
    setDraft((previous) => ({ ...previous, ...partial }));
    setError('');
    setNotice('');
  };

  const applyDraft = async () => {
    setSending(true);
    setError('');
    setNotice('');
    try {
      await api.post('/api/room/ac', draft);
      await refresh();
      setNotice('Cambios aplicados');
      return true;
    } catch (err) {
      setError(`No se pudo aplicar: ${err.message}`);
      return false;
    } finally {
      setSending(false);
    }
  };

  if (!room) return <Spinner label="Cargando habitación…" />;

  const sensorLabel = !sensor ? 'Sin sensor' : stale ? 'Sin conexión' : 'En vivo';

  return (
    <>
      <Card
        title="Aire acondicionado"
        action={
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-warn">Sin aplicar</span>}
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs ${
                applied.power ? 'bg-ok/15 text-ok' : 'bg-white/10 text-white/60'
              }`}
            >
              {applied.power ? 'Encendido' : 'Apagado'}
            </span>
          </div>
        }
      >
        {error && <Banner variant="err" className="mb-3">{error}</Banner>}
        {notice && !error && <Banner variant="ok" className="mb-3">{notice}</Banner>}
        {!hasState && (
          <Banner variant="warn" className="mb-3">
            Sin estado previo del aire; se usarán valores por defecto.
          </Banner>
        )}
        {stale && (
          <Banner variant="warn" className="mb-3">
            Sensor sin conexión — mostrando la última lectura.
          </Banner>
        )}

        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[0.68rem] uppercase tracking-[0.16em] text-white/45">
              Temperatura actual
            </div>
            <div className="mt-1 text-5xl font-bold text-temp">
              {currentTemp == null ? '--' : Number(currentTemp).toFixed(1)}
              <span className="text-2xl">°C</span>
            </div>
            <div className="mt-1 text-sm text-white/55">
              Humedad {humidity == null ? '--' : Number(humidity).toFixed(0)}%
            </div>
          </div>
          <div className="text-right text-xs text-white/45">
            <div className="flex items-center justify-end gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  !sensor || stale ? 'bg-danger' : 'bg-ok'
                }`}
              />
              {sensorLabel}
            </div>
            <div className="mt-1">{formatTime(sensor?.timestamp)}</div>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => updateDraft({ power: true })}
            disabled={sending}
            className={[
              'flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-4 text-base transition-colors disabled:opacity-50',
              draft.power
                ? 'border-ok/50 bg-ok/15 text-ok shadow-[0_0_18px_rgba(46,204,113,0.25)]'
                : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10',
            ].join(' ')}
          >
            <span className="text-xl">⏻</span>
            Encender
          </button>
          <button
            type="button"
            onClick={() => updateDraft({ power: false })}
            disabled={sending}
            className={[
              'flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-4 text-base transition-colors disabled:opacity-50',
              !draft.power
                ? 'border-danger/50 bg-danger/15 text-danger shadow-[0_0_18px_rgba(255,71,87,0.2)]'
                : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10',
            ].join(' ')}
          >
            <span className="text-xl">⭘</span>
            Apagar
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 text-center text-[0.72rem] uppercase tracking-[0.14em] text-white/55">
            Temperatura ajustada
          </div>
          <Stepper
            value={draft.temp}
            min={16}
            max={30}
            onChange={(temp) => updateDraft({ temp })}
            disabled={sending}
            format={(value) => `${value}°C`}
          />
        </div>

        <div className="mt-4">
          <RelayButton device={mySw} label="my-sw" />
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="mt-3 w-full rounded-xl border border-accent/40 bg-accent/15 py-3 text-sm font-semibold text-accent-soft transition-colors hover:bg-accent/25"
        >
          Control completo
        </button>
      </Card>

      <AcAdvancedModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        draft={draft}
        onChange={updateDraft}
        onApply={applyDraft}
        sending={sending}
        error={error}
      />

      {(dirty || sending) && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#1a1730]/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto max-w-[40rem]">
            <button
              type="button"
              onClick={applyDraft}
              disabled={sending}
              className="w-full rounded-xl bg-accent py-3 font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
            >
              {sending
                ? 'Enviando…'
                : `Aplicar ${changed} ${changed === 1 ? 'cambio' : 'cambios'}`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
