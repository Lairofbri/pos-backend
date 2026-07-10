import { query } from '../../../shared/config/database.js';

export const getMovimientos = async ({ tenantId, cajaId, pagina = 1, limite = 50 }: { tenantId: string; cajaId: string; pagina?: number; limite?: number }) => {
  const { rows: cajaRows } = await query(
    'SELECT id FROM cajas WHERE id = $1 AND tenant_id = $2',
    [cajaId, tenantId]
  );
  if (cajaRows.length === 0) throw { status: 404, mensaje: 'Caja no encontrada.' };

  const offset = (pagina - 1) * limite;

  const { rows } = await query(
    `SELECT
       m.id, m.tipo, m.monto, m.motivo,
       m.metodo_pago, m.orden_id, m.creado_en,
       u.nombre AS usuario_nombre
     FROM movimientos_caja m
     JOIN usuarios u ON u.id = m.usuario_id
     WHERE m.caja_id = $1 AND m.tenant_id = $2
     ORDER BY m.creado_en DESC
     LIMIT $3 OFFSET $4`,
    [cajaId, tenantId, limite, offset]
  );

  const { rows: conteo } = await query(
    'SELECT COUNT(*) as total FROM movimientos_caja WHERE caja_id = $1 AND tenant_id = $2',
    [cajaId, tenantId]
  );

  return {
    movimientos: rows,
    paginacion: {
      total:   parseInt((conteo[0] as { total: string }).total),
      pagina,
      limite,
      paginas: Math.ceil(parseInt((conteo[0] as { total: string }).total) / limite),
    },
  };
};
