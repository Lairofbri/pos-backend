import { getClient } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';

export const consumirReceta = async ({
  tenantId,
  recetaId,
  cantidad,
  motivo,
  usuarioId,
  sucursalId,
}: {
  tenantId: string;
  recetaId: string;
  cantidad: number;
  motivo?: string;
  usuarioId: string;
  sucursalId?: string;
}) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: recetaRows } = await client.query(
      `SELECT r.id, r.producto_id, r.rendimiento, p.nombre AS producto_nombre
       FROM recetas r
       JOIN productos p ON p.id = r.producto_id AND p.tenant_id = $1
       WHERE r.id = $2`,
      [tenantId, recetaId]
    );

    if (recetaRows.length === 0) {
      throw { status: 404, mensaje: 'Receta no encontrada.' };
    }

    const receta = recetaRows[0] as { id: string; producto_id: string; rendimiento: number; producto_nombre: string };

    const { rows: ingredientes } = await client.query(
      `SELECT ri.ingrediente_id, ri.cantidad AS receta_cantidad,
              ri.unidad_medida_id,
              u.factor AS receta_factor,
              r.rendimiento,
              p.stock_actual, p.unidad_medida_id AS prod_um_id,
              pu.factor AS prod_factor
       FROM receta_ingredientes ri
       JOIN recetas r ON r.id = ri.receta_id AND r.producto_id = $1
       JOIN productos p ON p.id = ri.ingrediente_id AND p.tenant_id = $2
       JOIN unidades_medida u ON u.id = ri.unidad_medida_id
       LEFT JOIN unidades_medida pu ON pu.id = p.unidad_medida_id`,
      [receta.producto_id, tenantId]
    );

    if (ingredientes.length === 0) {
      throw { status: 400, mensaje: 'La receta no tiene ingredientes registrados.' };
    }

    for (const ing of ingredientes as Array<{
      ingrediente_id: string;
      receta_cantidad: number;
      unidad_medida_id: string;
      receta_factor: number;
      rendimiento: number;
      stock_actual: number;
      prod_factor: number | null;
    }>) {
      const recetaCantidad = Number(ing.receta_cantidad);
      const recetaFactor = Number(ing.receta_factor);
      const rendimiento = Number(ing.rendimiento) || 1;
      const prodFactor = Number(ing.prod_factor || 1);

      const qtyEnUnidadBase = recetaCantidad * recetaFactor;
      const qtyEnStockUnit = prodFactor > 0 ? qtyEnUnidadBase / prodFactor : qtyEnUnidadBase;
      const qtyAConsumir = (qtyEnStockUnit / rendimiento) * cantidad;

      const stockAnterior = Number(ing.stock_actual);
      const { rows: upd } = await client.query(
        `UPDATE productos SET stock_actual = stock_actual - $1
         WHERE id = $2 AND tenant_id = $3
         RETURNING stock_actual`,
        [qtyAConsumir, ing.ingrediente_id, tenantId]
      );
      const stockPosterior = Number((upd[0] as { stock_actual: number }).stock_actual);

      await client.query(
        `INSERT INTO movimientos_inventario
           (tenant_id, sucursal_id, producto_id, tipo_movimiento, cantidad,
            stock_anterior, stock_posterior, referencia_tipo, motivo, creado_por,
            cantidad_input, unidad_input_id, unidad_medida_id)
         VALUES ($1, $2, $3, 'consumo', $4, $5, $6, 'receta', $7, $8, $4, $9, $10)`,
        [
          tenantId,
          sucursalId || null,
          ing.ingrediente_id,
          qtyAConsumir,
          stockAnterior,
          stockPosterior,
          motivo || `Consumo manual receta: ${receta.producto_nombre}`,
          usuarioId,
          ing.unidad_medida_id,
          ing.unidad_medida_id,
        ]
      );
    }

    await client.query('COMMIT');

    logger.info('Consumo manual de receta registrado', {
      receta_id: recetaId,
      producto: receta.producto_nombre,
      cantidad,
      ingredientes: ingredientes.length,
    });

    return {
      receta_nombre: receta.producto_nombre,
      cantidad_consumida: cantidad,
      ingredientes_afectados: ingredientes.length,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
