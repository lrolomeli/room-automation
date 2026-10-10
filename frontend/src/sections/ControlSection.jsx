import { useCallback, useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Banner from '../components/ui/Banner';
import SegmentedControl from '../components/ui/SegmentedControl';
import Stepper from '../components/ui/Stepper';
import Collapsible from '../components/ui/Collapsible';
import { api } from '../lib/api';
import TimerSection from './TimerSection';

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

const MODES = [
  { value: 'auto', label: 'Auto' },
  { value: 'cool', label: 'Frío' },
  { value: 'dry', label: 'Seco' },
  { value: 'heat', label: 'Calor' },
  { value: 'fan', label: 'Ventilador' },
];

const FANS = [
  { value: 'auto', label: 'Auto' },
  { value: 'low', label: 'Bajo' },
  { value: 'med', label: 'Medio' },
  { value: 'high', label: 'Alto' },
];

const SWINGS_V = [
  { value: 'off', label: 'Off' },
  { value: 'top', label: 'Arriba' },
  { value: 'middle', label: 'Medio' },
  { value: 'bottom', label: 'Abajo' },
  { value: 'down', label: 'Fijo' },
  { value: 'auto', label: 'Auto' },
];

const SWINGS_H = [
  { value: 'middle', label: 'Centro' },
  { value: 'left', label: 'Izq' },
  { value: 'left_max', label: 'Izq máx' },
  { value: 'right', label: 'Der' },
  { value: 'right_max', label: 'Der máx' },
  { value: 'auto', label: 'Auto' },
];

const TOGGLES = [
  { value: 'turbo', label: 'Turbo' },
  { value: 'quiet', label: 'Silencioso' },
  { value: 'sleep', label: 'Dormir' },
  { value: 'health', label: 'Salud' },
];

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

function sameState(a, b) {
  return FIELDS.every((field) => a[field] === b[field]);
}

function PowerButton({ on, label, icon, active, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-4 text-base transition-colors disabled:opacity-50',
        active
          ? on
            ? 'border-ok/50 bg-ok/15 text-ok shadow-[0_0_18px_rgba(46,204,113,0.25)]'
            : 'border-danger/50 bg-danger/15 text-danger shadow-[0_0_18px_rgba(255,71,87,0.2)]'
          : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10',
      ].join(' ')}
    >
      <span className="text-xl">{icon}</span>
      {label}
    </button>
  );
}

export default function ControlSection() {
  const [applied, setApplied] = useState(DEFAULT_AC);
  const [draft, setDraft] = useState(DEFAULT_AC);
  const [hasState, setHasState] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const changed = FIELDS.filter((f) => draft[f] !== applied[f]).length;
  const dirty = changed > 0;

  const load = useCallback(async () => {
    try {
      const data = await api.get('/api/ir/status');
      const mapped = mapState(data);
      if (mapped) {
        setApplied(mapped);
        setDraft(mapped);
        setHasState(true);
      }
    } catch {
      setError('No se pudo leer el estado del aire');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateDraft = (partial) => {
    setDraft((d) => ({ ...d, ...partial }));
    setError('');
    setNotice('');
  };

  const applyDraft = async () => {
    setSending(true);
    setError('');
    setNotice('');
    try {
      const data = await api.post('/api/ir/ac/set', draft);
      const mapped = mapState(data.state);
      if (mapped) {
        setApplied(mapped);
        setDraft(mapped);
      }
      setHasState(true);
      setNotice('Comando enviado');
    } catch (err) {
      setError(`No se pudo enviar: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Card
        title="Control"
        action={
          hasState ? (
            <button
              type="button"
              onClick={applyDraft}
              disabled={sending}
              className="text-xs text-white/45 hover:text-white/80 disabled:opacity-40"
            >
              Reenviar estado
            </button>
          ) : null
        }
      >
        {error && <Banner variant="err" className="mb-3">{error}</Banner>}
        {notice && !error && <Banner variant="ok" className="mb-3">{notice}</Banner>}
        {!hasState && (
          <Banner variant="warn" className="mb-3">
            Sin estado previo del aire; se usarán valores por defecto.
          </Banner>
        )}

        <div className="flex gap-3">
          <PowerButton
            on
            label="Encender"
            icon="⏻"
            active={draft.power}
            disabled={sending}
            onClick={() => updateDraft({ power: true })}
          />
          <PowerButton
            label="Apagar"
            icon="⭘"
            active={!draft.power}
            disabled={sending}
            onClick={() => updateDraft({ power: false })}
          />
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 text-center text-[0.72rem] uppercase tracking-[0.14em] text-white/55">
            Temperatura
          </div>
          <Stepper
            value={draft.temp}
            min={16}
            max={30}
            onChange={(temp) => updateDraft({ temp })}
            disabled={sending}
            format={(v) => `${v}°C`}
          />
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 text-[0.72rem] uppercase tracking-[0.14em] text-white/55">Modo</div>
          <SegmentedControl
            options={MODES}
            value={draft.mode}
            onChange={(mode) => updateDraft({ mode })}
            disabled={sending}
            wrap
          />
        </div>

        <Collapsible title="Más ajustes" className="mt-3">
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-white/55">
                Ventilador
              </div>
              <SegmentedControl
                options={FANS}
                value={draft.fan}
                onChange={(fan) => updateDraft({ fan })}
                disabled={sending}
              />
            </div>
            <div>
              <div className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-white/55">
                Swing vertical
              </div>
              <SegmentedControl
                options={SWINGS_V}
                value={draft.swing_v}
                onChange={(swing_v) => updateDraft({ swing_v })}
                disabled={sending}
                wrap
              />
            </div>
            <div>
              <div className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-white/55">
                Swing horizontal
              </div>
              <SegmentedControl
                options={SWINGS_H}
                value={draft.swing_h}
                onChange={(swing_h) => updateDraft({ swing_h })}
                disabled={sending}
                wrap
              />
            </div>
            <div>
              <div className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-white/55">
                Funciones
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TOGGLES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    disabled={sending}
                    onClick={() => updateDraft({ [t.value]: !draft[t.value] })}
                    className={[
                      'min-w-[3.4rem] flex-1 rounded-lg border px-2 py-2 text-sm transition-colors disabled:opacity-40',
                      draft[t.value]
                        ? 'border-accent/70 bg-accent/35 text-white'
                        : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white',
                    ].join(' ')}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Collapsible>
      </Card>

      <TimerSection draft={draft} />

      {dirty && !sending && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#1a1730]/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto max-w-[40rem]">
            <button
              type="button"
              onClick={applyDraft}
              className="w-full rounded-xl bg-accent py-3 font-semibold text-white transition-colors hover:bg-accent/90"
            >
              Aplicar {changed} {changed === 1 ? 'cambio' : 'cambios'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
