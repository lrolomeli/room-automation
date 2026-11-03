const persistence = require('../data/persistence');
const sensors = require('../db/sensors');
const acState = require('../data/ac-state');
const { applyAcState } = require('../services/ac');

const MODES = ['auto', 'cool', 'dry', 'heat', 'fan'];
const FANS = ['auto', 'low', 'med', 'high'];
const FAN_ORDER = ['low', 'med', 'high'];
const HUMIDITY_ACTIONS = ['dry', 'cool'];
const LOG_LIMIT = 50;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const TIMEZONE = process.env.CLIMATE_TZ || 'America/Mexico_City';
const DAY_MS = 86400000;

/*
 * Parametros del lazo cerrado. El aire solo enfria: para "subir" la
 * temperatura se sube el setpoint o se apaga.
 */
const CONTROL = {
  toleranceC: 1.0,           // banda de confort antes de corregir
  setpointFloor: 22,         // setpoint minimo del AC al acelerar enfriamiento
  setpointCeil: 30,
  minCommandIntervalMin: 10, // minimo entre comandos (anti-beep)
  adjustIntervalMin: 15,     // minimo entre ajustes del lazo
  trendWindowMin: 10,        // ventana para medir el ritmo
  minTrendSpanMin: 5,        // datos minimos antes de juzgar el ritmo
  minDropPerWindowC: 0.3,    // caida esperada en la ventana si hay calor
  staleSensorMin: 5,         // sin lectura fresca -> mantener
};

/*
 * Los horarios se interpretan SIEMPRE en esta zona, sin importar el TZ del
 * servidor o contenedor (Docker suele correr en UTC). Usa Intl (ICU de Node),
 * por lo que no se necesita tzdata del sistema.
 */
const zoneFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/*
 * Las automatizaciones viven en el codigo (no en la UI). El usuario solo
 * decide si el motor esta encendido o apagado; el resto lo editamos aqui.
 *
 * Perfil de noche: 22:30 -> 04:30. La temperatura OBJETIVO del cuarto empieza
 * en 25C y sube despacio a 27C. El setpoint real del AC lo decide el lazo
 * cerrado segun la temperatura medida.
 */
const PRESET_ROUTINES = [
  {
    id: 'night',
    name: 'Noche',
    kind: 'ramp',
    adaptive: true,
    enabled: true,
    days: ALL_DAYS,
    start: '22:30',
    end: '04:30',
    fromTemp: 25,
    toTemp: 27,
    stepMinutes: 120,
    endAction: 'off',
    state: { mode: 'cool', fan: 'med' },
  },
];

const DEFAULTS = {
  enabled: true,
  minCycleMinutes: 4,
  resyncMinutes: 0,
  respectManualOverrideMin: 30,
  humidity: {
    enabled: true,
    thresholdPct: 65,
    hysteresisPct: 5,
    action: 'dry',
    targetTemp: 25,
  },
  routines: PRESET_ROUTINES,
};

let config = {
  ...DEFAULTS,
  humidity: { ...DEFAULTS.humidity },
  routines: PRESET_ROUTINES,
};
let log = [];

/* Runtime (no persistido) */
let humidityActive = false;
let lastPowerChangeAt = 0;
let lastApplyAt = 0;
let lastSendAt = 0;
let lastManualOverrideAt = 0;
let externalPause = false;
let lastControl = null;
let controller = { profileId: null, setpoint: null, fan: null, lastAdjustAt: 0 };
let tempHistory = [];

function clamp(n, min, max, fallback) {
  const v = Math.round(Number(n));
  if (Number.isNaN(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function bool(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return value === true || value === 1 || value === '1' ||
    value === 'on' || value === 'true' || value === 'yes';
}

function parseTime(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return { h, m: min, label: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`, minutes: h * 60 + min };
}

function sanitizeDays(value) {
  if (!Array.isArray(value)) return [...ALL_DAYS];
  const days = [...new Set(value.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  return days.length ? days : [...ALL_DAYS];
}

function sanitizeRoutine(input, index) {
  const state = input && input.state && typeof input.state === 'object' ? input.state : {};
  const kind = input && input.kind === 'ramp' ? 'ramp' : 'at';
  const base = {
    id: input && input.id ? String(input.id) : `r${Date.now()}${index}`,
    name: input && input.name ? String(input.name).slice(0, 40) : `Rutina ${index + 1}`,
    kind,
    enabled: input && input.enabled !== undefined ? bool(input.enabled, true) : true,
    days: sanitizeDays(input && input.days),
    state: {
      mode: MODES.includes(state.mode) ? state.mode : 'cool',
      temp: clamp(state.temp, 16, 30, 25),
      fan: FANS.includes(state.fan) ? state.fan : 'med',
    },
  };

  if (kind === 'ramp') {
    const start = parseTime(input && input.start) || parseTime('22:30');
    const end = parseTime(input && input.end) || parseTime('04:30');
    return {
      ...base,
      adaptive: input && input.adaptive === true,
      start: start.label,
      end: end.label,
      fromTemp: clamp(input && input.fromTemp, 16, 30, 25),
      toTemp: clamp(input && input.toTemp, 16, 30, 27),
      stepMinutes: clamp(input && input.stepMinutes, 15, 720, 120),
      endAction: input && input.endAction === 'hold' ? 'hold' : 'off',
    };
  }

  const time = parseTime(input && input.time) || parseTime('08:00');
  return {
    ...base,
    time: time.label,
    action: input && input.action === 'off' ? 'off' : 'on',
  };
}

function buildConfig() {
  return {
    enabled: DEFAULTS.enabled,
    minCycleMinutes: DEFAULTS.minCycleMinutes,
    resyncMinutes: DEFAULTS.resyncMinutes,
    respectManualOverrideMin: DEFAULTS.respectManualOverrideMin,
    humidity: { ...DEFAULTS.humidity },
    routines: PRESET_ROUTINES.map(sanitizeRoutine),
  };
}

function load() {
  config = buildConfig();
  const saved = persistence.loadClimateConfig();
  if (saved && typeof saved.enabled !== 'undefined') {
    config.enabled = bool(saved.enabled, DEFAULTS.enabled);
  }
  const savedLog = persistence.loadClimateLog();
  log = Array.isArray(savedLog) ? savedLog.slice(0, LOG_LIMIT) : [];
  return config;
}

function getConfig() {
  return config;
}

function getLog() {
  return log;
}

function setEnabled(value) {
  config.enabled = bool(value, config.enabled);
  controller.profileId = null;
  persistence.saveClimateConfig({ enabled: config.enabled });
  return config.enabled;
}

function addLog(entry) {
  log = [{ ts: new Date().toISOString(), ...entry }, ...log].slice(0, LOG_LIMIT);
  persistence.saveClimateLog(log);
}

function noteManualOverride() {
  lastManualOverrideAt = Date.now();
}

/* El temporizador pausa el motor mientras controla el aire por su cuenta. */
function setExternalPause(value) {
  externalPause = !!value;
  return externalPause;
}

/*
 * Descompone una fecha en hora civil de TIMEZONE. `stamp` permite comparar
 * instantes civiles entre dias; `dayNum` es el numero de dia civil.
 */
function zonedParts(date) {
  const parts = {};
  for (const { type, value } of zoneFormatter.formatToParts(date)) {
    if (type !== 'literal') parts[type] = value;
  }
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  const dayNum = Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
  return {
    year,
    month,
    day,
    hour,
    minute,
    dayNum,
    weekday: new Date(dayNum * DAY_MS).getUTCDay(),
    minutesOfDay: hour * 60 + minute,
    stamp: Date.UTC(year, month - 1, day, hour, minute),
  };
}

function inCooldown(now) {
  return now.getTime() - lastPowerChangeAt < config.minCycleMinutes * 60000;
}

/* Ventana (inicio/fin) de una rampa para el dia en que arranca. Soporta cruzar medianoche. */
function rampWindow(routine, anchorDayNum) {
  const start = parseTime(routine.start);
  const end = parseTime(routine.end);
  if (!start || !end) return null;
  const startStamp = anchorDayNum * DAY_MS + start.minutes * 60000;
  const endDayNum = end.minutes > start.minutes ? anchorDayNum : anchorDayNum + 1;
  const endStamp = endDayNum * DAY_MS + end.minutes * 60000;
  return { start, end, startStamp, endStamp };
}

function activeRamp(z) {
  for (const routine of config.routines) {
    if (!routine.enabled || routine.kind !== 'ramp') continue;
    for (const anchor of [z.dayNum, z.dayNum - 1]) {
      const anchorWeekday = new Date(anchor * DAY_MS).getUTCDay();
      if (!routine.days.includes(anchorWeekday)) continue;
      const win = rampWindow(routine, anchor);
      if (!win || z.stamp < win.startStamp || z.stamp > win.endStamp) continue;
      const elapsed = Math.floor((z.stamp - win.startStamp) / 60000);
      const steps = Math.floor(elapsed / routine.stepMinutes);
      const targetTemp = Math.min(routine.toTemp, routine.fromTemp + steps);
      return { routine, targetTemp, win };
    }
  }
  return null;
}

function routineEvents(routine, anchor) {
  if (routine.kind === 'ramp') {
    const win = rampWindow(routine, anchor);
    if (!win) return [];
    return [
      {
        stamp: win.startStamp,
        state: { power: true, mode: routine.state.mode, temp: routine.fromTemp, fan: routine.state.fan, rule: routine.name },
      },
      {
        stamp: win.endStamp,
        state: routine.endAction === 'off'
          ? { power: false, rule: routine.name }
          : { power: true, mode: routine.state.mode, temp: routine.toTemp, fan: routine.state.fan, rule: routine.name },
      },
    ];
  }
  const time = parseTime(routine.time);
  if (!time) return [];
  return [{
    stamp: anchor * DAY_MS + time.minutes * 60000,
    state: routine.action === 'off'
      ? { power: false, rule: routine.name }
      : { power: true, mode: routine.state.mode, temp: routine.state.temp, fan: routine.state.fan, rule: routine.name },
  }];
}

function latestEventState(z) {
  let best = null;
  for (let offset = 0; offset < 7; offset += 1) {
    const anchor = z.dayNum - offset;
    const anchorWeekday = new Date(anchor * DAY_MS).getUTCDay();
    for (const routine of config.routines) {
      if (!routine.enabled || !routine.days.includes(anchorWeekday)) continue;
      for (const ev of routineEvents(routine, anchor)) {
        if (ev.stamp > z.stamp) continue;
        if (!best || ev.stamp > best.stamp) best = ev;
      }
    }
  }
  return best ? best.state : null;
}

/*
 * Estado de horario vigente. Si hay una rampa activa devuelve el objetivo de
 * cuarto (para el lazo cerrado). Si no, toma el ultimo evento de los 7 dias.
 */
function scheduleBase(now) {
  const z = zonedParts(now);
  const active = activeRamp(z);
  if (active) {
    return {
      power: true,
      mode: active.routine.state.mode,
      fan: active.routine.state.fan,
      rule: active.routine.name,
      adaptive: active.routine.adaptive === true,
      targetRoomTemp: active.targetTemp,
      routineId: active.routine.id,
      routine: active.routine,
    };
  }
  return latestEventState(z);
}

function humidityDecision() {
  const rule = config.humidity;
  if (!rule.enabled) {
    humidityActive = false;
    return { active: false, humidity: null };
  }
  const latest = sensors.getLatest();
  if (!latest || latest.humidity == null) return { active: humidityActive, humidity: null };
  const humidity = Number(latest.humidity);
  const release = rule.thresholdPct - rule.hysteresisPct;

  if (!humidityActive && humidity >= rule.thresholdPct) humidityActive = true;
  else if (humidityActive && humidity <= release) humidityActive = false;

  return { active: humidityActive, humidity };
}

/* --- Lazo cerrado ------------------------------------------------------- */

function fmt(n) {
  return Number(n).toFixed(1);
}

function recordTemp(now, latest) {
  const t = Date.parse(latest.timestamp);
  const stamp = Number.isNaN(t) ? now.getTime() : t;
  if (!tempHistory.length || tempHistory[tempHistory.length - 1].t !== stamp) {
    tempHistory.push({ t: stamp, temp: Number(latest.temperature) });
  }
  const cutoff = now.getTime() - (CONTROL.trendWindowMin + 10) * 60000;
  tempHistory = tempHistory.filter((s) => s.t >= cutoff);
}

function trendInfo(now) {
  if (tempHistory.length < 2) return { slope: 0, span: 0 };
  const targetT = now.getTime() - CONTROL.trendWindowMin * 60000;
  let base = tempHistory[0];
  for (const s of tempHistory) {
    if (s.t <= targetT) base = s;
    else break;
  }
  const last = tempHistory[tempHistory.length - 1];
  const span = (last.t - base.t) / 60000;
  if (span <= 0) return { slope: 0, span: 0 };
  return { slope: (last.temp - base.temp) / span, span };
}

function isFresh(latest, now) {
  const t = Date.parse(latest.timestamp);
  if (Number.isNaN(t)) return true;
  return Math.abs(now.getTime() - t) <= CONTROL.staleSensorMin * 60000;
}

function nextFan(fan) {
  const i = FAN_ORDER.indexOf(fan);
  if (i < 0) return 'med';
  return FAN_ORDER[Math.min(FAN_ORDER.length - 1, i + 1)];
}

function adaptiveTarget(now, base) {
  const targetRoom = base.targetRoomTemp;
  const cur = acState.get();
  const latest = sensors.getLatest();

  let setpoint;
  if (controller.profileId !== base.routineId) {
    controller = {
      profileId: base.routineId,
      setpoint: cur.power
        ? clamp(cur.temp, CONTROL.setpointFloor, CONTROL.setpointCeil, targetRoom)
        : clamp(targetRoom, CONTROL.setpointFloor, CONTROL.setpointCeil, targetRoom),
      fan: cur.power && FANS.includes(cur.fan) ? cur.fan : (base.fan || 'med'),
      lastAdjustAt: now.getTime(),
    };
  }
  setpoint = controller.setpoint;
  let fan = controller.fan;

  if (!latest || latest.temperature == null) {
    lastControl = {
      targetTemp: targetRoom,
      roomTemp: null,
      slope: 0,
      setpoint,
      fan,
      reason: 'sin sensor, mantengo setpoint',
      at: now.toISOString(),
    };
    return {
      target: { power: true, mode: base.mode, temp: setpoint, fan },
      rule: base.rule,
      detail: `sin sensor, ${setpoint}C`,
    };
  }

  const room = Number(latest.temperature);
  recordTemp(now, latest);
  const { slope, span } = trendInfo(now);
  const fresh = isFresh(latest, now);
  const error = room - targetRoom;
  const canAdjust = now.getTime() - controller.lastAdjustAt >= CONTROL.adjustIntervalMin * 60000;

  let power = true;
  let reason;

  if (!fresh) {
    power = cur.power;
    reason = `sensor sin datos recientes (${fmt(room)}C), mantengo`;
  } else if (!cur.power) {
    if (error > CONTROL.toleranceC) {
      reason = `encender ${setpoint}C (cuarto ${fmt(room)}C, obj ${targetRoom}C)`;
    } else {
      power = false;
      reason = `en espera (cuarto ${fmt(room)}C, obj ${targetRoom}C)`;
    }
  } else if (error < -CONTROL.toleranceC) {
    if (canAdjust) {
      if (setpoint < CONTROL.setpointCeil) {
        setpoint += 1;
        controller.setpoint = setpoint;
        controller.lastAdjustAt = now.getTime();
        reason = `frio (${fmt(room)}C) subo setpoint a ${setpoint}C`;
      } else {
        power = false;
        reason = `frio (${fmt(room)}C) apago para templar`;
      }
    } else {
      reason = `frio (${fmt(room)}C), espero intervalo`;
    }
  } else if (error > CONTROL.toleranceC) {
    const coolingEnough = span < CONTROL.minTrendSpanMin ||
      slope * CONTROL.trendWindowMin <= -CONTROL.minDropPerWindowC;
    if (!coolingEnough && canAdjust) {
      if (setpoint > CONTROL.setpointFloor) {
        setpoint -= 1;
        controller.setpoint = setpoint;
        controller.lastAdjustAt = now.getTime();
        reason = `no enfria (${slope >= 0 ? '+' : ''}${slope.toFixed(2)}C/min) bajo setpoint a ${setpoint}C`;
      } else {
        fan = nextFan(fan);
        controller.fan = fan;
        controller.lastAdjustAt = now.getTime();
        reason = `no enfria en piso, subo fan a ${fan}`;
      }
    } else if (!coolingEnough) {
      reason = `caliente (${fmt(room)}C), espero intervalo`;
    } else {
      reason = `enfriando (${slope.toFixed(2)}C/min)`;
    }
  } else {
    reason = `en banda (${fmt(room)}C, obj ${targetRoom}C)`;
  }

  lastControl = {
    targetTemp: targetRoom,
    roomTemp: room,
    slope: Number(slope.toFixed(3)),
    setpoint,
    fan,
    reason,
    at: now.toISOString(),
  };

  if (!power) return { target: { power: false }, rule: base.rule, detail: reason };
  return { target: { power: true, mode: base.mode, temp: setpoint, fan }, rule: base.rule, detail: reason };
}

function computeTarget(now) {
  const base = scheduleBase(now);
  const humidity = humidityDecision();

  if (humidity.active) {
    const target = { power: true, mode: config.humidity.action, temp: config.humidity.targetTemp };
    if (base && base.power && base.fan) target.fan = base.fan;
    const pct = humidity.humidity == null ? '?' : humidity.humidity;
    return {
      target,
      rule: 'Higrostato',
      detail: `humedad ${pct}% -> ${config.humidity.action} ${config.humidity.targetTemp}C`,
    };
  }

  if (base && base.power && base.adaptive) {
    return adaptiveTarget(now, base);
  }

  controller.profileId = null;

  if (base) {
    if (!base.power) return { target: { power: false }, rule: base.rule, detail: 'apagar' };
    return {
      target: { power: true, mode: base.mode, temp: base.temp, fan: base.fan },
      rule: base.rule,
      detail: `${base.mode} ${base.temp}C`,
    };
  }

  return { target: { power: false }, rule: 'Automático', detail: 'sin regla activa' };
}

async function maybeResync(now) {
  if (config.resyncMinutes <= 0) return;
  if (now.getTime() - lastApplyAt < config.resyncMinutes * 60000) return;
  if (!acState.get().power) return;
  try {
    await applyAcState({});
    lastApplyAt = now.getTime();
    lastSendAt = now.getTime();
  } catch (err) {
    addLog({ rule: 'resync', detail: 'reenvio fallido', ok: false, error: err.message });
  }
}

async function tick(now = new Date(), { force = false } = {}) {
  if (!config.enabled && !force) return { ran: false, reason: 'disabled' };

  if (externalPause) return { ran: false, reason: 'timer' };

  const manualPause = !force && config.respectManualOverrideMin > 0 &&
    now.getTime() - lastManualOverrideAt < config.respectManualOverrideMin * 60000;
  if (manualPause) return { ran: false, reason: 'manual-override' };

  const { target, rule, detail } = computeTarget(now);

  const current = acState.get();
  const already = target.power === current.power &&
    (target.mode === undefined || target.mode === current.mode) &&
    (target.temp === undefined || target.temp === current.temp) &&
    (target.fan === undefined || target.fan === current.fan);
  if (already) {
    await maybeResync(now);
    return { ran: true, applied: false };
  }

  // Anti-beep: minimo entre comandos, salvo apagar o forzar.
  if (!force && target.power !== false &&
      now.getTime() - lastSendAt < CONTROL.minCommandIntervalMin * 60000) {
    return { ran: true, applied: false, reason: 'min-command-interval' };
  }

  const changesPower = target.power !== current.power;
  if (changesPower && inCooldown(now) && !force) {
    addLog({ rule, detail: `${detail} (omitido por anti-ciclado)`, ok: false });
    return { ran: true, applied: false, reason: 'cooldown' };
  }

  try {
    await applyAcState(target);
    lastApplyAt = now.getTime();
    lastSendAt = now.getTime();
    if (changesPower) lastPowerChangeAt = now.getTime();
    addLog({ rule, detail, ok: true });
    return { ran: true, applied: true };
  } catch (err) {
    addLog({ rule, detail, ok: false, error: err.message });
    return { ran: true, applied: false, error: err.message };
  }
}

function sensorSnapshot() {
  const latest = sensors.getLatest();
  if (!latest) return null;
  return {
    temperature: latest.temperature,
    humidity: latest.humidity,
    unit: latest.unit || 'celsius',
    timestamp: latest.timestamp,
  };
}

function nextRoutine(now = new Date()) {
  const z = zonedParts(now);
  for (let offset = 0; offset < 7; offset += 1) {
    const dayNum = z.dayNum + offset;
    const dayIndex = new Date(dayNum * DAY_MS).getUTCDay();
    let best = null;
    for (const routine of config.routines) {
      if (!routine.enabled || !routine.days.includes(dayIndex)) continue;
      const parsed = routine.kind === 'ramp' ? parseTime(routine.start) : parseTime(routine.time);
      if (!parsed) continue;
      const eventStamp = dayNum * DAY_MS + parsed.minutes * 60000;
      if (eventStamp < z.stamp) continue;
      const deltaMin = Math.round((eventStamp - z.stamp) / 60000);
      if (!best || deltaMin < best.inMinutes) {
        best = {
          name: routine.name,
          time: parsed.label,
          action: routine.kind === 'ramp' ? 'ramp' : routine.action,
          inMinutes: deltaMin,
        };
      }
    }
    if (best) return best;
  }
  return null;
}

function describeSchedule() {
  return config.routines.map((routine) => (
    routine.kind === 'ramp'
      ? {
          id: routine.id,
          name: routine.name,
          kind: 'ramp',
          adaptive: routine.adaptive === true,
          enabled: routine.enabled,
          days: routine.days,
          start: routine.start,
          end: routine.end,
          fromTemp: routine.fromTemp,
          toTemp: routine.toTemp,
          stepMinutes: routine.stepMinutes,
          mode: routine.state.mode,
          fan: routine.state.fan,
          endAction: routine.endAction,
        }
      : {
          id: routine.id,
          name: routine.name,
          kind: 'at',
          enabled: routine.enabled,
          days: routine.days,
          time: routine.time,
          action: routine.action,
          state: routine.state,
        }
  ));
}

function status() {
  return {
    enabled: config.enabled,
    humidityActive,
    manualOverrideActive:
      config.respectManualOverrideMin > 0 &&
      Date.now() - lastManualOverrideAt < config.respectManualOverrideMin * 60000,
    sensor: sensorSnapshot(),
    ac: acState.serialize(),
    timezone: TIMEZONE,
    control: lastControl,
    nextRoutine: nextRoutine(),
    schedule: describeSchedule(),
    humidity: { ...config.humidity },
    log,
  };
}

load();

module.exports = {
  DEFAULTS,
  CONTROL,
  load,
  getConfig,
  getLog,
  setEnabled,
  noteManualOverride,
  setExternalPause,
  tick,
  status,
};
