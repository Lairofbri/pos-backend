import { query } from '../../../shared/config/database.js';
import { obtenerClientePorTenant } from '../../../shared/dte-client.js';
import { logger } from '../../../shared/utils/logger.js';

export const anular = async ({ tenantId, usuarioId, datos }: { tenantId: string; usuarioId: string; datos: Record<string, unknown> }) => {
  const payload = {
    codigo_generacion: datos.codigo_generacion,
    tipo_dte: datos.tipo_dte,
    motivo_tipo: datos.motivo_tipo,
    motivo_descripcion: datos.motivo_descripcion,
    nombre_responsable: datos.nombre_responsable,
    tipo_doc_responsable: datos.tipo_doc_responsable,
    num_doc_responsable: datos.num_doc_responsable,
    password_pri: datos.password_pri,
  };

  logger.info('Anulando DTE desde POS', { codigo_generacion: datos.codigo_generacion });

  const cliente = await obtenerClientePorTenant(tenantId);
  const resp = await cliente.post('/api/dte/anular', payload);
  const resultado = resp as unknown as Record<string, unknown>;

  await query(
    `UPDATE dtes_orden
     SET estado = 'anulado'
     WHERE codigo_generacion = $1 AND tenant_id = $2`,
    [datos.codigo_generacion, tenantId]
  );

  return { codigo_generacion: datos.codigo_generacion, estado: 'anulado' };
};
