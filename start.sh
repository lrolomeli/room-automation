#!/usr/bin/env bash
#
# Arranca el stack completo: Mosquitto + Zigbee2MQTT + API + dashboard.
# Requiere haber creado home-hub/.env a partir de home-hub/.env.example.
#
# Uso:
#   ./start.sh            # stack completo
#   ./start.sh --hub-only # solo API + dashboard (sin dongle / sin MQTT)
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')" || true

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

if [ "$HUB_ONLY" = "0" ]; then
  if [ ! -e /dev/ttyUSB0 ]; then
    echo "Error: no se encontró /dev/ttyUSB0." >&2
    echo "Conecta el dongle Zigbee o ajusta el device en docker-compose.yml." >&2
    echo "Para arrancar solo el dashboard: ./start.sh --hub-only" >&2
    exit 1
  fi

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

  # El contenedor de Mosquitto usa uid 1883; aseguramos que pueda escribir.
  mkdir -p zigbee-stack/mosquitto/data zigbee-stack/mosquitto/log
  chmod 777 zigbee-stack/mosquitto/data zigbee-stack/mosquitto/log 2>/dev/null || true

  echo "Levantando stack completo..."
  $COMPOSE up -d --build
else
  echo "Modo --hub-only: se omite Mosquitto/Zigbee2MQTT. MQTT aparecerá desconectado."
  $COMPOSE up -d --build --no-deps api web
fi

echo
echo "Listo."
echo "  Dashboard local: http://localhost:8084"
if [ -n "$LAN_IP" ]; then
  echo "  Dashboard LAN:   http://$LAN_IP:8084"
fi
if [ "$HUB_ONLY" = "0" ]; then
  echo "  Zigbee2MQTT:  http://localhost:8080${LAN_IP:+  |  http://$LAN_IP:8080}"
fi
echo
echo "Producción: publica el dashboard detrás de tu reverse proxy HTTPS en ra.luisrlp.com."
