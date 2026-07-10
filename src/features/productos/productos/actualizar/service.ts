import { query } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { esCategoriaHoja } from '../../shared.js';
import { obtenerCategoria } from '../../categorias/obtener/service.js';
import { obtenerProducto } from '../obtener/service.js';

export const actualizarProducto = async ({ tenantId, productoId, datos }: { tenantId: string; productoId: string; datos: Record<string, unknown> }) => {
  await obtenerProducto({ tenantId, productoId });

  if (datos.categoria_id) {
    await obtenerCategoria({ tenantId, categoriaId: datos.categoria_id as string });
    const esHoja = await esCategoriaHoja({ tenantId, categoriaId: datos.categoria_id as string });
    if (!esHoja) {
      throw { status: 400, mensaje: 'Solo se pueden asignar productos a categorías hoja (sin subcategorías).' };
    }
  }

  const campos: string[] = [];
  const valores: unknown[] = [];
  let idx = 1;

  const camposPermitidos = [
    'nombre', 'descripcion', 'precio', 'categoria_id',
    'imagen_url', 'tiene_stock', 'stock_actual', 'stock_minimo',
    'codigo', 'orden', 'activo',
  ];

  for (const campo of camposPermitidos) {
    if (datos[campo] !== undefined) {
      campos.push(`${campo} = $${idx++}`);
      valores.push(datos[campo]);
    }
  }

  if (campos.length === 0) {
    throw { status: 400, mensaje: 'No hay campos para actualizar.' };
  }

  valores.push(productoId, tenantId);

  const { rows } = await query(
    `UPDATE productos SET ${campos.join(', ')}
     WHERE id = $${idx++} AND tenant_id = $${idx}
     RETURNING
       id, nombre, descripcion, precio, imagen_url,
       tiene_stock, stock_actual, stock_minimo,
       codigo, activo, orden, categoria_id`,
    valores
  );

  logger.info('Producto actualizado', { producto_id: productoId });
  return rows[0];
};
