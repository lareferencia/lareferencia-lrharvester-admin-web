#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
harvester_dir="${HARVESTER_APP_DIR:-${script_dir}/../lareferencia-lrharvester-app}"
static_dir="${harvester_dir}/static"

if [[ ! -f "${harvester_dir}/pom.xml" ]]; then
  echo "No se encontró la aplicación harvester en: ${harvester_dir}" >&2
  echo "Define HARVESTER_APP_DIR si los repositorios no son hermanos." >&2
  exit 1
fi

if ! command -v mvn >/dev/null 2>&1; then
  echo "Maven es necesario para compilar la interfaz." >&2
  exit 1
fi

cd "$script_dir"
mvn package -Dharvester.static.dir="$static_dir"

echo "Interfaz compilada y copiada a: ${static_dir}"
