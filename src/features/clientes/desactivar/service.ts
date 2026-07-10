import { query } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';
import { obtenerCliente } from '../obtener/service.js';

export const desactivarCliente = async ({ tenantId, clienteId }: { tenantId: string; clienteId: string }) => {
  await obtenerCliente({ tenantId, clienteId });

  await query(
    'UPDATE clientes SET activo = FALSE WHERE id = $1 AND tenant_id = $2',
    [clienteId, tenantId]
  );

  logger.info('Cliente desactivado', { cliente_id: clienteId });
};
