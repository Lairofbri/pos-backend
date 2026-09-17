import { query, getClient } from '../../../shared/config/database.js';
import { obtenerClientePorTenant } from '../../../shared/dte-client.js';
import { logger } from '../../../shared/utils/logger.js';
import { limpiarPayloadSecreto } from '../payload-seguro.js';
import { mapearEstadoFiscal, extraerResultado } from '../estados.js';

const MAPA_TIPO_DOC: Record<string, string> = {
  dui: '13', nit: '36', pasaporte: '03', carnet_residente: '02', otro: '37',
};

const buscarCodigoDepto = async (nombre: string): Promise<string | null> => {
  const { rows } = await query(
    `SELECT codigo FROM departamentos WHERE LOWER(nombre) = $1`,
    [nombre.toLowerCase().trim()]
  );
  return rows[0]?.codigo || null;
};

const buscarCodigoMuni = async (nombre: string, deptoCod: string): Promise<string | null> => {
  const { rows } = await query(
    `SELECT codigo FROM municipios WHERE LOWER(nombre) = $1 AND departamento_cod = $2`,
    [nombre.toLowerCase().trim(), deptoCod]
  );
  return rows[0]?.codigo || null;
};

const MAPA_METODO_MH: Record<string, string> = {
  efectivo: '01',
  tarjeta: '03',
  tarjeta_debito: '02',
  tarjeta_credito: '03',
  transferencia: '05',
  bitcoin: '11',
  monedero_electronico: '09',
  cheque: '04',
  tarjeta_empresarial: '06',
  bonos: '07',
  vales: '10',
  otro: '99',
};

const ENDPOINTS: Record<string, string> = {
  '01': '/api/dte/emitir/fcf',
  '03': '/api/dte/emitir/ccf',
  '14': '/api/dte/emitir/fse',
};

// Fase 3 — estados fiscales explícitos del DTE en el POS.
// (mapearEstadoFiscal y extraerResultado provienen de ../estados.ts)

// Fase 3 — idempotencia: si ya existe un DTE para (tenant, orden, tipo),
// reutilizarlo en lugar de volver a emitir. No se consume correlativo.
const buscarDTEExistente = async (tenantId: string, ordenId: string, tipoDte: string) => {
  const { rows } = await query(
    `SELECT * FROM dtes_orden
     WHERE tenant_id = $1 AND orden_id = $2 AND tipo_dte = $3
     ORDER BY creado_en DESC
     LIMIT 1`,
    [tenantId, ordenId, tipoDte]
  );
  return rows[0] || null;
};

const mapearRespuestaExistente = (dte: Record<string, unknown>) => ({
  codigo_generacion: dte.codigo_generacion || null,
  numero_control: dte.numero_control || null,
  sello_recepcion: dte.sello_recepcion || null,
  estado: dte.estado || 'pendiente',
  reutilizado: true,
});

const persistirRechazo = async (
  tenantId: string,
  ordenId: string,
  tipoDte: string,
  payload: Record<string, unknown>,
  mensaje: string,
  detalles?: unknown
) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE ordenes
       SET dte_estado = 'rechazado',
           dte_emitido_en = COALESCE(dte_emitido_en, NOW())
       WHERE id = $1`,
      [ordenId]
    );
    await client.query(
      `INSERT INTO dtes_orden (orden_id, tenant_id, tipo_dte, estado, json_envio, errores, creado_en)
       VALUES ($1, $2, $3, 'rechazado', $4, $5, NOW())
       ON CONFLICT (tenant_id, orden_id, tipo_dte) DO UPDATE
       SET estado = 'rechazado', errores = EXCLUDED.errores, actualizado_en = NOW()`,
      [ordenId, tenantId, tipoDte, JSON.stringify(payload), JSON.stringify({ mensaje, detalles })]
    );
    await client.query('COMMIT');
  } catch (errTx) {
    await client.query('ROLLBACK');
    logger.error('Error al persistir rechazo DTE', { error: (errTx as Error).message, ordenId });
  } finally {
    client.release();
  }
};

type OrdenRow = Record<string, unknown>;
type ItemRow = Record<string, unknown>;
type PagoRow = Record<string, unknown>;
type TenantRow = { cod_estable_mh: string | null; cod_punto_venta_mh: string | null };

const obtenerOrdenCompleta = async (tenantId: string, ordenId: string) => {
  const { rows: ordenes } = await query(
    `SELECT o.*, c.nombre AS cliente_nombre, c.apellido AS cliente_apellido,
            c.tipo_documento, c.numero_documento,
            c.nit AS cliente_nit, c.nrc AS cliente_nrc,
            c.razon_social,
            c.direccion AS cliente_direccion, c.telefono AS cliente_telefono,
            c.email AS cliente_email, c.departamento, c.municipio
     FROM ordenes o
     LEFT JOIN clientes c ON c.id = o.cliente_id
     WHERE o.id = $1 AND o.tenant_id = $2`,
    [ordenId, tenantId]
  );

  if (ordenes.length === 0) {
    throw { status: 404, mensaje: 'Orden no encontrada.' };
  }

  const orden = ordenes[0] as OrdenRow;

  if (orden.estado !== 'pagada') {
    throw { status: 400, mensaje: 'La orden debe estar pagada para emitir un DTE.' };
  }

  const { rows: items } = await query(
    `SELECT oi.*, p.codigo AS producto_codigo, p.nombre AS producto_nombre
     FROM orden_items oi
     LEFT JOIN productos p ON p.id = oi.producto_id
     WHERE oi.orden_id = $1
     ORDER BY oi.creado_en ASC`,
    [ordenId]
  );

  const { rows: pagos } = await query(
    `SELECT * FROM pagos WHERE orden_id = $1 ORDER BY creado_en ASC`,
    [ordenId]
  );

  return { orden, items: items as ItemRow[], pagos: pagos as PagoRow[] };
};

const mapearItems = (items: ItemRow[]) => {
  return items
    .filter((item) => item.producto_id)
    .map((item) => ({
      descripcion: (item.producto_nombre as string) || (item.descripcion as string) || 'Producto',
      precio_unitario: Number(item.precio_unitario) || 0,
      cantidad: Number(item.cantidad) || 1,
      descuento: Number(item.descuento) || 0,
      codigo: (item.producto_codigo as string) || null,
      tipo_item: 2,
      uni_medida: 59,
    }));
};

export const emitir = async ({ tenantId, usuarioId: _usuarioId, datos }: { tenantId: string; usuarioId: string; datos: Record<string, unknown> }) => {
  const ordenId = datos.orden_id as string;
  const tipoDte = (datos.tipo_dte as string) || '01';

  const { orden, items, pagos } = await obtenerOrdenCompleta(tenantId, ordenId);

  // Fase 3 — idempotencia: repetir la misma petición produce la misma respuesta.
  // Si ya se emitió un DTE para (tenant, orden, tipo), NO volver a emitir.
  const existente = await buscarDTEExistente(tenantId, ordenId, tipoDte);
  if (existente) {
    logger.info('DTE ya emitido para esta orden — reutilizando', {
      ordenId,
      tipoDte,
      estado: existente.estado,
    });
    return mapearRespuestaExistente(existente);
  }

  const { rows: tenantRows } = await query(
    'SELECT cod_estable_mh, cod_punto_venta_mh FROM tenants WHERE id = $1',
    [tenantId]
  );
  const tenant = (tenantRows[0] || {}) as TenantRow;

  const totalOrden = Number(orden.total) || 0;
  const propina = Number(orden.propina) || 0;
  const totalSinPropina = totalOrden - propina;

  const cuerpoItems = mapearItems(items);

  // Construir pagos[] con códigos MH (CAT-007)
  const pagosMH: Array<{ codigo: string; montoPago: number; referencia?: string | null }> = [];
  let montoEfectivo = 0;
  for (const pago of pagos) {
    const metodo = (pago.metodo as string) || 'efectivo';
    const codigoMH = MAPA_METODO_MH[metodo] || '99';
    const monto = Number(pago.total_pagado) || 0;

    if (metodo === 'mixto') {
      const ef = Number(pago.monto_efectivo) || 0;
      const tj = Number(pago.monto_tarjeta) || 0;
      if (ef > 0) pagosMH.push({ codigo: '01', montoPago: ef });
      if (tj > 0) pagosMH.push({ codigo: '03', montoPago: tj });
      montoEfectivo += ef;
    } else {
      if (metodo === 'efectivo') montoEfectivo += monto;
      const ref = (pago.referencia_tarjeta as string)
        || (pago.referencia_transferencia as string)
        || (pago.hash_bitcoin as string)
        || (pago.referencia_cheque as string)
        || null;
      pagosMH.push({ codigo: codigoMH, montoPago: monto, referencia: ref });
    }
  }

  const payloadBase: Record<string, unknown> = {
    items: cuerpoItems,
    pagos: pagosMH,
    metodo_pago: 'mixto',
    monto_efectivo: Math.round(montoEfectivo * 100) / 100,
    monto_tarjeta: 0,
    orden_referencia: orden.numero_orden?.toString() || null,
    cod_estable_mh: tenant.cod_estable_mh || null,
    cod_punto_venta_mh: tenant.cod_punto_venta_mh || null,
    // Fase 3 — clave idempotente: tenant + orden + tipo. Los reintentos
    // reutilizan el mismo DTE en el dte-service (sin nuevo correlativo).
    idempotency_key: `${ordenId}:${tipoDte}`,
  };

  let payload: Record<string, unknown>;

  if (tipoDte === '01') {
    const nombreReceptor = orden.cliente_nombre
      ? `${orden.cliente_nombre}${orden.cliente_apellido ? ' ' + orden.cliente_apellido : ''}`
      : 'Consumidor Final';

    const tipoDoc = ((orden.tipo_documento as string) || '').toLowerCase();
    const receptor: Record<string, unknown> = {
      nombre: nombreReceptor,
      tipo_documento: MAPA_TIPO_DOC[tipoDoc] || '13',
      num_documento: (orden.numero_documento as string) || '',
    };

    if (orden.cliente_telefono) receptor.telefono = orden.cliente_telefono;
    if (orden.cliente_email) receptor.correo = orden.cliente_email;
    if (orden.cliente_direccion) receptor.direccion = orden.cliente_direccion;

    let deptoCod = '06';
    let muniCod = '20';
    if (orden.departamento && orden.municipio) {
      const dCod = await buscarCodigoDepto(orden.departamento as string);
      if (dCod) {
        deptoCod = dCod;
        const mCod = await buscarCodigoMuni(orden.municipio as string, dCod);
        if (mCod) muniCod = mCod;
      }
    }
    receptor.departamento_cod = deptoCod;
    receptor.municipio_cod = muniCod;

    payload = { ...payloadBase, receptor };
  } else if (tipoDte === '03') {
    if (!orden.cliente_id || !orden.cliente_nit) {
      throw { status: 400, mensaje: 'CCF requiere un cliente con NIT registrado.' };
    }

    const receptor: Record<string, unknown> = {
      nit: orden.cliente_nit,
      nrc: orden.cliente_nrc || null,
      nombre: (orden.cliente_nombre as string) || 'Consumidor Final',
    };

    if (orden.cliente_telefono) receptor.telefono = orden.cliente_telefono;
    if (orden.cliente_email) receptor.correo = orden.cliente_email;
    if (orden.cliente_direccion) receptor.direccion = orden.cliente_direccion;

    let deptoCod = '06';
    let muniCod = '20';
    if (orden.departamento && orden.municipio) {
      const dCod = await buscarCodigoDepto(orden.departamento as string);
      if (dCod) {
        deptoCod = dCod;
        const mCod = await buscarCodigoMuni(orden.municipio as string, dCod);
        if (mCod) muniCod = mCod;
      }
    }
    receptor.departamento_cod = deptoCod;
    receptor.municipio_cod = muniCod;

    payload = { ...payloadBase, receptor };
  } else {
    if (!orden.cliente_id || !orden.cliente_nit) {
      throw { status: 400, mensaje: 'FSE requiere un cliente con NIT registrado.' };
    }

    const receptor: Record<string, unknown> = {
      nit: orden.cliente_nit,
      nombre: (orden.cliente_nombre as string) || 'Sujeto Excluido',
    };

    if (orden.cliente_telefono) receptor.telefono = orden.cliente_telefono;
    if (orden.cliente_email) receptor.correo = orden.cliente_email;
    if (orden.cliente_direccion) receptor.direccion = orden.cliente_direccion;

    if (orden.departamento && orden.municipio) {
      const dCod = await buscarCodigoDepto(orden.departamento as string);
      if (dCod) {
        receptor.departamento_cod = dCod;
        const mCod = await buscarCodigoMuni(orden.municipio as string, dCod);
        if (mCod) receptor.municipio_cod = mCod;
      }
    }

    payload = { ...payloadBase, receptor };
  }

  const endpoint = ENDPOINTS[tipoDte];

  // SEGURIDAD: nunca transportar ni persistir credenciales del certificado.
  const payloadSeguro = limpiarPayloadSecreto(payload);

  logger.info('Emitiendo DTE desde POS', { ordenId, tipoDte, endpoint, items: cuerpoItems.length, totalSinPropina });

  let resultado: Record<string, unknown>;
  try {
    const cliente = await obtenerClientePorTenant(tenantId);
    const resp = await cliente.post(endpoint, payloadSeguro);
    resultado = extraerResultado(resp);
  } catch (err) {
    const e = err as { status?: number; mensaje?: string; detalles?: unknown };
    const status = e.status || 502;
    const mensaje = e.mensaje || 'Error al emitir DTE';

    if (status === 422) {
      // Rechazo fiscal: estado final, NO se reintenta automáticamente.
      await persistirRechazo(tenantId, ordenId, tipoDte, payloadSeguro, mensaje, e.detalles);
      logger.warn('DTE rechazado por Hacienda', { ordenId, tipoDte, mensaje });
    } else {
      // Error transitorio: encolar para reintento seguro por el cron.
      await encolarPendiente(tenantId, ordenId, tipoDte, payloadSeguro, mensaje);
    }

    throw { status, mensaje, detalles: e.detalles };
  }

  const client = await getClient();
  const estadoFiscal = mapearEstadoFiscal(resultado.estado as string);
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE ordenes
       SET dte_codigo_generacion = $1,
           dte_numero_control = $2,
           dte_estado = $3,
           dte_emitido_en = NOW()
       WHERE id = $4`,
      [resultado.codigo_generacion || null, resultado.numero_control || null, estadoFiscal, ordenId]
    );

    await client.query(
      `INSERT INTO dtes_orden (orden_id, tenant_id, tipo_dte, codigo_generacion, numero_control, estado, json_envio, json_respuesta, creado_en)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (tenant_id, orden_id, tipo_dte) DO UPDATE
       SET codigo_generacion = EXCLUDED.codigo_generacion,
           numero_control = EXCLUDED.numero_control,
           estado = EXCLUDED.estado,
           json_respuesta = EXCLUDED.json_respuesta,
           actualizado_en = NOW()`,
      [
        ordenId, tenantId, tipoDte,
        resultado.codigo_generacion || null, resultado.numero_control || null,
        estadoFiscal,
        JSON.stringify(payloadSeguro), JSON.stringify(resultado),
      ]
    );

    await client.query('COMMIT');

    logger.info('DTE emitido exitosamente desde POS', { ordenId, codigoGeneracion: resultado.codigo_generacion, numeroControl: resultado.numero_control, estado: estadoFiscal });
  } catch (errTx) {
    await client.query('ROLLBACK');
    logger.error('Error al guardar referencia DTE en orden', { error: (errTx as Error).message, ordenId });
    throw { status: 500, mensaje: 'DTE emitido pero error al guardar referencia local.' };
  } finally {
    client.release();
  }

  return {
    codigo_generacion: resultado.codigo_generacion,
    numero_control: resultado.numero_control,
    sello_recepcion: resultado.sello_recepcion || null,
    estado: estadoFiscal,
  };
};

async function encolarPendiente(tenantId: string, ordenId: string, tipoDte: string, payload: Record<string, unknown>, error: string) {
  try {
    // SEGURIDAD: defensa en profundidad — jamás persistir secretos en la cola.
    const payloadSeguro = limpiarPayloadSecreto(payload);
    await query(
      `INSERT INTO dte_pendientes (orden_id, tenant_id, tipo_dte, payload, ultimo_error, intentos)
       VALUES ($1, $2, $3, $4, $5, 1)
       ON CONFLICT (tenant_id, orden_id, tipo_dte) DO UPDATE
       SET intentos = dte_pendientes.intentos + 1, ultimo_error = $5, actualizado_en = NOW()`,
      [ordenId, tenantId, tipoDte, JSON.stringify(payloadSeguro), error]
    );
    logger.warn('DTE encolado para reintento', { ordenId, tipoDte, error });
  } catch (err) {
    logger.error('Error al encolar DTE pendiente', { error: (err as Error).message, ordenId });
  }
}
