import { query } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { esCategoriaHoja } from '../../shared.js';
import { obtenerCategoria } from '../../categorias/obtener/service.js';

export const crearProducto = async ({ tenantId, datos }: { tenantId: string; datos: Record<string, unknown> }) => {
  const {
    nombre, descripcion, precio, categoria_id,
    imagen_url, tiene_stock, stock_actual, stock_minimo,
    codigo, orden,
    se_vende, tiene_receta, unidad_medida_id,
  } = datos as {
    nombre: string;
    descripcion?: string;
    precio: number;
    categoria_id?: string;
    imagen_url?: string;
    tiene_stock?: boolean;
    stock_actual?: number;
    stock_minimo?: number;
    codigo?: string;
    orden?: number;
    se_vende?: boolean;
    tiene_receta?: boolean;
    unidad_medida_id?: string;
  };

  if (categoria_id) {
    await obtenerCategoria({ tenantId, categoriaId: categoria_id });
    const esHoja = await esCategoriaHoja({ tenantId, categoriaId: categoria_id });
    if (!esHoja) {
      throw { status: 400, mensaje: 'Solo se pueden asignar productos a categorías hoja (sin subcategorías).' };
    }
  }

  const { rows } = await query(
    `INSERT INTO productos
       (tenant_id, categoria_id, nombre, descripcion, precio,
        imagen_url, tiene_stock, stock_actual, stock_minimo,
        codigo, orden, se_vende, tiene_receta, unidad_medida_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING
       id, nombre, descripcion, precio, imagen_url,
       tiene_stock, stock_actual, stock_minimo,
       codigo, activo, orden, categoria_id,
       se_vende, tiene_receta, unidad_medida_id, creado_en`,
    [
      tenantId,
      categoria_id || null,
      nombre,
      descripcion || null,
      precio,
      imagen_url || null,
      tiene_stock ?? false,
      stock_actual ?? 0,
      stock_minimo ?? 0,
      codigo || null,
      orden ?? 0,
      se_vende ?? true,
      tiene_receta ?? false,
      unidad_medida_id || null,
    ]
  );

  logger.info('Producto creado', { tenant_id: tenantId, nombre, precio });
  return rows[0];
};
