const acState = require('../data/ac-state');
const { applyAcState } = require('../services/ac');
const climate = require('./climate');

const LOOP_OFF_MIN = 15;
const MIN_ON_MINUTES = 1;
const MAX_ON_MINUTES = 1440;

let timer = null;

function clampMinutes(value, fallback) {
  const n = Math.round(Number(value));
  if (Number.isNaN(n)) return fallback;
  return Math.min(MAX_ON_MINUTES, Math.max(MIN_ON_MINUTES, n));
}

function snapshotSettings(partial) {
  const base = acState.preview(partial || {});
  return {
    power: true,
    temp: base.temp,
    mode: base.mode,
    fan: base.fan,
    swing_v: base.swing_v,
    swing_h: base.swing_h,
    turbo: base.turbo,
    quiet: base.quiet,
    sleep: base.sleep,
    health: base.health,
  };
}

async function start({ minutes, loop = false, state } = {}) {
  const onMinutes = clampMinutes(minutes, 30);
  const now = Date.now();

  timer = {
    mode: loop ? 'loop' : 'once',
    onMinutes,
    offMinutes: LOOP_OFF_MIN,
    settings: snapshotSettings(state),
    phase: 'on',
    startedAt: now,
    endsAt: now + onMinutes * 60000,
  };

  climate.setExternalPause(true);

  try {
    await applyAcState(timer.settings);
  } catch (err) {
    timer = null;
    climate.setExternalPause(false);
    throw err;
  }

  return status();
}

async function stop({ turnOff = true } = {}) {
  timer = null;

  if (turnOff) {
    try {
      await applyAcState({ power: false });
    } catch {
      /* el ESP pudo no responder; el temporizador ya está desactivado */
    }
  }

  climate.setExternalPause(false);
  return status();
}

async function tick(now = Date.now()) {
  if (!timer) return { active: false };
  if (now < timer.endsAt) return { active: true, applied: false };

  try {
    if (timer.phase === 'on') {
      if (timer.mode === 'once') {
        await stop({ turnOff: true });
        return { active: false, applied: true };
      }
      await applyAcState({ power: false });
      timer.phase = 'off';
      timer.endsAt = now + timer.offMinutes * 60000;
      return { active: true, applied: true, phase: 'off' };
    }

    await applyAcState(timer.settings);
    timer.phase = 'on';
    timer.endsAt = now + timer.onMinutes * 60000;
    return { active: true, applied: true, phase: 'on' };
  } catch (err) {
    return { active: true, applied: false, error: err.message };
  }
}

function status(now = Date.now()) {
  if (!timer) {
    return {
      active: false,
      mode: null,
      onMinutes: null,
      offMinutes: LOOP_OFF_MIN,
      phase: null,
      settings: null,
      startedAt: null,
      endsAt: null,
      secondsRemaining: 0,
    };
  }

  return {
    active: true,
    mode: timer.mode,
    onMinutes: timer.onMinutes,
    offMinutes: timer.offMinutes,
    phase: timer.phase,
    settings: timer.settings,
    startedAt: new Date(timer.startedAt).toISOString(),
    endsAt: new Date(timer.endsAt).toISOString(),
    secondsRemaining: Math.max(0, Math.ceil((timer.endsAt - now) / 1000)),
  };
}

module.exports = { LOOP_OFF_MIN, start, stop, tick, status };
