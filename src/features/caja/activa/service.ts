import { query } from '../../../shared/config/database.js';
import { obtenerCajaAbierta } from '../shared.js';

export const getCajaActiva = async ({ tenantId, sucursalId = null }: { tenantId: string; sucursalId?: string | null }) => {
  const caja = await obtenerCajaAbierta({ tenantId, sucursalId });

  if (!caja) {
    throw { status: 404, mensaje: 'No hay ninguna caja abierta en este momento.' };
  }

  const { rows: movimientos } = await query(
    `SELECT
       m.id, m.tipo, m.monto, m.motivo,
       m.metodo_pago, m.orden_id, m.creado_en,
       u.nombre AS usuario_nombre
     FROM movimientos_caja m
     JOIN usuarios u ON u.id = m.usuario_id
     WHERE m.caja_id = $1 AND m.tenant_id = $2
     ORDER BY m.creado_en DESC
     LIMIT 10`,
    [caja.id, caja.tenant_id]
  );

  return { ...caja, movimientos_recientes: movimientos };
};
