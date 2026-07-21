import { query } from '../../shared/config/database.js';

export const obtenerCajaAbierta = async ({ tenantId, sucursalId = null }: { tenantId: string; sucursalId?: string | null }) => {
  const condiciones = ["c.tenant_id = $1", "c.estado = 'abierta'"];
  const valores: unknown[] = [tenantId];
  let idx = 2;

  if (sucursalId) {
    condiciones.push(`c.sucursal_id = $${idx++}`);
    valores.push(sucursalId);
  }

  const { rows } = await query(
    `SELECT c.id, c.tenant_id, c.sucursal_id, c.estado,
            c.monto_inicial, c.total_esperado,
            c.total_ventas, c.total_efectivo, c.total_tarjeta,
            c.total_transferencia, c.total_bitcoin, c.total_monedero,
            c.total_cheque, c.total_tarjeta_empresarial,
            c.total_bonos, c.total_vales, c.total_otros,
            c.total_retiros, c.total_depositos,
            c.fecha_apertura, c.usuario_apertura_id,
            u.nombre AS usuario_apertura
     FROM cajas c
     JOIN usuarios u ON u.id = c.usuario_apertura_id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY c.fecha_apertura DESC LIMIT 1`,
    valores
  );

  return (rows[0] as Record<string, unknown>) || null;
};

export const recalcularTotalesCaja = async (client: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }, cajaId: string) => {
  await client.query(
    `UPDATE cajas SET
       total_ventas = COALESCE((SELECT SUM(mc.monto) FROM movimientos_caja mc WHERE mc.caja_id = $1 AND mc.tipo = 'ingreso'), 0),
       total_efectivo = COALESCE((SELECT SUM(mc.monto) FROM movimientos_caja mc WHERE mc.caja_id = $1 AND mc.tipo = 'ingreso' AND mc.metodo_pago = 'efectivo'), 0),
       total_tarjeta = COALESCE((SELECT SUM(mc.monto) FROM movimientos_caja mc WHERE mc.caja_id = $1 AND mc.tipo = 'ingreso' AND mc.metodo_pago IN ('tarjeta', 'tarjeta_debito', 'tarjeta_credito', 'tarjeta_empresarial')), 0),
       total_transferencia = COALESCE((SELECT SUM(mc.monto) FROM movimientos_caja mc WHERE mc.caja_id = $1 AND mc.tipo = 'ingreso' AND mc.metodo_pago = 'transferencia'), 0),
       total_bitcoin = COALESCE((SELECT SUM(mc.monto) FROM movimientos_caja mc WHERE mc.caja_id = $1 AND mc.tipo = 'ingreso' AND mc.metodo_pago = 'bitcoin'), 0),
       total_monedero = COALESCE((SELECT SUM(mc.monto) FROM movimientos_caja mc WHERE mc.caja_id = $1 AND mc.tipo = 'ingreso' AND mc.metodo_pago = 'monedero_electronico'), 0),
       total_cheque = COALESCE((SELECT SUM(mc.monto) FROM movimientos_caja mc WHERE mc.caja_id = $1 AND mc.tipo = 'ingreso' AND mc.metodo_pago = 'cheque'), 0),
       total_tarjeta_empresarial = COALESCE((SELECT SUM(mc.monto) FROM movimientos_caja mc WHERE mc.caja_id = $1 AND mc.tipo = 'ingreso' AND mc.metodo_pago = 'tarjeta_empresarial'), 0),
       total_bonos = COALESCE((SELECT SUM(mc.monto) FROM movimientos_caja mc WHERE mc.caja_id = $1 AND mc.tipo = 'ingreso' AND mc.metodo_pago = 'bonos'), 0),
       total_vales = COALESCE((SELECT SUM(mc.monto) FROM movimientos_caja mc WHERE mc.caja_id = $1 AND mc.tipo = 'ingreso' AND mc.metodo_pago = 'vales'), 0),
       total_otros = COALESCE((SELECT SUM(mc.monto) FROM movimientos_caja mc WHERE mc.caja_id = $1 AND mc.tipo = 'ingreso' AND mc.metodo_pago = 'otro'), 0),
       total_retiros = COALESCE((SELECT SUM(mc.monto) FROM movimientos_caja mc WHERE mc.caja_id = $1 AND mc.tipo = 'retiro'), 0),
       total_depositos = COALESCE((SELECT SUM(mc.monto) FROM movimientos_caja mc WHERE mc.caja_id = $1 AND mc.tipo = 'deposito'), 0),
       total_esperado = cajas.monto_inicial + COALESCE((
         SELECT SUM(CASE
           WHEN mc.tipo = 'ingreso' AND mc.metodo_pago IN ('efectivo', 'transferencia', 'monedero_electronico', 'cheque', 'bonos', 'vales') THEN mc.monto
           WHEN mc.tipo = 'deposito' THEN mc.monto
           WHEN mc.tipo = 'retiro' THEN -mc.monto
           ELSE 0
         END) FROM movimientos_caja mc WHERE mc.caja_id = $1
       ), 0)
     WHERE cajas.id = $1`,
    [cajaId]
  );
};

export const registrarIngresoPago = async ({ client, tenantId, cajaId, ordenId, monto, metodoPago, usuarioId }: { client: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }; tenantId: string; cajaId: string; ordenId: string; monto: number; metodoPago: string; usuarioId: string }) => {
  await client.query(
    `INSERT INTO movimientos_caja (caja_id, tenant_id, tipo, monto, motivo, usuario_id, orden_id, metodo_pago)
     VALUES ($1, $2, 'ingreso', $3, $4, $5, $6, $7)`,
    [cajaId, tenantId, monto, `Pago orden #${ordenId}`, usuarioId, ordenId, metodoPago]
  );
  await recalcularTotalesCaja(client, cajaId);
};
