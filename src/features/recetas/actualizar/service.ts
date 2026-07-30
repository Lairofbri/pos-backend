import { getClient } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';

export const actualizarReceta = async ({
  tenantId,
  recetaId,
  datos,
}: {
  tenantId: string;
  recetaId: string;
  datos: {
    producto?: { nombre?: string; precio?: number; categoria_id?: string; imagen_url?: string };
    rendimiento?: number;
    instrucciones?: string;
    ingredientes?: Array<{ ingrediente_id: string; cantidad: number; unidad_medida_id: string; preparacion?: string }>;
  };
}) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: recetaRows } = await client.query(
      `SELECT r.id, r.producto_id, r.rendimiento, r.instrucciones, p.nombre AS producto_nombre
       FROM recetas r
       JOIN productos p ON p.id = r.producto_id AND p.tenant_id = $1
       WHERE r.id = $2`,
      [tenantId, recetaId]
    );

    if (recetaRows.length === 0) {
      throw { status: 404, mensaje: 'Receta no encontrada.' };
    }

    const recetaActual = recetaRows[0] as { producto_id: string; rendimiento: number; instrucciones: string | null };

    if (datos.producto) {
      const updates: string[] = [];
      const valores: unknown[] = [];
      let idx = 1;

      if (datos.producto.nombre !== undefined) {
        updates.push(`nombre = $${idx++}`);
        valores.push(datos.producto.nombre);
      }
      if (datos.producto.precio !== undefined) {
        updates.push(`precio = $${idx++}`);
        valores.push(datos.producto.precio);
      }
      if (datos.producto.categoria_id !== undefined) {
        updates.push(`categoria_id = $${idx++}`);
        valores.push(datos.producto.categoria_id || null);
      }
      if (datos.producto.imagen_url !== undefined) {
        updates.push(`imagen_url = $${idx++}`);
        valores.push(datos.producto.imagen_url || null);
      }

      if (updates.length > 0) {
        valores.push(recetaActual.producto_id, tenantId);
        await client.query(
          `UPDATE productos SET ${updates.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx}`,
          valores
        );
      }
    }

    if (datos.rendimiento !== undefined) {
      await client.query(
        'UPDATE recetas SET rendimiento = $1 WHERE id = $2',
        [datos.rendimiento, recetaId]
      );
    }

    if (datos.instrucciones !== undefined) {
      await client.query(
        'UPDATE recetas SET instrucciones = $1 WHERE id = $2',
        [datos.instrucciones || null, recetaId]
      );
    }

    if (datos.ingredientes) {
      await client.query('DELETE FROM receta_ingredientes WHERE receta_id = $1', [recetaId]);

      for (const ing of datos.ingredientes) {
        const { rows: unidadRows } = await client.query(
          `SELECT u.categoria AS u_categoria,
                  p.unidad_medida_id AS p_um_id,
                  (SELECT u2.categoria FROM unidades_medida u2 WHERE u2.id = p.unidad_medida_id) AS p_categoria
           FROM unidades_medida u
           JOIN productos p ON p.id = $1 AND p.tenant_id = $2
           WHERE u.id = $3`,
          [ing.ingrediente_id, tenantId, ing.unidad_medida_id]
        );

        if (unidadRows.length === 0) {
          throw { status: 400, mensaje: 'Unidad de medida no válida.' };
        }

        const row = unidadRows[0] as { u_categoria: string; p_categoria: string | null };

        if (row.p_categoria && row.u_categoria !== row.p_categoria) {
          throw {
            status: 400,
            mensaje: `La unidad seleccionada (${row.u_categoria}) no es compatible con la unidad del ingrediente (${row.p_categoria}).`,
          };
        }

        await client.query(
          `INSERT INTO receta_ingredientes (receta_id, ingrediente_id, cantidad, unidad_medida_id, preparacion)
           VALUES ($1, $2, $3, $4, $5)`,
          [recetaId, ing.ingrediente_id, ing.cantidad, ing.unidad_medida_id, ing.preparacion || null]
        );
      }
    }

    await client.query('COMMIT');

    logger.info('Receta actualizada', { receta_id: recetaId });

    const { rows: recetaFinal } = await client.query(
      `SELECT r.id, r.producto_id, r.rendimiento, r.instrucciones, r.creado_en,
              p.nombre AS producto_nombre, p.precio, p.imagen_url
       FROM recetas r
       JOIN productos p ON p.id = r.producto_id
       WHERE r.id = $1`,
      [recetaId]
    );

    const { rows: ingredientesFinal } = await client.query(
      `SELECT ri.ingrediente_id, ri.cantidad, ri.unidad_medida_id, ri.preparacion,
              p.nombre AS ingrediente_nombre,
              u.nombre AS unidad_nombre, u.abreviatura AS unidad_abrev
       FROM receta_ingredientes ri
       JOIN productos p ON p.id = ri.ingrediente_id
       JOIN unidades_medida u ON u.id = ri.unidad_medida_id
       WHERE ri.receta_id = $1`,
      [recetaId]
    );

    return { ...recetaFinal[0], ingredientes: ingredientesFinal };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
