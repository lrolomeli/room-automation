import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type {
  AutomationStatus,
  Bridge,
  HubSnapshot,
  RoomStatus,
  ZigbeeDevice,
} from '../lib/types';

function toDeviceMap(devices: ZigbeeDevice[]): Record<string, ZigbeeDevice> {
  return Object.fromEntries(devices.map((device) => [device.ieee, device]));
}

export function useRealtime() {
  const [connected, setConnected] = useState(false);
  const [devices, setDevices] = useState<Record<string, ZigbeeDevice>>({});
  const [bridge, setBridge] = useState<Bridge | null>(null);
  const [room, setRoom] = useState<RoomStatus | null>(null);
  const [automations, setAutomations] = useState<AutomationStatus | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const applySnapshot = useCallback((snapshot: HubSnapshot) => {
    if (!snapshot) return;
    setBridge(snapshot.bridge || null);
    setDevices(toDeviceMap(snapshot.zigbee?.devices || []));
    setRoom(snapshot.room || null);
    setAutomations(snapshot.automations || null);
    setLastError(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const snapshot = await api.get<HubSnapshot>('/api/state');
      applySnapshot(snapshot);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : 'No se pudo actualizar el estado');
    }
  }, [applySnapshot]);

  useEffect(() => {
    let stopped = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let socket: WebSocket | null = null;
    let authChecked = false;

    const scheduleReconnect = () => {
      if (stopped) return;
      const delay = Math.min(15000, 1000 * 2 ** retry);
      retry += 1;
      timer = setTimeout(connect, delay);
    };

    const connect = () => {
      if (stopped) return;
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${protocol}://${window.location.host}/ws`);

      socket.onopen = () => {
        if (stopped) return;
        retry = 0;
        setConnected(true);
        refresh();
      };

      socket.onmessage = (event) => {
        let message: { type: string; data: unknown };
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        switch (message.type) {
          case 'snapshot':
            applySnapshot(message.data as HubSnapshot);
            break;
          case 'zigbee.device': {
            const device = message.data as ZigbeeDevice;
            setDevices((previous) => ({
              ...previous,
              [device.ieee]: { ...(previous[device.ieee] || {}), ...device },
            }));
            break;
          }
          case 'zigbee.devices':
            setDevices(toDeviceMap(message.data as ZigbeeDevice[]));
            break;
          case 'zigbee.bridge':
            setBridge(message.data as Bridge);
            break;
          case 'room.status':
            setRoom(message.data as RoomStatus);
            break;
          case 'room.sensor': {
            const reading = message.data as Record<string, unknown>;
            setRoom((previous) =>
              previous
                ? {
                    ...previous,
                    sensor: { ...(previous.sensor || {}), ...reading } as RoomStatus['sensor'],
                  }
                : previous,
            );
            break;
          }
          case 'automation.log': {
            const entry = message.data as Record<string, unknown>;
            setAutomations((previous) =>
              previous
                ? { ...previous, log: [entry, ...previous.log].slice(0, 50) }
                : previous,
            );
            break;
          }
          default:
            break;
        }
      };

      socket.onclose = () => {
        if (stopped) return;
        setConnected(false);
        if (retry >= 3 && !authChecked) {
          authChecked = true;
          api.get('/api/auth/me').catch(() => {
            authChecked = false;
          });
        }
        scheduleReconnect();
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close();
      }
    };
  }, [applySnapshot, refresh]);

  return { connected, devices, bridge, room, automations, lastError, refresh };
}
