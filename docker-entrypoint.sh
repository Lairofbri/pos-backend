#!/bin/sh
set -e

echo "Ejecutando migraciones..."
node dist/migrations/run.js

echo "Sembrando datos demo..."
node dist/migrations/seed.js

echo "Iniciando servidor..."
exec "$@"
