import { query, getClient } from '../../../../shared/config/database.js';
import { fijarStock } from '../../stock-service.js';
import { logger } from '../../../../shared/utils/logger.js';

export const cerrarSesion = async ({
  sesionId,
  tenantId,
  usuarioId,
  sucursalId,
  lineas,
}: {
  sesionId: string;
  tenantId: string;
  usuarioId: string;
  sucursalId: string | null;
  lineas: { producto_id: string; aplicar: boolean }[];
}) => {
  const { rows: sesiones } = await query(
    `SELECT id, stock_snapshot FROM inventario_sesiones
     WHERE id = $1 AND tenant_id = $2 AND estado = 'abierta'`,
    [sesionId, tenantId]
  );

  if (sesiones.length === 0) {
    throw { status: 400, mensaje: 'La sesión no existe, no está abierta o ya fue cerrada.' };
  }

  const sesion = sesiones[0];
  const snapshot = (sesion.stock_snapshot as Record<string, number>) || {};

  const aplicarIds = lineas.filter(l => l.aplicar).map(l => l.producto_id);
  const ignorarIds = lineas.filter(l => !l.aplicar).map(l => l.producto_id);

  const client = await getClient();
  let ajustesAplicados = 0;

  try {
    await client.query('BEGIN');

    for (const productoId of aplicarIds) {
      const { rows: conteos } = await client.query(
        `SELECT stock_fisico FROM inventario_conteos
         WHERE sesion_id = $1 AND producto_id = $2`,
        [sesionId, productoId]
      );

      if (conteos.length > 0) {
        const stockFisico = Number((conteos[0] as { stock_fisico: string }).stock_fisico);

        await fijarStock({
          tenantId,
          productoId,
          nuevoStock: stockFisico,
          sucursalId,
          usuarioId,
          motivo: 'Cierre de sesión de inventario físico',
          tipoMovimiento: 'conteo',
          sesionId,
          client,
        });

        ajustesAplicados++;
      }
    }

    if (aplicarIds.length > 0) {
      await client.query(
        `UPDATE inventario_conteos SET aplicado = TRUE
         WHERE sesion_id = $1 AND producto_id = ANY($2::uuid[])`,
        [sesionId, aplicarIds]
      );
    }

    if (ignorarIds.length > 0) {
      await client.query(
        `UPDATE inventario_conteos SET ignorado = TRUE
         WHERE sesion_id = $1 AND producto_id = ANY($2::uuid[])`,
        [sesionId, ignorarIds]
      );
    }

    await client.query(
      `UPDATE inventario_sesiones
       SET estado = 'cerrada', cerrado_por = $2, cerrado_en = NOW()
       WHERE id = $1`,
      [sesionId, usuarioId]
    );

    await client.query('COMMIT');

    logger.info('Sesión de inventario cerrada', {
      sesion_id: sesionId,
      ajustes_aplicados: ajustesAplicados,
      ignorados: ignorarIds.length,
    });

    return {
      ajustes_aplicados: ajustesAplicados,
      ignorados: ignorarIds.length,
      total_lineas: lineas.length,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
