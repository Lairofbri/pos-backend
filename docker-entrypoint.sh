#!/bin/sh
set -e

echo "▶️ Ejecutando migraciones iniciales..."
node dist/migrations/run.js 2>&1 || true

echo "▶️ Sembrando datos faltantes para migraciones..."
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  try {
    // Las migraciones 002+ usan UUIDs con 0000 en vez de 4000 (bug en migrations)
    // Pre-seed para que FK constraints no fallen
    // NOTA: migraciones 002+ usan tenant_id con 0000 en vez de 4000 (bug).
    // Insertamos el tenant con el UUID incorrecto para que FK no falle.
    await pool.query(\`
      INSERT INTO tenants (id, nombre, nit, plan) VALUES
        ('a0000000-0000-4000-8000-000000000001', 'Restaurante Demo', '0000-000000-000-0', 'pro'),
        ('a0000000-0000-0000-0000-000000000001', 'Restaurante Demo', '0000-000000-000-1', 'pro')
      ON CONFLICT (id) DO NOTHING
    \`);
    await pool.query(\`
      INSERT INTO sucursales (id, tenant_id, nombre, es_principal) VALUES
        ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Sucursal Principal', TRUE),
        ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Sucursal Principal', TRUE)
      ON CONFLICT (id) DO NOTHING
    \`);
    console.log('  ✓ Datos base sembrados correctamente');
  } catch (err) {
    console.log('  - No se pudo sembrar:', err.message);
  }
  await pool.end();
})();
" 2>&1

echo "▶️ Re-ejecutando migraciones pendientes..."
node dist/migrations/run.js 2>&1 || true

echo "▶️ Sembrando datos demo..."
node dist/migrations/seed.js 2>/dev/null || echo "  ℹ️ Seed saltado (ya ejecutado o no disponible)"

echo "🚀 Iniciando servidor..."
exec "$@"
