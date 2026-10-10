const persistence = require('./persistence');

const DEFAULTS = {
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

const MODE_RAW = { auto: 0, cool: 1, dry: 2, heat: 4, fan: 6 };
const FAN_RAW = { high: 1, med: 2, low: 3, auto: 5 };
const SWING_V_RAW = { off: 0, top: 1, middle: 2, bottom: 3, down: 10, auto: 12 };
const SWING_H_RAW = { middle: 0, left_max: 3, left: 4, right: 5, right_max: 6, auto: 7 };

const BOOL_FIELDS = ['power', 'turbo', 'quiet', 'sleep', 'health'];

let state = { ...DEFAULTS };

function parseBool(value) {
  return value === true || value === 1 || value === '1' ||
    value === 'on' || value === 'true' || value === 'yes';
}

function clampTemp(value) {
  const n = Math.round(Number(value));
  if (Number.isNaN(n)) return DEFAULTS.temp;
  return Math.min(30, Math.max(16, n));
}

function load() {
  const saved = persistence.loadAcState();
  if (saved && typeof saved === 'object') {
    state = { ...DEFAULTS, ...saved, temp: clampTemp(saved.temp ?? DEFAULTS.temp) };
  }
  return state;
}

function get() {
  return state;
}

/* Calcula el estado resultante de aplicar `partial` SIN modificar ni persistir. */
function preview(partial = {}) {
  const next = { ...state };

  for (const field of BOOL_FIELDS) {
    if (partial[field] !== undefined && partial[field] !== null && partial[field] !== '') {
      next[field] = parseBool(partial[field]);
    }
  }

  if (partial.temp !== undefined && partial.temp !== null && partial.temp !== '') {
    next.temp = clampTemp(partial.temp);
  }

  if (MODE_RAW[partial.mode] !== undefined) next.mode = partial.mode;
  if (FAN_RAW[partial.fan] !== undefined) next.fan = partial.fan;
  if (SWING_V_RAW[partial.swing_v] !== undefined) next.swing_v = partial.swing_v;
  if (SWING_H_RAW[partial.swing_h] !== undefined) next.swing_h = partial.swing_h;

  return next;
}

/* Fija y persiste el estado (solo tras confirmar el ESP). */
function commit(next) {
  state = { ...next };
  persistence.saveAcState(state);
  return state;
}

function serialize() {
  return {
    valid: true,
    power: state.power,
    temp: state.temp,
    mode: state.mode,
    mode_raw: MODE_RAW[state.mode],
    fan: state.fan,
    fan_raw: FAN_RAW[state.fan],
    swing_v: state.swing_v,
    swing_v_raw: SWING_V_RAW[state.swing_v],
    swing_h: state.swing_h,
    swing_h_raw: SWING_H_RAW[state.swing_h],
    turbo: state.turbo,
    quiet: state.quiet,
    sleep: state.sleep,
    health: state.health,
  };
}

function toEspParams(target = state) {
  return {
    power: target.power ? 'on' : 'off',
    temp: target.temp,
    mode: target.mode,
    fan: target.fan,
    swing_v: target.swing_v,
    swing_h: target.swing_h,
    turbo: target.turbo ? 1 : 0,
    quiet: target.quiet ? 1 : 0,
    sleep: target.sleep ? 1 : 0,
    health: target.health ? 1 : 0,
  };
}

load();

module.exports = { DEFAULTS, get, load, preview, commit, serialize, toEspParams };
