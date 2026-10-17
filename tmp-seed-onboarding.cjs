// TEMPORAL — siembra el onboarding del POS (permisos y catálogos) para los
// tenants de staging, replicando lo que ahora hace la proyección TENANT_CREADO.
// Idempotente: las funciones usan ON CONFLICT.
//
// NOTA (migración 080, 2026-10-16): los MENÚS del sidebar son un catálogo
// GLOBAL (tabla `menus` sin `tenant_id`) — ya no se siembran por tenant, así que
// este script no llama a `sp_sembrar_menus_tenant` (la función ya no existe).
const { Client } = require('pg');

const TENANTS = [
  { id: 'a0678aa2-ce7a-44c4-856f-933313366fbf', etiqueta: 'COPY SERVITEC' },
  { id: 'a0000000-0000-4000-8000-000000000001', etiqueta: 'Restaurante Demo' },
];

const contar = async (c, tenantId) => {
  const r = await c.query('SELECT COUNT(*)::int AS n FROM rol_permisos WHERE tenant_id = $1', [tenantId]);
  const ra = await c.query(
    "SELECT COUNT(*)::int AS n FROM rol_permisos WHERE tenant_id = $1 AND rol = 'administrador' AND activo",
    [tenantId]
  );
  const cat = await c.query('SELECT COUNT(*)::int AS n FROM catalogos WHERE tenant_id = $1', [tenantId]);
  return { rol_permisos: r.rows[0].n, admin_activos: ra.rows[0].n, catalogos: cat.rows[0].n };
};

(async () => {
  const c = new Client({ connectionString: process.env.PGURL, ssl: false });
  await c.connect();

  for (const t of TENANTS) {
    console.log(`${t.etiqueta} ANTES:`, JSON.stringify(await contar(c, t.id)));

    await c.query('CALL sp_sembrar_permisos_tenant($1)', [t.id]);
    await c.query('CALL sp_sembrar_catalogos_tenant($1)', [t.id]);

    console.log(`${t.etiqueta} DESPUES:`, JSON.stringify(await contar(c, t.id)));
  }

  await c.end();
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exitCode = 1;
});
