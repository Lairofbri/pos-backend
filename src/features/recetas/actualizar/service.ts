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
      `SELECT r.id, r.producto_id, r.version, r.rendimiento, r.instrucciones
       FROM recetas r
       WHERE r.id = $1 AND r.vigente_hasta IS NULL
       FOR UPDATE`,
      [recetaId]
    );

    if (recetaRows.length === 0) {
      throw { status: 404, mensaje: 'Receta no encontrada o ya está obsoleta.' };
    }

    const recetaActual = recetaRows[0] as {
      id: string;
      producto_id: string;
      version: number;
      rendimiento: number;
      instrucciones: string | null;
    };

    const nuevoRendimiento = datos.rendimiento ?? recetaActual.rendimiento;
    const nuevasInstrucciones = datos.instrucciones !== undefined ? datos.instrucciones : recetaActual.instrucciones;

    await client.query(
      'UPDATE recetas SET vigente_hasta = NOW() WHERE id = $1',
      [recetaActual.id]
    );

    const { rows: nuevaRecetaRows } = await client.query(
      `INSERT INTO recetas (tenant_id, producto_id, rendimiento, instrucciones, version, vigente_desde)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, version, rendimiento, instrucciones, vigente_desde, creado_en`,
      [tenantId, recetaActual.producto_id, nuevoRendimiento, nuevasInstrucciones, recetaActual.version + 1]
    );

    const nuevaReceta = nuevaRecetaRows[0];

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

    if (datos.ingredientes) {
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

        const categoriasCompatibles =
          !row.p_categoria ||
          row.u_categoria === row.p_categoria ||
          row.u_categoria === 'cocina' ||
          row.p_categoria === 'cocina';

        if (!categoriasCompatibles) {
          throw {
            status: 400,
            mensaje: `La unidad seleccionada (${row.u_categoria}) no es compatible con la unidad del ingrediente (${row.p_categoria}).`,
          };
        }

        await client.query(
          `INSERT INTO receta_ingredientes (receta_id, ingrediente_id, cantidad, unidad_medida_id, preparacion)
           VALUES ($1, $2, $3, $4, $5)`,
          [nuevaReceta.id, ing.ingrediente_id, ing.cantidad, ing.unidad_medida_id, ing.preparacion || null]
        );
      }
    } else {
      const { rows: ingredientesAnteriores } = await client.query(
        'SELECT ingrediente_id, cantidad, unidad_medida_id, preparacion FROM receta_ingredientes WHERE receta_id = $1',
        [recetaActual.id]
      );

      for (const ing of ingredientesAnteriores as Array<{ ingrediente_id: string; cantidad: number; unidad_medida_id: string; preparacion: string | null }>) {
        await client.query(
          `INSERT INTO receta_ingredientes (receta_id, ingrediente_id, cantidad, unidad_medida_id, preparacion)
           VALUES ($1, $2, $3, $4, $5)`,
          [nuevaReceta.id, ing.ingrediente_id, ing.cantidad, ing.unidad_medida_id, ing.preparacion || null]
        );
      }
    }

    await client.query('COMMIT');

    logger.info('Receta versionada', { receta_anterior_id: recetaActual.id, nueva_version: recetaActual.version + 1, producto_id: recetaActual.producto_id });

    const { rows: ingredientesFinal } = await client.query(
      `SELECT ri.ingrediente_id, ri.cantidad, ri.unidad_medida_id, ri.preparacion,
              p.nombre AS ingrediente_nombre,
              u.nombre AS unidad_nombre, u.abreviatura AS unidad_abrev
       FROM receta_ingredientes ri
       JOIN productos p ON p.id = ri.ingrediente_id
       JOIN unidades_medida u ON u.id = ri.unidad_medida_id
       WHERE ri.receta_id = $1`,
      [nuevaReceta.id]
    );

    return {
      id: nuevaReceta.id,
      producto_id: recetaActual.producto_id,
      version: nuevaReceta.version,
      rendimiento: nuevaReceta.rendimiento,
      instrucciones: nuevaReceta.instrucciones,
      creado_en: nuevaReceta.creado_en,
      ingredientes: ingredientesFinal,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
