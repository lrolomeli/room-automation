export type DeviceKind = 'relay' | 'sensor' | 'button';

export interface ZigbeeDevice {
  ieee: string;
  name: string;
  vendor: string;
  model: string;
  description: string;
  kind: DeviceKind;
  controllable: boolean;
  state?: 'ON' | 'OFF';
  availability: 'online' | 'offline' | 'unknown';
  linkquality?: number;
  lastSeen?: string;
  action?: string;
  readings: Record<string, unknown>;
  updatedAt?: string | null;
}

export interface Bridge {
  brokerConnected?: boolean;
  mqttConnected?: boolean;
  state: 'online' | 'offline' | 'unknown';
  version?: string | null;
  lastMessageAt?: string | null;
  deviceCount?: number;
  connected?: boolean;
  pending?: number;
}

export interface RoomSensor {
  temperature: number;
  humidity: number;
  unit?: string;
  timestamp: string;
  stale?: boolean;
  ageSeconds?: number | null;
}

export interface AcState {
  valid: boolean;
  power: boolean;
  temp: number;
  mode: string;
  fan: string;
  swing_v?: string;
  swing_h?: string;
  turbo?: boolean;
  quiet?: boolean;
  sleep?: boolean;
  health?: boolean;
}

export interface RoomTimer {
  active: boolean;
  mode: string | null;
  onMinutes: number | null;
  offMinutes: number;
  phase: string | null;
  settings: Record<string, unknown> | null;
  startedAt: string | null;
  endsAt: string | null;
  secondsRemaining: number;
}

export interface ClimateStatus {
  enabled: boolean;
  humidityActive: boolean;
  manualOverrideActive: boolean;
  sensor: RoomSensor | null;
  ac: AcState | null;
  timezone: string;
  control: {
    targetTemp?: number;
    roomTemp?: number | null;
    slope?: number;
    setpoint?: number;
    fan?: string;
    reason?: string;
    at?: string;
  } | null;
  nextRoutine: { name: string; time: string; action: string; inMinutes: number } | null;
  schedule: Array<Record<string, unknown>>;
  humidity: Record<string, unknown>;
  log: Array<Record<string, unknown>>;
}

export interface RoomStatus {
  sensor: RoomSensor | null;
  ac: AcState | null;
  timer: RoomTimer;
  climate: ClimateStatus;
  updatedAt: string;
}

export interface AutomationRule {
  id: string;
  when: { device: string; property: string; equals: unknown };
  then: { device: string; state: string };
  cooldownMs: number;
}

export interface AutomationStatus {
  mode: 'shadow' | 'live';
  rules: AutomationRule[];
  log: Array<Record<string, unknown>>;
}

export interface HubSnapshot {
  serverTime: string;
  bridge: Bridge;
  zigbee: { devices: ZigbeeDevice[] };
  room: RoomStatus | null;
  automations: AutomationStatus;
  meta: { climateTz: string; automationMode: string };
}
