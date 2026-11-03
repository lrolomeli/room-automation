const fs = require('fs');
const YAML = require('yaml');
const config = require('../../config');
const logger = require('../../logger');
const bus = require('../../bus');
const registry = require('./registry');

const LOG_LIMIT = 50;
const DEFAULT_COOLDOWN_MS = 1000;

let rules = [];
let mode = config.automationModeOverride || config.automationMode || 'shadow';
let log = [];
let initialized = false;
const lastValues = new Map();
const lastTriggered = new Map();

function addLog(entry) {
  const record = { ts: new Date().toISOString(), ...entry };
  log = [record, ...log].slice(0, LOG_LIMIT);
  bus.emit('automation.log', record);
}

function loadRules() {
  try {
    const raw = fs.readFileSync(config.automationsFile, 'utf8');
    const parsed = YAML.parse(raw) || {};
    if (!config.automationModeOverride && (parsed.mode === 'live' || parsed.mode === 'shadow')) {
      mode = parsed.mode;
    }
    const list = Array.isArray(parsed.rules) ? parsed.rules : [];
    rules = list
      .filter((rule) => rule && rule.id && rule.when && rule.then)
      .map((rule) => ({
        id: String(rule.id),
        when: {
          device: String(rule.when.device || ''),
          property: String(rule.when.property || ''),
          equals: rule.when.equals,
        },
        then: {
          device: String(rule.then.device || ''),
          state: ['ON', 'OFF', 'TOGGLE'].includes(String(rule.then.state || '').toUpperCase())
            ? String(rule.then.state).toUpperCase()
            : '',
        },
        cooldownMs: Number(rule.cooldownMs) || DEFAULT_COOLDOWN_MS,
      }))
      .filter((rule) => rule.when.device && rule.when.property && rule.then.device && rule.then.state);
    logger.info(`automations: ${rules.length} rules, mode=${mode}`);
    return status();
  } catch (err) {
    logger.error('automations load failed:', err.message);
    rules = [];
    return status();
  }
}

function getValue(device, property) {
  if (property === 'state') return device.state;
  if (property === 'action') return device.action;
  if (property === 'linkquality') return device.linkquality;
  if (property === 'last_seen') return device.lastSeen;
  if (Object.prototype.hasOwnProperty.call(device.readings, property)) {
    return device.readings[property];
  }
  return undefined;
}

function matchesDevice(rule, device) {
  return rule.when.device === device.name || rule.when.device === device.ieee;
}

function execute(rule) {
  const target = registry.getById(rule.then.device);
  if (!target) {
    addLog({
      rule: rule.id,
      ok: false,
      detail: `destino ${rule.then.device} no encontrado`,
    });
    return;
  }

  const desiredState =
    rule.then.state === 'TOGGLE'
      ? target.state === 'ON'
        ? 'OFF'
        : 'ON'
      : rule.then.state;

  if (mode === 'shadow') {
    addLog({
      rule: rule.id,
      ok: true,
      shadow: true,
      detail: `[shadow] ${target.name} -> ${desiredState}`,
    });
    return;
  }
  addLog({
    rule: rule.id,
    ok: true,
    detail: `${target.name} -> ${desiredState}`,
  });
  bus.emit('zigbee.command.request', {
    deviceId: target.ieee,
    state: desiredState,
    source: rule.id,
  });
}

function onDeviceUpdate({ device, payload }) {
  if (!device || rules.length === 0) return;
  for (const rule of rules) {
    if (!matchesDevice(rule, device)) continue;
    const value = getValue(device, rule.when.property);
    if (value === undefined) continue;

    if (rule.when.property === 'action') {
      // Los pulsadores repiten la misma acción; no esperamos un cambio
      // de valor como en occupancy. Disparamos en cada mensaje con action.
      if (!payload || !Object.prototype.hasOwnProperty.call(payload, 'action')) continue;
      lastValues.set(rule.id, value);
      if (value !== rule.when.equals) continue;
    } else {
      const previous = lastValues.get(rule.id);
      lastValues.set(rule.id, value);
      if (previous === value) continue;
      if (value !== rule.when.equals) continue;
    }

    const now = Date.now();
    const last = lastTriggered.get(rule.id) || 0;
    if (now - last < rule.cooldownMs) continue;
    lastTriggered.set(rule.id, now);
    execute(rule);
  }
}

function setMode(nextMode) {
  if (nextMode !== 'shadow' && nextMode !== 'live') {
    const err = new Error('mode must be shadow or live');
    err.statusCode = 400;
    throw err;
  }
  mode = nextMode;
  logger.info(`automations mode=${mode}`);
  return status();
}

function status() {
  return {
    mode,
    rules: rules.map((rule) => ({
      id: rule.id,
      when: { ...rule.when },
      then: { ...rule.then },
      cooldownMs: rule.cooldownMs,
    })),
    log,
  };
}

function init() {
  if (!initialized) {
    bus.on('zigbee.device.update', onDeviceUpdate);
    // Al descubrir/renombrar dispositivos, reevalúa el estado actual.
    // Así no se pierden reglas si un mensaje de estado llegó antes que
    // bridge/devices al arrancar.
    bus.on('zigbee.devices', () => {
      lastValues.clear();
      for (const device of registry.listDevices()) onDeviceUpdate({ device });
    });
    initialized = true;
  }
  return loadRules();
}

function reload() {
  lastValues.clear();
  lastTriggered.clear();
  return loadRules();
}

module.exports = {
  init,
  reload,
  status,
  setMode,
  getMode: () => mode,
};
