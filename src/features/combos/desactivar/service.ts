import { query } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';
import { obtenerCombo } from '../obtener/service.js';

export const desactivarCombo = async ({ tenantId, comboId }: { tenantId: string; comboId: string }) => {
  await obtenerCombo({ tenantId, comboId });

  await query(
    'UPDATE combos SET activo = FALSE WHERE id = $1 AND tenant_id = $2',
    [comboId, tenantId]
  );

  logger.info('Combo desactivado', { combo_id: comboId });
};
