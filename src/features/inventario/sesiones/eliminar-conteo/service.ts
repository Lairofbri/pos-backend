import { query } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';

export const eliminarConteo = async ({
  sesionId,
  productoId,
  tenantId,
}: {
  sesionId: string;
  productoId: string;
  tenantId: string;
}) => {
  const { rows: sesiones } = await query(
    `SELECT id FROM inventario_sesiones
     WHERE id = $1 AND tenant_id = $2 AND estado = 'abierta'`,
    [sesionId, tenantId]
  );

  if (sesiones.length === 0) {
    throw { status: 400, mensaje: 'La sesión no existe o no está abierta.' };
  }

  const result = await query(
    `DELETE FROM inventario_conteos
     WHERE sesion_id = $1 AND producto_id = $2`,
    [sesionId, productoId]
  );

  if ((result as { rowCount: number }).rowCount === 0) {
    throw { status: 404, mensaje: 'Conteo no encontrado.' };
  }

  logger.info('Conteo eliminado', { sesion_id: sesionId, producto_id: productoId });
};
