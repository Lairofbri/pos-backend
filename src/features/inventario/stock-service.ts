import type { PoolClient } from 'pg';
import { query } from '../../shared/config/database.js';
import { logger } from '../../shared/utils/logger.js';

function ejecutar(client: PoolClient | undefined, text: string, params?: unknown[]) {
  return client ? client.query(text, params) : query(text, params);
}

interface StockBaseParams {
  tenantId: string;
  productoId: string;
  sucursalId?: string | null;
  usuarioId: string;
  client?: PoolClient;
}

interface DescontarStockParams extends StockBaseParams {
  cantidad: number;
  referenciaTipo?: string;
  referenciaId?: string;
  motivo?: string;
}

interface IncrementarStockParams extends StockBaseParams {
  cantidad: number;
  tipoMovimiento?: string;
  motivo?: string;
}

interface FijarStockParams extends StockBaseParams {
  nuevoStock: number;
  motivo?: string;
  tipoMovimiento?: string;
  sesionId?: string;
}

interface ConversionParams {
  productoId: string;
  tenantId: string;
  cantidad: number;
  unidadMedidaId?: string | null;
}

export async function obtenerStock({
  tenantId,
  productoId,
  forUpdate = false,
  client,
}: {
  tenantId: string;
  productoId: string;
  forUpdate?: boolean;
  client?: PoolClient;
}) {
  const lock = forUpdate ? ' FOR UPDATE' : '';
  const { rows } = await ejecutar(client,
    `SELECT id, tiene_stock, stock_actual FROM productos WHERE id = $1 AND tenant_id = $2${lock}`,
    [productoId, tenantId]
  );

  if (rows.length === 0) {
    throw { status: 404, mensaje: 'Producto no encontrado.' };
  }

  const p = rows[0] as { id: string; tiene_stock: boolean; stock_actual: number };

  if (!p.tiene_stock) {
    throw { status: 400, mensaje: 'Este producto no tiene control de inventario activado.' };
  }

  return p;
}

export async function convertirCantidad({
  productoId,
  tenantId,
  cantidad,
  unidadMedidaId,
}: ConversionParams): Promise<{
  cantidadBase: number;
  cantidadInput: number | null;
  unidadInputId: string | null;
  unidadMedidaId: string | null;
}> {
  if (!unidadMedidaId) {
    return {
      cantidadBase: cantidad,
      cantidadInput: null,
      unidadInputId: null,
      unidadMedidaId: null,
    };
  }

  const { rows } = await query(
    `SELECT u.factor AS input_factor,
            p.unidad_medida_id AS prod_um_id,
            pu.factor AS prod_factor
     FROM unidades_medida u
     JOIN productos p ON p.id = $1 AND p.tenant_id = $2
     LEFT JOIN unidades_medida pu ON pu.id = p.unidad_medida_id
     WHERE u.id = $3`,
    [productoId, tenantId, unidadMedidaId]
  );

  if (rows.length === 0) return { cantidadBase: cantidad, cantidadInput: null, unidadInputId: null, unidadMedidaId: null };

  const conv = rows[0] as { input_factor: number; prod_um_id: string | null; prod_factor: number | null };
  const inputFactor = Number(conv.input_factor);
  const prodFactor = Number(conv.prod_factor || 1);
  const qtyEnBase = cantidad * inputFactor;
  const cantidadBase = prodFactor > 0 ? qtyEnBase / prodFactor : qtyEnBase;

  return {
    cantidadBase,
    cantidadInput: cantidad,
    unidadInputId: unidadMedidaId,
    unidadMedidaId: conv.prod_um_id || unidadMedidaId,
  };
}

export async function descontarStock({
  tenantId,
  productoId,
  cantidad,
  sucursalId,
  usuarioId,
  referenciaTipo,
  referenciaId,
  motivo,
  client,
}: DescontarStockParams) {
  const product = await obtenerStock({ tenantId, productoId, forUpdate: true, client });

  const stockAnterior = product.stock_actual;
  const stockPosterior = stockAnterior - cantidad;

  await ejecutar(client,
    `UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2 AND tenant_id = $3`,
    [cantidad, productoId, tenantId]
  );

  const { rows: movRows } = await ejecutar(client,
    `INSERT INTO movimientos_inventario
       (tenant_id, sucursal_id, producto_id, tipo_movimiento, cantidad,
        stock_anterior, stock_posterior, creado_por, motivo,
        referencia_tipo, referencia_id)
     VALUES ($1, $2, $3, 'consumo', $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [tenantId, sucursalId || null, productoId, cantidad, stockAnterior, stockPosterior,
     usuarioId, motivo || null, referenciaTipo || null, referenciaId || null]
  );

  logger.info('Stock descontado', {
    producto_id: productoId,
    cantidad,
    stock_anterior: stockAnterior,
    stock_posterior: stockPosterior,
    referencia_tipo: referenciaTipo,
  });

  return { stockAnterior, stockPosterior, movimientoId: movRows[0].id };
}

export async function incrementarStock({
  tenantId,
  productoId,
  cantidad,
  sucursalId,
  usuarioId,
  tipoMovimiento = 'compra',
  motivo,
  client,
}: IncrementarStockParams) {
  const product = await obtenerStock({ tenantId, productoId, forUpdate: true, client });

  const stockAnterior = product.stock_actual;
  const stockPosterior = stockAnterior + cantidad;

  await ejecutar(client,
    `UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2 AND tenant_id = $3`,
    [cantidad, productoId, tenantId]
  );

  const { rows: movRows } = await ejecutar(client,
    `INSERT INTO movimientos_inventario
       (tenant_id, sucursal_id, producto_id, tipo_movimiento, cantidad,
        stock_anterior, stock_posterior, motivo, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [tenantId, sucursalId || null, productoId, tipoMovimiento, cantidad, stockAnterior, stockPosterior,
     motivo || null, usuarioId]
  );

  logger.info('Stock incrementado', {
    producto_id: productoId,
    tipo: tipoMovimiento,
    cantidad,
    stock_anterior: stockAnterior,
    stock_posterior: stockPosterior,
  });

  return { stockAnterior, stockPosterior, movimientoId: movRows[0].id };
}

export async function fijarStock({
  tenantId,
  productoId,
  nuevoStock,
  sucursalId,
  usuarioId,
  motivo,
  tipoMovimiento,
  sesionId,
  client,
}: FijarStockParams) {
  const product = await obtenerStock({ tenantId, productoId, forUpdate: true, client });

  const stockAnterior = product.stock_actual;

  const tm = tipoMovimiento || 'ajuste';

  const hasSesion = !!sesionId;
  const columnas = hasSesion
    ? '(tenant_id, sucursal_id, producto_id, tipo_movimiento, cantidad, stock_anterior, stock_posterior, motivo, creado_por, sesion_id)'
    : '(tenant_id, sucursal_id, producto_id, tipo_movimiento, cantidad, stock_anterior, stock_posterior, motivo, creado_por)';
  const values = hasSesion
    ? '($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)'
    : '($1, $2, $3, $4, $5, $6, $7, $8, $9)';

  const params: unknown[] = [
    tenantId, sucursalId || null, productoId, tm, nuevoStock,
    stockAnterior, nuevoStock, motivo || null, usuarioId,
  ];
  if (hasSesion) params.push(sesionId);

  const { rows: movRows } = await ejecutar(client,
    `INSERT INTO movimientos_inventario ${columnas} VALUES ${values} RETURNING id`,
    params
  );

  logger.info('Stock fijado', {
    producto_id: productoId,
    stock_anterior: stockAnterior,
    stock_posterior: nuevoStock,
    tipo_movimiento: tm,
    sesion_id: sesionId,
  });

  return { stockAnterior, stockPosterior: nuevoStock, movimientoId: movRows[0].id };
}

export function validarDisponibilidad(stockActual: number, cantidadRequerida: number): boolean {
  return stockActual >= cantidadRequerida;
}
