import { useEffect, useState } from 'react';
import Modal from '../components/ui/Modal';
import Banner from '../components/ui/Banner';
import SegmentedControl from '../components/ui/SegmentedControl';
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

export default function AcAdvancedModal({ open, onClose, ac, onApplied }) {
  const [draft, setDraft] = useState(ac || DEFAULT_AC);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDraft(ac || DEFAULT_AC);
    setError('');
    // Solo reiniciar al abrir; los updates de la sala no deben borrar el borrador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const update = (partial) => {
    setDraft((previous) => ({ ...previous, ...partial }));
    setError('');
  };

  const apply = async () => {
    setSending(true);
    setError('');
    try {
      await api.post('/api/room/ac', draft);
      await onApplied();
      onClose();
    } catch (err) {
      setError(`No se pudo aplicar: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Control completo"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/15 bg-white/5 py-3 text-sm text-white/75 transition-colors hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={sending}
            className="flex-1 rounded-xl bg-accent py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {sending ? 'Enviando…' : 'Aplicar'}
          </button>
        </div>
      }
    >
      {error && (
        <Banner variant="err" className="mb-3">
          {error}
        </Banner>
      )}

      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-white/55">Modo</div>
          <SegmentedControl
            options={MODES}
            value={draft.mode}
            onChange={(mode) => update({ mode })}
            disabled={sending}
            wrap
          />
        </div>

        <div>
          <div className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-white/55">
            Ventilador
          </div>
          <SegmentedControl
            options={FANS}
            value={draft.fan}
            onChange={(fan) => update({ fan })}
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
            onChange={(swing_v) => update({ swing_v })}
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
            onChange={(swing_h) => update({ swing_h })}
            disabled={sending}
            wrap
          />
        </div>

        <div>
          <div className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-white/55">
            Funciones
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TOGGLES.map((toggle) => (
              <button
                key={toggle.value}
                type="button"
                disabled={sending}
                onClick={() => update({ [toggle.value]: !draft[toggle.value] })}
                className={[
                  'min-w-[3.4rem] flex-1 rounded-lg border px-2 py-2 text-sm transition-colors disabled:opacity-40',
                  draft[toggle.value]
                    ? 'border-accent/70 bg-accent/35 text-white'
                    : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white',
                ].join(' ')}
              >
                {toggle.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
