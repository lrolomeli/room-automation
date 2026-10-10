#!/usr/bin/env bash
#
# Deploy de Room Automation: git pull + rebuild de contenedores.
#
# Uso:
#   ./deploy.sh
#   DEPLOY_BRANCH=main ./deploy.sh
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

BRANCH="${DEPLOY_BRANCH:-main}"

log() { printf '\n==> %s\n' "$*"; }
fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }

log "Room Automation — deploy (rama $BRANCH)"

[ -d .git ] || fail "$ROOT_DIR no es un repositorio git."

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  fail "docker compose no está disponible."
fi

if [ ! -f backend/.env ]; then
  printf 'Aviso: no existe backend/.env; el backend usará credenciales por defecto inseguras.\n' >&2
fi

log "git pull origin $BRANCH"
git pull --ff-only origin "$BRANCH"

log "Build de imágenes"
$COMPOSE build

log "Levantando contenedores"
$COMPOSE up -d --remove-orphans --force-recreate

log "Estado"
$COMPOSE ps

log "Deploy completo."
