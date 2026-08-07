import { query } from '../../../../shared/config/database.js';
import { convertirCantidad } from '../../stock-service.js';
import { logger } from '../../../../shared/utils/logger.js';

export const registrarConteo = async ({
  sesionId,
  tenantId,
  usuarioId,
  datos,
}: {
  sesionId: string;
  tenantId: string;
  usuarioId: string;
  datos: {
    producto_id: string;
    stock_fisico: number;
    unidad_medida_id?: string;
  };
}) => {
  const { producto_id, stock_fisico, unidad_medida_id } = datos;

  const { rows: sesiones } = await query(
    `SELECT id, stock_snapshot FROM inventario_sesiones
     WHERE id = $1 AND tenant_id = $2 AND estado = 'abierta'`,
    [sesionId, tenantId]
  );

  if (sesiones.length === 0) {
    throw { status: 400, mensaje: 'La sesión no existe o no está abierta.' };
  }

  const sesion = sesiones[0];
  const snapshot = (sesion.stock_snapshot as Record<string, number>) || {};

  if (snapshot[producto_id] === undefined) {
    throw { status: 400, mensaje: 'Este producto no tiene control de inventario activado o no pertenece al tenant.' };
  }

  const { rows: productos } = await query(
    `SELECT id, nombre, stock_actual, tiene_stock, unidad_medida_id FROM productos
     WHERE id = $1 AND tenant_id = $2`,
    [producto_id, tenantId]
  );

  if (productos.length === 0 || !(productos[0] as { tiene_stock: boolean }).tiene_stock) {
    throw { status: 400, mensaje: 'Este producto no tiene control de inventario activado.' };
  }

  const stockSistema = snapshot[producto_id];

  let cantidadBase = stock_fisico;
  let cantidadInput: number | null = null;
  let unidadInputId: string | null = null;
  let unidadMedidaId = unidad_medida_id || null;

  if (unidad_medida_id) {
    const conversion = await convertirCantidad({
      productoId: producto_id,
      tenantId,
      cantidad: stock_fisico,
      unidadMedidaId: unidad_medida_id,
    });
    cantidadBase = conversion.cantidadBase;
    cantidadInput = conversion.cantidadInput;
    unidadInputId = conversion.unidadInputId;
    unidadMedidaId = conversion.unidadMedidaId;
  }

  await query(
    `INSERT INTO inventario_conteos (sesion_id, producto_id, stock_sistema, stock_fisico,
      unidad_medida_id, cantidad_input, unidad_input_id, contado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (sesion_id, producto_id)
     DO UPDATE SET stock_fisico = $4, unidad_medida_id = $5, cantidad_input = $6,
                   unidad_input_id = $7, contado_por = $8, contado_en = NOW()`,
    [sesionId, producto_id, stockSistema, cantidadBase, unidadMedidaId, cantidadInput, unidadInputId, usuarioId]
  );

  logger.info('Conteo registrado', {
    sesion_id: sesionId,
    producto_id,
    stock_sistema: stockSistema,
    stock_fisico: cantidadBase,
  });
};
