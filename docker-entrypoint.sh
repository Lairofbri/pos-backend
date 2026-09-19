#!/bin/sh
set -e

echo "Ejecutando migraciones..."
node dist/migrations/run.js

if [ "${NODE_ENV:-development}" = "production" ]; then
  echo "Seed demo omitido en producción."
else
  echo "Sembrando datos demo..."
  node dist/migrations/seed.js
fi

echo "Iniciando servidor..."
exec "$@"
