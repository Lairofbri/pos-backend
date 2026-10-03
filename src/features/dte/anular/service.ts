import { query } from '../../../shared/config/database.js';
import { obtenerClientePorTenant } from '../../../shared/dte-client.js';
import { logger } from '../../../shared/utils/logger.js';
import { limpiarPayloadSecreto } from '../payload-seguro.js';

/**
 * Factory del servicio de anulación DTE (Fase 5).
 * Acepta dependencias inyectables para unit tests (db fake, cliente DTE fake).
 * El módulo exporta una instancia por defecto (uso normal) y la factory.
 *
 * Fase 5 — conserva el establecimiento original del DTE:
 * 1) Se lee de `dtes_orden` (persistido al emitir, migración 073).
 * 2) Filas históricas (pre-Fase 5): se resuelve desde la sucursal de la orden.
 * 3) Si no se resuelve, se anula sin acotar (el DTE Service valida por
 *    codigo_generacion + tenant y lo resuelve del propio DTE).
 * El establecimiento se envía al DTE Service como parámetro (spec §9); el
 * POS nunca transporta códigos MH del tenant.
 */
const crearServicioAnularDte = (dependencias: {
  db?: { query: typeof query };
  obtenerCliente?: typeof obtenerClientePorTenant;
} = {}) => {
  const db = dependencias.db || { query };
  const obtenerCliente = dependencias.obtenerCliente || obtenerClientePorTenant;

  const resolverEstablecimientoOriginal = async (
    tenantId: string,
    codigoGeneracion: string
  ): Promise<string | null> => {
    const { rows: dtesRows } = await db.query(
      `SELECT orden_id, dte_establecimiento_id
       FROM dtes_orden
       WHERE codigo_generacion = $1 AND tenant_id = $2
       LIMIT 1`,
      [codigoGeneracion, tenantId]
    );

    const dte = dtesRows[0] as { orden_id?: string | null; dte_establecimiento_id?: string | null } | undefined;
    if (dte?.dte_establecimiento_id) return dte.dte_establecimiento_id;

    if (dte?.orden_id) {
      const { rows: ordenRows } = await db.query(
        `SELECT s.dte_establecimiento_id
         FROM ordenes o
         JOIN sucursales s ON s.id = o.sucursal_id AND s.tenant_id = o.tenant_id
         WHERE o.id = $1 AND o.tenant_id = $2
         LIMIT 1`,
        [dte.orden_id, tenantId]
      );
      const establecimientoId = (ordenRows[0] as { dte_establecimiento_id?: string | null } | undefined)
        ?.dte_establecimiento_id;
      if (establecimientoId) return establecimientoId;
    }

    return null;
  };

  const anular = async ({ tenantId, usuarioId: _usuarioId, datos }: { tenantId: string; usuarioId: string; datos: Record<string, unknown> }) => {
    const codigoGeneracion = datos.codigo_generacion as string;
    const establecimientoId = await resolverEstablecimientoOriginal(tenantId, codigoGeneracion);

    // SEGURIDAD: el POS no transporta credenciales del certificado.
    const payload = limpiarPayloadSecreto({
      codigo_generacion: codigoGeneracion,
      tipo_dte: datos.tipo_dte,
      // Fase 5 — acota la anulación al establecimiento original si se resolvió.
      ...(establecimientoId ? { establecimiento_id: establecimientoId } : {}),
      motivo_tipo: datos.motivo_tipo,
      motivo_descripcion: datos.motivo_descripcion,
      nombre_responsable: datos.nombre_responsable,
      tipo_doc_responsable: datos.tipo_doc_responsable,
      num_doc_responsable: datos.num_doc_responsable,
    });

    logger.info('Anulando DTE desde POS', {
      codigo_generacion: codigoGeneracion,
      tenant_id: tenantId,
      establecimiento_id: establecimientoId,
    });

    const cliente = await obtenerCliente(tenantId);
    await cliente.post('/api/dte/anular', payload);

    await db.query(
      `UPDATE dtes_orden
       SET estado = 'anulado'
       WHERE codigo_generacion = $1 AND tenant_id = $2`,
      [codigoGeneracion, tenantId]
    );

    return { codigo_generacion: codigoGeneracion, estado: 'anulado' };
  };

  return { anular };
};

export const anular = crearServicioAnularDte().anular;
export const crearServicioAnularDteFactory = crearServicioAnularDte;