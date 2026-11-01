# Casa LuisRLP — Home Hub

Este repositorio nació como **room-automation** (clima del cuarto con ESP32).
Ahora contiene el **hub unificado** para controlar los relés Zigbee y el clima
de la habitación desde una sola PWA. La app anterior queda en el historial de
git; ya no se despliega.

## Arquitectura

```
Navegador / PWA
  │ HTTPS + WebSocket
  ▼
home-hub (un contenedor: frontend + backend)
  ├── MQTT ──► Mosquitto ──► Zigbee2MQTT ──► Relés / sensores Zigbee
  └── HTTP ──► ESP32 (temperatura/humedad + IR del aire)
```

- **`zigbee-stack/`**: configuración de Mosquitto + Zigbee2MQTT.
- **`home-hub/`**: un único contenedor con Express, React/PWA, MQTT,
  WebSocket, auth y el cliente del ESP32.
- **`docker-compose.yml`**: compose raíz con los tres servicios.
- **`start.sh` / `stop.sh`**: arrancan/paran el stack completo.

## Estructura

```
.
├── docker-compose.yml        # mqtt + zigbee2mqtt + hub
├── zigbee-stack/
│   ├── mosquitto/
│   └── zigbee2mqtt/
├── home-hub/
│   ├── server/               # Express, MQTT, WS, auth, integración ESP32
│   ├── web/                  # React + Vite + Tailwind
│   ├── config/
│   │   ├── automations.example.yaml
│   │   └── automations.yaml  # real, ignorado por git
│   ├── data/                 # persistencia, ignorada por git
│   ├── Dockerfile
│   └── .env.example
├── start.sh
└── stop.sh
```

## Arranque desde cero

1. Copia los ejemplos que faltan:

   ```bash
   cp home-hub/.env.example home-hub/.env
   cp home-hub/config/automations.example.yaml home-hub/config/automations.yaml
   cp zigbee-stack/zigbee2mqtt/secrets.yaml.example \
      zigbee-stack/zigbee2mqtt/secrets.yaml
   ```

   `zigbee-stack/zigbee2mqtt/configuration.yaml` ya está versionado **sin la
   network key**. Si vas a crear una red Zigbee nueva, puedes reemplazarlo por
   `configuration.example.yaml`.

2. Edita:
   - `home-hub/.env`: `DASHBOARD_PASSWORD`, `SESSION_SECRET`, `ESP_HOST`,
     `CLIMATE_TZ`.
   - `zigbee-stack/zigbee2mqtt/secrets.yaml`: tu `network_key` de 16 bytes.
   - `home-hub/config/automations.yaml`: tus dispositivos y reglas.
   - `zigbee-stack/zigbee2mqtt/configuration.yaml` si cambian tus dispositivos.

3. Verifica el dongle Zigbee en `/dev/ttyUSB0`.

4. Arranca:

   ```bash
   ./start.sh
   ```

   Si no tienes el dongle y solo quieres probar la interfaz:

   ```bash
   ./start.sh --hub-only
   ```

5. Abre:
   - Hub: `http://localhost:8084`
   - Zigbee2MQTT: `http://<IP_DEL_SERVIDOR>:8080` (LAN, sin login)

Para parar:

```bash
./stop.sh
```

## Un solo compose

El `docker-compose.yml` raíz levanta los tres servicios en la red por defecto
del proyecto. No hay que crear redes externas.

- `mqtt` es el nombre de servicio del broker; el hub y Z2M usan
  `mqtt://mqtt:1883`.
- Mosquitto **no publica 1883** al host.
- Zigbee2MQTT publica 8080 en la LAN. No lo expongas a Internet: su UI no tiene
  login por defecto.
- El hub habla directamente con el ESP32 (`ESP_HOST`), sin backend intermedio.

Operaciones individuales:

```bash
docker compose up -d --build hub     # reconstruir solo el hub
docker compose restart hub           # reiniciar solo el hub
docker compose logs -f               # logs de todos
docker compose logs -f zigbee2mqtt   # logs de Z2M
```

## Configuración sensible

Estos archivos son locales y están ignorados por git:

- `home-hub/.env`
- `home-hub/config/automations.yaml`
- `home-hub/data/`
- `zigbee-stack/zigbee2mqtt/secrets.yaml` (la network key)
- `zigbee-stack/zigbee2mqtt/database.db`
- `zigbee-stack/zigbee2mqtt/state.json`
- `zigbee-stack/zigbee2mqtt/coordinator_backup.json`
- `zigbee-stack/mosquitto/data/` y `zigbee-stack/mosquitto/log/`

`zigbee-stack/zigbee2mqtt/configuration.yaml` **sí se versiona**, pero sin la
network key: solo referencia `!secret network_key`. Contiene los nombres e IEEE
addresses de tus dispositivos; la clave real nunca se sube.

## Automatizaciones Zigbee

Las reglas reales viven en `home-hub/config/automations.yaml` (ignorado).
El ejemplo versionado es `automations.example.yaml`:

```yaml
mode: shadow
rules:
  - id: relay-1-on
    when: { device: motion-1, property: occupancy, equals: true }
    then: { device: relay-1, state: "ON" }

  # Pulsador: una pulsación simple apaga un relé.
  - id: button-1-off
    when: { device: button-1, property: action, equals: single }
    then: { device: relay-1, state: "OFF" }
    cooldownMs: 500
```

- Las reglas con `property: action` disparan en **cada pulsación**, aunque la
  acción se repita (`single` varias veces).
- `AUTOMATION_MODE=shadow`: solo registra lo que haría.
- `AUTOMATION_MODE=live`: envía el comando al relé.

Para el corte desde Home Assistant, arranca en `shadow`, compara los logs y
luego cambia a `live`.

## Habitación / ESP32

- El hub sondea `GET /api/sensors` y envía comandos IR con `GET /api/ac/set`.
- Las rutinas de clima, el temporizador y el historial viven en
  `home-hub/server/integrations/room/`.
- El historial está en `home-hub/data/room/sensors.db`.
- **El estado del aire es el último comando enviado**, no una confirmación
  física: el IR es unidireccional.
- El temporizador sigue en memoria; si el contenedor reinicia, se pierde.

### Migrar datos de la versión anterior

Con el servicio antiguo parado:

```bash
# Si conservas un backup de la versión antigua:
mkdir -p home-hub/data/room
cp -a /ruta/a/tu/backup/backend/data/. home-hub/data/room/
```

Si ya tienes el hub funcionando, tus datos actuales están en
`home-hub/data/room/` y no hace falta tocar nada.

No ejecutes a la vez la versión antigua y el hub contra el ESP32.

## API

```http
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me

GET  /api/state
GET  /api/zigbee/devices
POST /api/zigbee/devices/:ieee/command   { "state": "ON" | "OFF" }

GET  /api/room/status
GET  /api/room/sensors/latest
POST /api/room/ac
POST /api/room/timer/start
POST /api/room/timer/stop
POST /api/room/climate/enabled
POST /api/room/climate/run-now
GET  /api/room/history?range=24h
GET  /api/room/stats?date=...
GET  /api/room/heatmap?month=...
GET  /api/room/trends?days=30

GET  /api/automations
POST /api/automations/reload
POST /api/automations/mode                 { "mode": "shadow" | "live" }
GET  /api/health
WS   /ws
```

## Desarrollo del hub

```bash
cd home-hub
npm install
npm run dev        # backend :3000 + Vite :5173
npm run build      # frontend a dist/web
npm start          # backend + frontend compilado
npm test           # tests unitarios + integración con MQTT/ESP32 simulados
npx tsc --noEmit   # typecheck
```

## Reverse proxy

El hub sirve la PWA, la API y el WebSocket en `8084` (LAN y loopback). El
reverse proxy de `ra.luisrlp.com` debe reenviar **también `/ws`** con upgrade:

```nginx
location / {
    proxy_pass http://127.0.0.1:8084;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

Con ese proxy, en `home-hub/.env` usa `COOKIE_SECURE=true` y `TRUST_PROXY=1`.
Si el proxy reescribe el `Host`, define `ALLOWED_ORIGIN=https://ra.luisrlp.com`.

## Seguridad

- Solo el hub debe estar expuesto a Internet, detrás de HTTPS y login.
- El hub (`8084`) tiene login; puedes abrirlo en la LAN. Para Internet, usa
  Cloudflare Tunnel o un reverse proxy con HTTPS.
- La UI de Zigbee2MQTT (`8080`) **no tiene login por defecto**. Queda publicada
  en la LAN para administración/pairing; no la expongas a Internet.
- No publiques MQTT (`1883`) al exterior.
- Usa una contraseña única y larga; si puedes, añade TOTP o Authelia en el
  reverse proxy.
- `DASHBOARD_PASSWORD` y `SESSION_SECRET` son obligatorios.
- La cookie es `HttpOnly` y `SameSite=Strict`. Activa `COOKIE_SECURE=true`
  con HTTPS.

## Legacy

- La app anterior de room-automation (`backend/`, `frontend/`) quedó en el
  historial de git. Este repo ya no la despliega.
- El repo `homeassistant` es legado; el proyecto activo es este.
- `zigbee-stack/zigbee2mqtt/configuration.yaml` tiene
  `homeassistant.enabled: false`.
