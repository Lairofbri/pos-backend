import { getClient } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';

export const crearReceta = async ({
  tenantId,
  datos,
}: {
  tenantId: string;
  datos: {
    producto: { nombre: string; precio: number; categoria_id?: string; imagen_url?: string };
    rendimiento: number;
    instrucciones?: string;
    ingredientes: Array<{ ingrediente_id: string; cantidad: number; unidad_medida_id: string; preparacion?: string }>;
  };
}) => {
  const { producto, rendimiento, instrucciones, ingredientes } = datos;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: prodRows } = await client.query(
      `INSERT INTO productos
         (tenant_id, nombre, precio, categoria_id, imagen_url, tiene_stock, tiene_receta, se_vende, activo)
       VALUES ($1, $2, $3, $4, $5, FALSE, TRUE, TRUE, TRUE)
       RETURNING id, nombre, precio, imagen_url, categoria_id, creado_en`,
      [
        tenantId,
        producto.nombre,
        producto.precio,
        producto.categoria_id || null,
        producto.imagen_url || null,
      ]
    );

    const nuevoProducto = prodRows[0];

    const { rows: recetaRows } = await client.query(
      `INSERT INTO recetas (tenant_id, producto_id, rendimiento, instrucciones)
       VALUES ($1, $2, $3, $4)
       RETURNING id, rendimiento, instrucciones, creado_en`,
      [tenantId, nuevoProducto.id, rendimiento, instrucciones || null]
    );

    const nuevaReceta = recetaRows[0];

    for (const ing of ingredientes) {
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
        [nuevaReceta.id, ing.ingrediente_id, ing.cantidad, ing.unidad_medida_id, ing.preparacion || null]
      );
    }

    await client.query('COMMIT');

    logger.info('Receta creada', {
      producto_id: nuevoProducto.id,
      receta_id: nuevaReceta.id,
      ingredientes: ingredientes.length,
    });

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
      producto: nuevoProducto,
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
