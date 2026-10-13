// scripts/verificar-migraciones.cjs
// Verifica que TODAS las migraciones locales hayan sido ejecutadas en la BD.
// Compara migrations/*.sql contra la tabla _migraciones (por nombre y hash SHA-256).
//
// Uso:
//   node scripts/verificar-migraciones.cjs              # contra la BD del .env local
//   railway run -- node scripts/verificar-migraciones.cjs   # contra la BD de Railway
//
// Exit code: 0 si está todo al día, 1 si hay pendientes/modificadas/extrañas.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');
const EXCLUIDOS = ['999_limpiar_datos_pos.sql', 'clean-demo.sql'];

const host = process.env.DATABASE_URL || '';
const usarSsl = process.env.NODE_ENV === 'production' || host.includes('railway');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: usarSsl ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : false,
});

const hashFile = (ruta) =>
  crypto.createHash('sha256').update(fs.readFileSync(ruta, 'utf8')).digest('hex');

const local = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql') && !f.startsWith('999_') && !EXCLUIDOS.includes(f))
  .sort()
  .map((archivo) => ({
    archivo,
    hash: hashFile(path.join(MIGRATIONS_DIR, archivo)),
  }));

const main = async () => {
  let client;
  try {
    client = await pool.connect();
    await client.query('CREATE TABLE IF NOT EXISTS _migraciones (id SERIAL PRIMARY KEY, archivo VARCHAR(255) UNIQUE NOT NULL, hash VARCHAR(64), ejecutado_en TIMESTAMPTZ DEFAULT NOW())');
    await client.query('ALTER TABLE _migraciones ADD COLUMN IF NOT EXISTS hash VARCHAR(64)');

    const { rows } = await client.query(
      'SELECT archivo, hash, ejecutado_en FROM _migraciones ORDER BY id'
    );
    const bd = new Map(rows.map((r) => [r.archivo, r]));

    const pendientes = local.filter((m) => !bd.has(m.archivo));
    const modificadas = local.filter((m) => bd.has(m.archivo) && bd.get(m.archivo).hash && bd.get(m.archivo).hash !== m.hash);
    const extras = [...bd.keys()].filter((a) => !local.some((m) => m.archivo === a));

    const total = local.length;
    const ejecutadas = total - pendientes.length;

    console.log(`=== Verificación de migraciones (${new Date().toISOString()}) ===`);
    console.log(`Local:     ${total} archivos SQL`);
    console.log(`Ejecutada: ${ejecutadas} en _migraciones`);
    console.log(`Pendientes: ${pendientes.length} | Modificadas: ${modificadas.length} | En BD sin archivo local: ${extras.length}`);
    console.log('');

    if (pendientes.length) {
      console.log('❌ MIGRACIONES PENDIENTES (existen localmente, NO en la BD):');
      for (const m of pendientes) console.log(`   - ${m.archivo}`);
    }
    if (modificadas.length) {
      console.log('⚠️  MIGRACIONES MODIFICADAS (hash difiere; el runner no las reejecuta):');
      for (const m of modificadas) console.log(`   - ${m.archivo}`);
    }
    if (extras.length) {
      console.log('ℹ️  En _migraciones pero SIN archivo local:');
      for (const a of extras) console.log(`   - ${a}`);
    }

    const ultimas = rows.slice(-10).reverse();
    console.log('');
    console.log('Últimas 10 ejecutadas (BD):');
    for (const r of ultimas) {
      console.log(`   ${r.ejecutado_en ? new Date(r.ejecutado_en).toISOString() : 'sin fecha'}  ${r.archivo}`);
    }

    console.log('');
    console.log(pendientes.length === 0 && modificadas.length === 0 ? '✅ Todo al día.' : '❌ Hay migraciones sin ejecutar o modificadas.');
    process.exitCode = pendientes.length === 0 && modificadas.length === 0 ? 0 : 1;
  } catch (err) {
    console.error('❌ Error al conectar/consultar la BD:', err.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
};

main();