#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js y npm son necesarios para ejecutar la interfaz de desarrollo." >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Instalando dependencias de desarrollo..."
  npm ci
fi

# Primer argumento opcional: origen del harvester, por ejemplo http://localhost:8090.
export VITE_HARVESTER_ORIGIN="${1:-${VITE_HARVESTER_ORIGIN:-http://localhost:8090}}"
export VITE_HOST="${VITE_HOST:-127.0.0.1}"

echo "Interfaz: http://${VITE_HOST}:5173"
echo "Harvester: ${VITE_HARVESTER_ORIGIN}"
exec npm run dev -- --host "$VITE_HOST"
