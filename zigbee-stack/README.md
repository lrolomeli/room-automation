# Zigbee stack

Mosquitto + Zigbee2MQTT, en su propio `docker-compose.yml`.

## Red

El hub y este stack comparten la red externa `zigbee-net`:

```bash
docker network create zigbee-net
```

`start.sh` en la raíz la crea si no existe.

## Arranque

```bash
cd zigbee-stack
docker compose up -d
```

- **Mosquitto:** sin puerto público. Solo accesible por `zigbee-net`.
- **Zigbee2MQTT:** `http://127.0.0.1:8080` para administración/pairing.
  No lo expongas a Internet; usa LAN, VPN o túnel SSH.
- El dongle se monta como `/dev/ttyUSB0`.

## Configuración

El `configuration.yaml` real está ignorado por git porque contiene la topología
y los nombres de tus dispositivos. Parte del ejemplo:

```bash
cp zigbee2mqtt/configuration.example.yaml zigbee2mqtt/configuration.yaml
```

En una instalación existente, ese archivo ya existe localmente y no se sube.

## Network key

La network key **no está en git**. Vive en `zigbee2mqtt/secrets.yaml`
(ignorado por `.gitignore`) y `configuration.yaml` la referencia con:

```yaml
network_key: !secret network_key
```

Si clonas esto en otra máquina:

1. Copia `secrets.yaml.example` a `secrets.yaml`.
2. Pega tu network key real de 16 bytes, o restaura un backup.
3. Si es una red nueva, genera una:
   ```bash
   node -e "console.log(Array.from(require('crypto').randomBytes(16)))"
   ```

No subas `secrets.yaml`, `database.db`, `state.json` ni
`coordinator_backup.json` al repositorio.

## Home Assistant

`configuration.yaml` tiene `homeassistant.enabled: false`. El hub consume MQTT
directamente.
