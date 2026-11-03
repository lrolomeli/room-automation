const logger = require('../../logger');

const devices = new Map();

const bridge = {
  brokerConnected: false,
  state: 'unknown',
  version: null,
  lastMessageAt: null,
};

function flattenExposes(exposes, out = []) {
  if (!Array.isArray(exposes)) return out;
  for (const expose of exposes) {
    if (!expose || typeof expose !== 'object') continue;
    out.push(expose);
    if (Array.isArray(expose.features)) flattenExposes(expose.features, out);
  }
  return out;
}

function isWritable(expose) {
  return expose.access === undefined || (Number(expose.access) & 2) === 2;
}

function classify(device) {
  const definition = device.definition || {};
  const exposes = flattenExposes(definition.exposes);
  const stateExpose = exposes.find(
    (expose) => expose.property === 'state' && isWritable(expose),
  );
  if (stateExpose) {
    const values = Array.isArray(stateExpose.values) ? stateExpose.values : [];
    const onOff =
      stateExpose.type === 'switch' ||
      stateExpose.type === 'light' ||
      values.includes('ON') ||
      values.includes('OFF') ||
      stateExpose.value_on === 'ON' ||
      stateExpose.value_off === 'OFF' ||
      stateExpose.value_on === true ||
      stateExpose.value_off === false;
    if (onOff) return 'relay';
  }
  if (exposes.some((expose) => expose.property === 'action')) return 'button';
  return 'sensor';
}

function normalizeDevice(raw) {
  if (!raw || !raw.ieee_address) return null;
  if (raw.type === 'Coordinator') return null;
  if (raw.disabled) return null;
  if (raw.supported === false) return null;
  const definition = raw.definition || {};
  const kind = classify(raw);
  return {
    ieee: raw.ieee_address,
    name: raw.friendly_name || raw.ieee_address,
    vendor: definition.vendor || raw.manufacturer || '',
    model: definition.model || raw.model_id || '',
    description: definition.description || '',
    kind,
    controllable: kind === 'relay',
    state: undefined,
    availability: 'unknown',
    linkquality: undefined,
    lastSeen: undefined,
    action: undefined,
    readings: {},
    updatedAt: null,
  };
}

function applyBridgeDevices(list) {
  if (!Array.isArray(list)) return [];
  const next = new Map();
  for (const raw of list) {
    const device = normalizeDevice(raw);
    if (!device) continue;
    const previous = devices.get(device.ieee) || getByName(device.name);
    if (previous) {
      device.state = previous.state;
      device.availability = previous.availability;
      device.linkquality = previous.linkquality;
      device.lastSeen = previous.lastSeen;
      device.action = previous.action;
      device.readings = { ...previous.readings };
      device.updatedAt = previous.updatedAt;
    }
    next.set(device.ieee, device);
  }
  devices.clear();
  for (const [ieee, device] of next) devices.set(ieee, device);
  logger.info(`zigbee registry: ${devices.size} devices`);
  return listDevices();
}

function placeholder(name) {
  const device = {
    ieee: name,
    name,
    vendor: '',
    model: '',
    description: '',
    kind: 'sensor',
    controllable: false,
    state: undefined,
    availability: 'unknown',
    linkquality: undefined,
    lastSeen: undefined,
    action: undefined,
    readings: {},
    updatedAt: null,
  };
  devices.set(name, device);
  return device;
}

function getByName(name) {
  for (const device of devices.values()) {
    if (device.name === name) return device;
  }
  return null;
}

function getByIeee(ieee) {
  return devices.get(ieee) || null;
}

function getById(id) {
  return getByIeee(id) || getByName(id);
}

function listDevices() {
  return [...devices.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function snapshot() {
  return {
    bridge: { ...bridge },
    devices: listDevices(),
  };
}

function applyState(name, payload) {
  if (!payload || typeof payload !== 'object') return null;
  const device = getByName(name) || placeholder(name);
  const previous = {
    state: device.state,
    readings: { ...device.readings },
    action: device.action,
    linkquality: device.linkquality,
  };

  if (payload.state === 'ON' || payload.state === 'OFF') {
    device.state = payload.state;
  }
  if (typeof payload.action === 'string' && payload.action) {
    device.action = payload.action;
  }
  if (payload.last_seen) device.lastSeen = payload.last_seen;
  if (typeof payload.linkquality === 'number') device.linkquality = payload.linkquality;

  for (const [key, value] of Object.entries(payload)) {
    if (['state', 'action', 'last_seen', 'linkquality'].includes(key)) continue;
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      device.readings[key] = value;
    }
  }

  if (device.kind === 'sensor' && typeof payload.state === 'string') {
    // Algunos sensores publican `state` como texto; no es un relé.
    device.readings.state = payload.state;
  }

  const changed =
    previous.state !== device.state ||
    previous.action !== device.action ||
    previous.linkquality !== device.linkquality ||
    JSON.stringify(previous.readings) !== JSON.stringify(device.readings);

  device.updatedAt = new Date().toISOString();
  bridge.lastMessageAt = device.updatedAt;
  return { device, previous, changed };
}

function applyAvailability(name, payload) {
  const device = getByName(name) || placeholder(name);
  const value = String(payload || '').toLowerCase();
  device.availability = value === 'online' ? 'online' : value === 'offline' ? 'offline' : 'unknown';
  device.updatedAt = new Date().toISOString();
  return device;
}

function setBrokerConnected(value) {
  bridge.brokerConnected = !!value;
  if (!value) bridge.state = 'offline';
}

function setBridgeState(value) {
  const state = String(value || '').toLowerCase();
  bridge.state = state === 'online' ? 'online' : state === 'offline' ? 'offline' : 'unknown';
  bridge.lastMessageAt = new Date().toISOString();
}

function setVersion(value) {
  if (!value) return;
  bridge.version = value && typeof value === 'object' ? value.version || null : String(value);
}

function health() {
  return { ...bridge, deviceCount: devices.size };
}

module.exports = {
  applyBridgeDevices,
  applyState,
  applyAvailability,
  getByName,
  getByIeee,
  getById,
  listDevices,
  snapshot,
  setBrokerConnected,
  setBridgeState,
  setVersion,
  health,
};
