#!/usr/bin/env bash
#
# Arranca el stack Zigbee y el hub visual.
# Requiere haber creado home-hub/.env a partir de home-hub/.env.example.
#
# Uso:
#   ./start.sh            # Zigbee + hub
#   ./start.sh --hub-only # solo el hub (sin dongle / sin MQTT)
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

HUB_ONLY=0
if [ "${1:-}" = "--hub-only" ]; then
  HUB_ONLY=1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "Error: docker compose no está disponible." >&2
  exit 1
fi

if [ ! -f home-hub/.env ]; then
  echo "Error: falta home-hub/.env." >&2
  echo "Copia home-hub/.env.example a home-hub/.env y edita DASHBOARD_PASSWORD, SESSION_SECRET y ESP_HOST." >&2
  exit 1
fi

if [ "$HUB_ONLY" = "0" ] && [ ! -e /dev/ttyUSB0 ]; then
  echo "Error: no se encontró /dev/ttyUSB0." >&2
  echo "Conecta el dongle Zigbee o ajusta el device en zigbee-stack/docker-compose.yml." >&2
  echo "Para arrancar solo el hub: ./start.sh --hub-only" >&2
  exit 1
fi

if [ "$HUB_ONLY" = "0" ]; then
  if [ ! -f zigbee-stack/zigbee2mqtt/configuration.yaml ]; then
    echo "Error: falta zigbee-stack/zigbee2mqtt/configuration.yaml." >&2
    echo "Copia configuration.example.yaml y ajusta tu red." >&2
    exit 1
  fi
  if [ ! -f zigbee-stack/zigbee2mqtt/secrets.yaml ]; then
    echo "Error: falta zigbee-stack/zigbee2mqtt/secrets.yaml." >&2
    echo "Copia secrets.yaml.example y pega tu network key." >&2
    exit 1
  fi
fi

if ! docker network inspect zigbee-net >/dev/null 2>&1; then
  echo "Creando red zigbee-net..."
  docker network create zigbee-net >/dev/null
fi

if [ "$HUB_ONLY" = "0" ]; then
  # El contenedor de Mosquitto usa uid 1883; aseguramos que pueda escribir.
  mkdir -p zigbee-stack/mosquitto/data zigbee-stack/mosquitto/log
  chmod 777 zigbee-stack/mosquitto/data zigbee-stack/mosquitto/log 2>/dev/null || true
  echo "Levantando zigbee-stack..."
  (cd zigbee-stack && $COMPOSE up -d)
else
  echo "Modo --hub-only: se omite zigbee-stack. MQTT aparecerá desconectado."
fi

echo "Levantando home-hub..."
(cd home-hub && $COMPOSE up -d --build)

echo
echo "Listo."
echo "  Hub:          http://localhost:8084"
if [ "$HUB_ONLY" = "0" ]; then
  echo "  Zigbee2MQTT:  http://127.0.0.1:8080 (LAN / VPN / SSH tunnel)"
fi
echo
echo "Producción: publica el hub detrás de tu reverse proxy HTTPS en ra.luisrlp.com."
