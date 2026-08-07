import { query } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';

export const obtenerDetalleSesion = async ({
  sesionId,
  tenantId,
}: {
  sesionId: string;
  tenantId: string;
}) => {
  const { rows: sesiones } = await query(
    `SELECT s.id, s.sucursal_id, su.nombre AS sucursal_nombre,
            s.estado, s.notas, s.stock_snapshot, s.creado_en, s.cerrado_en,
            cu.nombre AS creado_por_nombre,
            cu2.nombre AS cerrado_por_nombre
     FROM inventario_sesiones s
     LEFT JOIN sucursales su ON su.id = s.sucursal_id
     LEFT JOIN usuarios cu ON cu.id = s.creado_por
     LEFT JOIN usuarios cu2 ON cu2.id = s.cerrado_por
     WHERE s.id = $1 AND s.tenant_id = $2`,
    [sesionId, tenantId]
  );

  if (sesiones.length === 0) {
    throw { status: 404, mensaje: 'Sesión de inventario no encontrada.' };
  }

  const sesion = sesiones[0];
  const snapshot = (sesion.stock_snapshot as Record<string, number>) || {};

  const { rows: conteos } = await query(
    `SELECT c.producto_id, p.nombre AS producto_nombre,
            c.stock_sistema, c.stock_fisico,
            c.unidad_medida_id, um.nombre AS unidad_nombre,
            c.cantidad_input, c.unidad_input_id, umi.nombre AS unidad_input_nombre,
            u.nombre AS contado_por_nombre, c.contado_en,
            c.aplicado, c.ignorado
     FROM inventario_conteos c
     JOIN productos p ON p.id = c.producto_id AND p.tenant_id = $2
     LEFT JOIN unidades_medida um ON um.id = c.unidad_medida_id
     LEFT JOIN unidades_medida umi ON umi.id = c.unidad_input_id
     LEFT JOIN usuarios u ON u.id = c.contado_por
     WHERE c.sesion_id = $1
     ORDER BY c.contado_en DESC`,
    [sesionId, tenantId]
  );

  const conteosMapped = conteos.map((c) => {
    const stockSistema = Number(c.stock_sistema);
    const stockFisico = Number(c.stock_fisico);
    const productoId = c.producto_id;

    const stockActual = snapshot[productoId];
    const huboMovimientos = stockActual !== undefined && stockActual !== stockSistema;

    return {
      producto_id: productoId,
      producto_nombre: c.producto_nombre,
      stock_sistema: stockSistema,
      stock_fisico: stockFisico,
      diferencia: stockFisico - stockSistema,
      unidad_medida_id: c.unidad_medida_id,
      unidad_nombre: c.unidad_nombre,
      cantidad_input: c.cantidad_input ? Number(c.cantidad_input) : null,
      unidad_input_id: c.unidad_input_id,
      unidad_input_nombre: c.unidad_input_nombre,
      contado_por_nombre: c.contado_por_nombre,
      contado_en: c.contado_en,
      hubo_movimientos: huboMovimientos,
      aplicado: c.aplicado,
      ignorado: c.ignorado,
    };
  });

  const totalProductos = Object.keys(snapshot).length;
  const contados = conteos.length;

  const resumen = sesion.estado === 'abierta' ? {
    total_productos: totalProductos,
    contados,
    sin_contar: totalProductos - contados,
    diferencias: conteosMapped.filter(c => c.diferencia !== 0).length,
  } : null;

  logger.info('Detalle de sesión de inventario obtenido', {
    sesion_id: sesionId,
    estado: sesion.estado,
    conteos: conteos.length,
  });

  return {
    id: sesion.id,
    sucursal_id: sesion.sucursal_id,
    sucursal_nombre: sesion.sucursal_nombre,
    estado: sesion.estado,
    notas: sesion.notas,
    stock_snapshot: snapshot,
    creado_por_nombre: sesion.creado_por_nombre,
    creado_en: sesion.creado_en,
    cerrado_por_nombre: sesion.cerrado_por_nombre || null,
    cerrado_en: sesion.cerrado_en || null,
    conteos: conteosMapped,
    resumen,
  };
};
