import { query } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';

export const cancelarSesion = async ({
  sesionId,
  tenantId,
}: {
  sesionId: string;
  tenantId: string;
}) => {
  const { rows: sesiones } = await query(
    `SELECT id FROM inventario_sesiones
     WHERE id = $1 AND tenant_id = $2 AND estado = 'abierta'`,
    [sesionId, tenantId]
  );

  if (sesiones.length === 0) {
    throw { status: 400, mensaje: 'La sesión no existe, no está abierta o ya fue cerrada.' };
  }

  await query(
    `UPDATE inventario_sesiones SET estado = 'cancelada' WHERE id = $1`,
    [sesionId]
  );

  logger.info('Sesión de inventario cancelada', { sesion_id: sesionId });
};
