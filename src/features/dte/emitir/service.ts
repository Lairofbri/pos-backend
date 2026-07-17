import { query, getClient } from '../../../shared/config/database.js';
import { obtenerClientePorTenant } from '../../../shared/dte-client.js';
import { logger } from '../../../shared/utils/logger.js';

const MAPA_TIPO_DOC: Record<string, string> = {
  dui: '13', nit: '36', pasaporte: '03', carnet_residente: '02', otro: '37',
};

const DEPTO_MAP: Record<string, string> = {
  ahachapán: '01', ahuchapan: '01',
  'santa ana': '02',
  sonsonate: '03',
  chalatenango: '04',
  'la libertad': '05',
  'san salvador': '06',
  cuscatlán: '07', cuscatlan: '07',
  'la paz': '08',
  cabañas: '09', cabanas: '09',
  'san vicente': '10',
  usulután: '11', usulutan: '11',
  'san miguel': '12',
  morazán: '13', morazan: '13',
  'la unión': '14', 'la union': '14',
};

const ENDPOINTS: Record<string, string> = {
  '01': '/api/dte/emitir/fcf',
  '03': '/api/dte/emitir/ccf',
  '14': '/api/dte/emitir/fse',
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

export const emitir = async ({ tenantId, usuarioId, datos }: { tenantId: string; usuarioId: string; datos: Record<string, unknown> }) => {
  const ordenId = datos.orden_id as string;
  const tipoDte = (datos.tipo_dte as string) || '01';
  const passwordPri = datos.password_pri as string;

  const { orden, items, pagos } = await obtenerOrdenCompleta(tenantId, ordenId);

  const { rows: tenantRows } = await query(
    'SELECT cod_estable_mh, cod_punto_venta_mh FROM tenants WHERE id = $1',
    [tenantId]
  );
  const tenant = (tenantRows[0] || {}) as TenantRow;

  const totalOrden = Number(orden.total) || 0;
  const propina = Number(orden.propina) || 0;
  const totalSinPropina = totalOrden - propina;

  let montoEfectivo = 0;
  let montoTarjeta = 0;
  for (const pago of pagos) {
    const metodo = (pago.metodo as string) || 'efectivo';
    if (metodo === 'efectivo') montoEfectivo += Number(pago.monto_efectivo) || 0;
    else montoTarjeta += Number(pago.monto_tarjeta) || 0;
  }

  const metodoPago = montoTarjeta > 0 && montoEfectivo > 0 ? 'mixto'
    : montoTarjeta > 0 ? 'tarjeta' : 'efectivo';

  const cuerpoItems = mapearItems(items);

  const payloadBase: Record<string, unknown> = {
    items: cuerpoItems,
    metodo_pago: metodoPago,
    monto_efectivo: Math.round(montoEfectivo * 100) / 100,
    monto_tarjeta: Math.round(montoTarjeta * 100) / 100,
    password_pri: passwordPri,
    orden_referencia: orden.numero_orden?.toString() || null,
    cod_estable_mh: tenant.cod_estable_mh || null,
    cod_punto_venta_mh: tenant.cod_punto_venta_mh || null,
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

    const deptoLower = ((orden.departamento as string) || '').toLowerCase().trim();
    const muniLower = ((orden.municipio as string) || '').toLowerCase().trim();
    if (orden.departamento) receptor.departamento_cod = DEPTO_MAP[deptoLower] || '06';
    if (orden.municipio) receptor.municipio_cod = DEPTO_MAP[muniLower] || '20';

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

    const deptoLower = ((orden.departamento as string) || '').toLowerCase().trim();
    const muniLower = ((orden.municipio as string) || '').toLowerCase().trim();
    if (orden.departamento) receptor.departamento_cod = DEPTO_MAP[deptoLower] || '06';
    if (orden.municipio) receptor.municipio_cod = DEPTO_MAP[muniLower] || '20';

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

    payload = { ...payloadBase, receptor };
  }

  const endpoint = ENDPOINTS[tipoDte];

  logger.info('Emitiendo DTE desde POS', { ordenId, tipoDte, endpoint, items: cuerpoItems.length, metodoPago, totalSinPropina });

  let resultado: Record<string, unknown>;
  try {
    const cliente = await obtenerClientePorTenant(tenantId);
    const resp = await cliente.post(endpoint, payload);
    resultado = resp as unknown as Record<string, unknown>;
  } catch (err) {
    const e = err as { mensaje?: string };
    await encolarPendiente(tenantId, ordenId, tipoDte, payload, e.mensaje || 'Error al emitir DTE');
    throw { status: (err as { status?: number }).status || 502, mensaje: e.mensaje || 'Error al emitir DTE.' };
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE ordenes
       SET dte_codigo_generacion = $1,
           dte_numero_control = $2,
           dte_estado = 'emitido',
           dte_emitido_en = NOW()
       WHERE id = $3`,
      [resultado.codigo_generacion || null, resultado.numero_control || null, ordenId]
    );

    await client.query(
      `INSERT INTO dtes_orden (orden_id, tenant_id, tipo_dte, codigo_generacion, numero_control, estado, json_envio, json_respuesta, creado_en)
       VALUES ($1, $2, $3, $4, $5, 'emitido', $6, $7, NOW())`,
      [
        ordenId, tenantId, tipoDte,
        resultado.codigo_generacion || null, resultado.numero_control || null,
        JSON.stringify(payload), JSON.stringify(resultado),
      ]
    );

    await client.query('COMMIT');

    logger.info('DTE emitido exitosamente desde POS', { ordenId, codigoGeneracion: resultado.codigo_generacion, numeroControl: resultado.numero_control });
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
  };
};

async function encolarPendiente(tenantId: string, ordenId: string, tipoDte: string, payload: Record<string, unknown>, error: string) {
  try {
    await query(
      `INSERT INTO dte_pendientes (orden_id, tenant_id, tipo_dte, payload, ultimo_error, intentos)
       VALUES ($1, $2, $3, $4, $5, 1)
       ON CONFLICT (orden_id) DO UPDATE
       SET intentos = dte_pendientes.intentos + 1, ultimo_error = $5, actualizado_en = NOW()`,
      [ordenId, tenantId, tipoDte, JSON.stringify(payload), error]
    );
    logger.warn('DTE encolado para reintento', { ordenId, tipoDte, error });
  } catch (err) {
    logger.error('Error al encolar DTE pendiente', { error: (err as Error).message, ordenId });
  }
}
