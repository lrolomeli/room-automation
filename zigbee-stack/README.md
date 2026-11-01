# Zigbee stack

Mosquitto + Zigbee2MQTT, definidos en el `docker-compose.yml` raíz.

El broker se llama `mqtt` dentro de la red por defecto del compose. El hub y
Zigbee2MQTT lo resuelven como `mqtt:1883`; no hay red externa.

## Arranque

Desde la raíz del repo:

```bash
mkdir -p zigbee-stack/mosquitto/data zigbee-stack/mosquitto/log
chmod 777 zigbee-stack/mosquitto/data zigbee-stack/mosquitto/log
docker compose up -d mqtt zigbee2mqtt
```

O el stack completo:

```bash
./start.sh
```

- **Mosquitto:** sin puerto público. Solo accesible por la red del compose.
- **Zigbee2MQTT:** `http://127.0.0.1:8080` para administración/pairing.
  No lo expongas a Internet; usa LAN, VPN o túnel SSH.
- El dongle se monta como `/dev/ttyUSB0`.

## Configuración

El `configuration.yaml` está versionado, pero **sin la network key**: solo
referencia `!secret network_key`. Contiene la topología y los nombres de tus
dispositivos.

Si empiezas una red Zigbee nueva, puedes reemplazarlo por el ejemplo:

```bash
cp zigbee2mqtt/configuration.example.yaml zigbee2mqtt/configuration.yaml
```

La network key real vive en `zigbee2mqtt/secrets.yaml`, que está ignorado.

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
