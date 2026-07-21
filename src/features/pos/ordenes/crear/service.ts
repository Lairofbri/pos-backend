import { getClient } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { obtenerMesaShared } from '../../shared.js';

export const crearOrden = async ({ tenantId, usuarioId, datos, sucursalId }: { tenantId: string; usuarioId: string; datos: Record<string, unknown>; sucursalId?: string }) => {
  const { tipo, mesa_id, cliente_id, notas, porcentaje_descuento = 0, propina_porcentaje = 10 } = datos as {
    tipo: string;
    mesa_id?: string;
    cliente_id?: string;
    notas?: string;
    porcentaje_descuento?: number;
    propina_porcentaje?: number;
    origen?: string;
    numero_externo?: string;
  };

  if (tipo === 'mesa' && mesa_id) {
    const mesa = await obtenerMesaShared({ tenantId, mesaId: mesa_id });
    const m = mesa as { estado: string; activo: boolean; numero: string };
    if (m.estado === 'ocupada') {
      throw { status: 409, mensaje: `La mesa ${m.numero} ya está ocupada.` };
    }
    if (!m.activo) {
      throw { status: 400, mensaje: `La mesa ${m.numero} está inactiva.` };
    }
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO ordenes
         (tenant_id, sucursal_id, tipo, mesa_id, cliente_id, usuario_id, notas, porcentaje_descuento, propina_porcentaje, origen, numero_externo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING
         id, tipo, estado, numero_orden, origen, numero_externo,
         subtotal, descuento, total, gravado, iva,
         propina_porcentaje, propina_monto,
         mesa_id, cliente_id, usuario_id, notas,
         porcentaje_descuento, creado_en`,
      [
        tenantId,
        sucursalId || null,
        tipo, mesa_id || null, cliente_id || null, usuarioId,
        notas || null, porcentaje_descuento, propina_porcentaje,
        (datos as Record<string, unknown>).origen || 'pos',
        (datos as Record<string, unknown>).numero_externo || null,
      ]
    );

    if (tipo === 'mesa' && mesa_id) {
      await client.query(
        'UPDATE mesas SET estado = $1 WHERE id = $2 AND tenant_id = $3',
        ['ocupada', mesa_id, tenantId]
      );
    }

    await client.query('COMMIT');

    logger.info('Orden creada', {
      orden_id: (rows[0] as Record<string, unknown>).id as string,
      tipo,
      tenant_id: tenantId,
      usuario_id: usuarioId,
    });

    return { ...(rows[0] as Record<string, unknown>), items: [] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
