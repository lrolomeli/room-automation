# Room Automation

App para monitorear el cuarto y controlar el aire acondicionado por el emisor IR
del ESP32. **Proyecto independiente** dentro de este repo; está pensado para
extraerse a su propio repositorio (objetivo: `ra.luisrlp.com`).

## Funciones

- **Monitor** — temperatura y humedad en tiempo real, gráficas 24h, stats, heatmap y tendencias.
- **Control** — edición del estado completo del aire y envío por IR. Incluye **temporizador**:
  encender por N minutos y apagarse, o modo **bucle** (N min encendido / 15 min apagado)
  hasta detenerlo.
- **Automatización** — horarios, histeresis de humedad y lazo cerrado adaptativo.

## Estructura

```
backend/   # Express + node-cron + sql.js
  src/
    app.js              # Express; monta /api/auth, /api/sensors, /api/ir, /api/climate, /api/ac-timer
    index.js            # arranque + cron (sensores, climate, temporizador)
    esp.js              # cliente HTTP del ESP32
    services/ac.js      # comando absoluto al ESP (commit solo si responde)
    data/ac-state.js    # estado canónico del aire
    automation/climate.js   # motor de horarios + lazo cerrado
    automation/ac-timer.js  # temporizador una-vez / bucle
    db/sensors.js       # lecturas de sensores (SQLite vía sql.js)
  data/                 # persistencia runtime
frontend/  # Vite + React
  src/
    ClimateApp.jsx      # shell con pestañas Monitor | Control | Automatización
    views/ components/
  Dockerfile, nginx.conf, vite.config.js
```

## Desarrollo

```bash
# Backend
npm install --prefix backend
npm run start --prefix backend        # http://localhost:3000

# Frontend (proxy /api → :3000)
npm install --prefix frontend
npm run dev --prefix frontend         # http://localhost:5173
```

## Variables de entorno (backend)

Copia `backend/.env.example` a `backend/.env` (o define las variables en el
entorno / `docker-compose`):

```
PORT=3000
SESSION_SECRET=change_me_to_a_long_random_string
COOKIE_SECURE=false
ADMIN_USER=admin
ADMIN_PASSWORD=change_me
ESP_HOST=192.168.100.239
ESP_PORT=80
CLIMATE_TZ=America/Mexico_City
```

> En desarrollo hay valores por defecto inseguros (`SESSION_SECRET`,
> `ADMIN_PASSWORD`). Cámbialos siempre en producción.

## Deploy (Docker)

```bash
docker compose up -d --build
```

Sirve la UI en `http://localhost:8080` y proxya `/api` al backend.

## Auth

`/api/sensors` es público; el resto requiere sesión (`/api/auth/login`).
La UI gatea con `RequireAuth`.
