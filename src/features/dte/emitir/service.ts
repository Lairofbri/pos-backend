import { query, getClient } from '../../../shared/config/database.js';
import { obtenerClientePorTenant } from '../../../shared/dte-client.js';
import { servicioEmpresaDte, type ContextoFiscalEstablecimiento } from '../../../shared/dte-empresa.js';
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

/**
 * F6 — ¿la orden trae datos de ubicación del receptor?
 *
 * Solo se envía la ubicación cuando hay calle o departamento/municipio del
 * cliente. Sin datos NO se inventa una dirección: el FCF admite
 * `direccion: null` (esquema oficial) y en CCF el POS exige la ubicación del
 * cliente con un 400 accionable antes de llamar al DTE.
 */
export const necesitaUbicacionReceptor = (orden: OrdenRow) =>
  Boolean(orden.cliente_direccion || (orden.departamento && orden.municipio));

const resolverUbicacionReceptor = async (
  orden: OrdenRow
): Promise<{ departamento_cod?: string; municipio_cod?: string }> => {
  if (!necesitaUbicacionReceptor(orden)) return {};

  // Defaults de San Salvador solo cuando hay calle pero no departamento/
  // municipio resoluble (comportamiento histórico del POS).
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
  return { departamento_cod: deptoCod, municipio_cod: muniCod };
};

/**
 * F6 — receptor del DTE (puro, exportado para tests).
 *
 * FCF (01): tipoDocumento + numDocumento (Consumidor Final si la orden no trae
 * cliente). CCF (03): NIT/NRC + actividad económica. FSE (14): NIT.
 */
export const construirReceptorFiscal = ({
  tipoDte,
  orden,
  ubicacion,
  codActividad,
  descActividad,
}: {
  tipoDte: string;
  orden: OrdenRow;
  ubicacion: { departamento_cod?: string; municipio_cod?: string };
  codActividad?: string | null;
  descActividad?: string | null;
}) => {
  let receptor: Record<string, unknown>;

  if (tipoDte === '01') {
    const tipoDoc = ((orden.tipo_documento as string) || '').toLowerCase();
    receptor = {
      nombre: orden.cliente_nombre
        ? `${orden.cliente_nombre}${orden.cliente_apellido ? ' ' + orden.cliente_apellido : ''}`
        : 'Consumidor Final',
      tipo_documento: MAPA_TIPO_DOC[tipoDoc] || '37',
      num_documento: (orden.numero_documento as string) || '000000',
    };
  } else if (tipoDte === '03') {
    receptor = {
      nit: orden.cliente_nit,
      nrc: orden.cliente_nrc || null,
      nombre: (orden.cliente_nombre as string) || 'Consumidor Final',
      cod_actividad: codActividad || null,
      desc_actividad: descActividad || null,
    };
  } else {
    receptor = {
      nit: orden.cliente_nit,
      nombre: (orden.cliente_nombre as string) || 'Sujeto Excluido',
    };
  }

  if (orden.cliente_telefono) receptor.telefono = orden.cliente_telefono;
  if (orden.cliente_email) receptor.correo = orden.cliente_email;
  if (orden.cliente_direccion) receptor.direccion = orden.cliente_direccion;

  return { ...receptor, ...ubicacion };
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
type SucursalFiscalRow = {
  id: string;
  branch_id: string | null;
  dte_establecimiento_id: string | null;
  fiscal_status: string;
  activo: boolean;
};

const toCents = (value: unknown): number => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount < 0) {
    throw { status: 400, mensaje: 'La orden contiene un monto monetario inválido.' };
  }
  return Math.round(amount * 100);
};

const obtenerOrdenCompleta = async (tenantId: string, ordenId: string) => {
  const { rows: ordenes } = await query(
    `SELECT o.*, c.nombre AS cliente_nombre, c.apellido AS cliente_apellido,
            c.tipo_documento, c.numero_documento,
            c.nit AS cliente_nit, c.nrc AS cliente_nrc,
            c.razon_social,
            c.cod_actividad AS cliente_cod_actividad,
            c.desc_actividad AS cliente_desc_actividad,
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
    .map((item) => {
      const subtotal = Number(item.subtotal) || 0;
      const descuentoManual = subtotal * (Number(item.descuento_porcentaje) || 0) / 100;
      const descuento = Number(item.descuento_promo) + descuentoManual;
      return {
        descripcion: (item.producto_nombre as string) || (item.descripcion as string) || 'Producto',
        precio_unitario: Number(item.precio_unitario) || 0,
cantidad: Number(item.cantidad) || 1,
        descuento: Math.round(descuento * 100) / 100,
        codigo: (item.producto_codigo as string) || null,
        tipo_item: 1,
        uni_medida: 99,
      };
    });
};

// Fase 5 — construir los pagos fiscales (CAT-007). La propina y el vuelto
// son importes operativos y no forman parte de los pagos del DTE.
const construirPagosMH = (pagos: PagoRow[], totalFiscalCents: number) => {
  const pagosMH: Array<{ codigo: string; montoPago: number; referencia?: string | null }> = [];
  let restanteFiscalCents = totalFiscalCents;
  for (const pago of pagos) {
    const metodo = (pago.metodo as string) || 'efectivo';
    const codigoMH = MAPA_METODO_MH[metodo] || '99';
    const montoRecibidoCents = toCents(pago.total_pagado);
    const vueltoCents = toCents(pago.vuelto);
    const disponibleCents = Math.max(0, montoRecibidoCents - vueltoCents);
    const montoFiscalCents = Math.min(restanteFiscalCents, disponibleCents);

    if (metodo === 'mixto') {
      const efectivoCents = Math.min(toCents(pago.monto_efectivo), montoFiscalCents);
      const tarjetaCents = Math.min(toCents(pago.monto_tarjeta), montoFiscalCents - efectivoCents);
      if (efectivoCents > 0) pagosMH.push({ codigo: '01', montoPago: efectivoCents / 100 });
      if (tarjetaCents > 0) pagosMH.push({ codigo: '03', montoPago: tarjetaCents / 100 });
    } else {
      const ref = (pago.referencia_tarjeta as string)
        || (pago.referencia_transferencia as string)
        || (pago.hash_bitcoin as string)
        || (pago.referencia_cheque as string)
        || null;
      if (montoFiscalCents > 0) {
        pagosMH.push({ codigo: codigoMH, montoPago: montoFiscalCents / 100, referencia: ref });
      }
    }
    restanteFiscalCents -= montoFiscalCents;
  }

  if (restanteFiscalCents !== 0) {
    throw {
      status: 400,
      mensaje: 'La suma de pagos fiscales no coincide con el total del DTE.',
    };
  }

  return pagosMH;
};

// Fase 5 — construir el payload base de emisión POS → DTE.
// El POS resuelve la sucursal activa al establecimiento DTE y lo transporta
// junto con branch_id (spec §9). Los códigos MH del tenant ya NO se envían:
// DTE los trata solo como verificación, nunca como fuente de selección.
export const construirPayloadEmitir = ({
  ordenId,
  orden,
  items,
  pagos,
  sucursalFiscal,
  tipoDte,
}: {
  ordenId: string;
  orden: OrdenRow;
  items: ItemRow[];
  pagos: PagoRow[];
  sucursalFiscal: SucursalFiscalRow;
  tipoDte: string;
}) => {
  const totalFiscalCents = toCents(orden.total);
  const cuerpoItems = mapearItems(items);
  const pagosMH = construirPagosMH(pagos, totalFiscalCents);

  const payloadBase: Record<string, unknown> = {
    items: cuerpoItems,
    pagos: pagosMH,
    metodo_pago: pagosMH.length > 1 ? 'mixto' : pagosMH[0]?.codigo === '03' ? 'tarjeta' : 'efectivo',
    orden_referencia: orden.numero_orden?.toString() || null,
    establecimiento_id: sucursalFiscal.dte_establecimiento_id,
    // `branch_id` es el vínculo operativo histórico del POS y es OPCIONAL: las
    // sucursales creadas en el DTE Service pueden no tenerlo. Se omite en vez
    // de enviar `null` (el DTE solo lo usa como verificación si viene).
    ...(sucursalFiscal.branch_id ? { branch_id: sucursalFiscal.branch_id } : {}),
    // Fase 3 — clave idempotente: tenant + orden + tipo. Los reintentos
    // reutilizan el mismo DTE en el dte-service (sin nuevo correlativo).
    idempotency_key: `${ordenId}:${tipoDte}`,
  };

  return { payloadBase, totalFiscalCents, cuerpoItems };
};

/**
 * F5 — resolución del contexto fiscal de la emisión.
 *
 * Orden:
 * 1. La sucursal de la orden (`establecimiento_id` canónico o `branch_id`).
 * 2. Si no resuelve (orden sin sucursal o con un id retirado) el
 *    establecimiento PREDETERMINADO del tenant (la matriz fiscal del DTE): el
 *    cobro ya está hecho y la facturación no se puede bloquear.
 * 3. Sin establecimiento disponible → 409 explícito.
 * 4. Con establecimiento: solo se exige lo que el DTE exige para emitir
 *    (`activo` + `fiscal_status = ready`). `branch_id` NO es requisito.
 *
 * Se expone como factory para las pruebas unitarias; el uso normal es la
 * instancia `obtenerContextoFiscalSucursal`.
 */
export const crearResolverContextoFiscal = (
  dependencias: {
    resolverEstablecimiento?: (
      tenantId: string,
      referencia: string
    ) => Promise<ContextoFiscalEstablecimiento | null>;
    resolverPredeterminado?: (
      tenantId: string
    ) => Promise<ContextoFiscalEstablecimiento | null>;
  } = {}
) => {
  const resolverEstablecimiento =
    dependencias.resolverEstablecimiento ??
    ((tenantId: string, referencia: string) =>
      servicioEmpresaDte.resolverEstablecimientoFiscal(tenantId, referencia));
  const resolverPredeterminado =
    dependencias.resolverPredeterminado ??
    ((tenantId: string) => servicioEmpresaDte.resolverEstablecimientoFiscalPredeterminado(tenantId));

  return async (tenantId: string, orden: OrdenRow): Promise<SucursalFiscalRow> => {
    const referencia = orden.sucursal_id as string | null | undefined;
    const contextoBase = {
      tenant_id: tenantId,
      sucursal_id: referencia || null,
    };

    // F3 — el POS ya no lee la tabla local `sucursales`: resuelve el
    // establecimiento contra el DTE (fuente de verdad). Acepta el
    // `establecimiento_id` canónico o el `branch_id` (que es lo que el POS
    // histórico persiste en `sucursal_id`).
    let establecimiento = referencia
      ? await resolverEstablecimiento(tenantId, referencia)
      : null;

    if (referencia && !establecimiento) {
      logger.warn('La sucursal de la orden no es un establecimiento del DTE — se evalúa el predeterminado', contextoBase);
    }

    // F5 — resiliencia de emisión: las órdenes nacidas durante la transición
    // (o creadas por un usuario sin sucursal asignada) quedaron con
    // `sucursal_id` NULL; y las históricas pueden traer un id local ya
    // retirado. En ambos casos el cobro YA está hecho y no se puede bloquear la
    // facturación: se emite con el establecimiento PREDETERMINADO del tenant
    // (la matriz fiscal del DTE). La elección se registra para trazabilidad.
    if (!establecimiento) {
      establecimiento = await resolverPredeterminado(tenantId);
      if (establecimiento) {
        logger.warn('Emisión DTE con el establecimiento predeterminado de la empresa', {
          ...contextoBase,
          dte_establecimiento_id: establecimiento.dte_establecimiento_id,
          branch_id: establecimiento.branch_id,
        });
      }
    }

    if (!establecimiento) {
      logger.warn('Emisión DTE bloqueada: no hay establecimiento fiscal disponible', contextoBase);
      throw {
        status: 409,
        mensaje: referencia
          ? 'La sucursal de la orden no corresponde a un establecimiento del DTE de la empresa.'
          : 'La orden no tiene una sucursal operativa y la empresa no tiene establecimientos en el DTE.',
      };
    }

    const contextoFiscal = {
      ...contextoBase,
      branch_id: establecimiento.branch_id,
      dte_establecimiento_id: establecimiento.dte_establecimiento_id,
      fiscal_status: establecimiento.fiscal_status,
      sucursal_activa: establecimiento.activo,
    };

    // F5/F6 — la autoridad fiscal es el DTE: un establecimiento puede emitir
    // cuando está `activo` y su `fiscal_status` es `ready`. `branch_id` es SOLO
    // el vínculo operativo histórico con el POS y puede no existir: las
    // sucursales creadas directamente en el DTE Service (Frontend DTE) nacen
    // sin `branch_id` y son 100% emitibles (el generador del DTE solo exige
    // `fiscal_status = ready` + `activo`). Exigirlo acá bloqueaba la emisión de
    // empresas con establecimientos perfectamente listos (regresión reportada
    // el 2026-10-17: «La sucursal no tiene un vínculo fiscal DTE confirmado y
    // listo para emitir», con la sucursal `ready` en el DTE).
    const motivoBloqueo = !establecimiento.dte_establecimiento_id
      ? 'no tiene identificador de establecimiento en el DTE'
      : !establecimiento.activo
        ? 'está inactiva en el DTE'
        : establecimiento.fiscal_status !== 'ready'
          ? `no está lista para emitir (estado fiscal: ${establecimiento.fiscal_status || 'sin_estado'})`
          : null;

    if (motivoBloqueo) {
      logger.warn('Emisión DTE bloqueada: vínculo fiscal no está listo', {
        ...contextoFiscal,
        motivo: motivoBloqueo,
      });
      throw {
        status: 409,
        mensaje: `La sucursal «${establecimiento.nombre}» ${motivoBloqueo}. Revisala en el DTE Service antes de emitir.`,
      };
    }

    logger.info('Contexto fiscal resuelto para emisión DTE (desde el DTE)', contextoFiscal);
    return {
      id: establecimiento.id,
      branch_id: establecimiento.branch_id,
      dte_establecimiento_id: establecimiento.dte_establecimiento_id,
      fiscal_status: establecimiento.fiscal_status,
      activo: establecimiento.activo,
    };
  };
};

const obtenerContextoFiscalSucursal = crearResolverContextoFiscal();

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

const sucursalFiscal = await obtenerContextoFiscalSucursal(tenantId, orden);

  const { payloadBase, totalFiscalCents, cuerpoItems } = construirPayloadEmitir({
    ordenId,
    orden,
    items,
    pagos,
    sucursalFiscal,
    tipoDte,
  });

  // F5/F6 — receptor del DTE.
  //
  // FCF (01): el receptor puede ir sin datos; el POS manda "Consumidor Final"
  // cuando la orden no tiene cliente. CCF (03) y FSE (14) exigen NIT.
  // El CCF exige además la actividad económica del receptor (esquema oficial:
  // codActividad/descActividad obligatorios, mínimo 5 caracteres).
  if (tipoDte === '03') {
    if (!orden.cliente_id || !orden.cliente_nit) {
      throw { status: 400, mensaje: 'CCF requiere un cliente con NIT registrado.' };
    }
  } else if (tipoDte !== '01' && (!orden.cliente_id || !orden.cliente_nit)) {
    throw { status: 400, mensaje: 'FSE requiere un cliente con NIT registrado.' };
  }

  const codActividad = (orden.cliente_cod_actividad as string | null) || null;
  const descActividad = (orden.cliente_desc_actividad as string | null) || null;

  if (tipoDte === '03') {
    if ((codActividad || '').trim().length < 5 || (descActividad || '').trim().length < 5) {
      throw {
        status: 400,
        mensaje: 'El CCF requiere que el cliente tenga código y descripción de actividad económica (mínimo 5 caracteres). Completalos en el cliente antes de emitir.',
      };
    }
    // El esquema oficial del CCF exige la ubicación fiscal del receptor
    // (direccion como objeto). Sin departamento/municipio no se emite: se
    // evita el 422 críptico del DTE con un mensaje accionable.
    if (!orden.departamento || !orden.municipio) {
      throw {
        status: 400,
        mensaje: 'El CCF requiere la ubicación fiscal del cliente (departamento y municipio). Completala en el cliente antes de emitir.',
      };
    }
  }

  const receptor = construirReceptorFiscal({
    tipoDte,
    orden,
    ubicacion: await resolverUbicacionReceptor(orden),
    codActividad,
    descActividad,
  });

  const payload: Record<string, unknown> = { ...payloadBase, receptor };

  const endpoint = ENDPOINTS[tipoDte];

  // SEGURIDAD: nunca transportar ni persistir credenciales del certificado.
  const payloadSeguro = limpiarPayloadSecreto(payload);

  logger.info('Emitiendo DTE desde POS', {
    ordenId,
    tipoDte,
    endpoint,
    items: cuerpoItems.length,
    totalFiscal: totalFiscalCents / 100,
    tenant_id: tenantId,
    sucursal_id: sucursalFiscal.id,
    branch_id: sucursalFiscal.branch_id,
    dte_establecimiento_id: sucursalFiscal.dte_establecimiento_id,
    fiscal_status: sucursalFiscal.fiscal_status,
  });

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
      `INSERT INTO dtes_orden (orden_id, tenant_id, tipo_dte, codigo_generacion, numero_control, estado, json_envio, json_respuesta, branch_id, dte_establecimiento_id, creado_en)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (tenant_id, orden_id, tipo_dte) DO UPDATE
       SET codigo_generacion = EXCLUDED.codigo_generacion,
           numero_control = EXCLUDED.numero_control,
           estado = EXCLUDED.estado,
           json_respuesta = EXCLUDED.json_respuesta,
           branch_id = EXCLUDED.branch_id,
           dte_establecimiento_id = EXCLUDED.dte_establecimiento_id,
           actualizado_en = NOW()`,
      [
        ordenId, tenantId, tipoDte,
        resultado.codigo_generacion || null, resultado.numero_control || null,
        estadoFiscal,
        JSON.stringify(payloadSeguro), JSON.stringify(resultado),
        sucursalFiscal.branch_id, sucursalFiscal.dte_establecimiento_id,
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
