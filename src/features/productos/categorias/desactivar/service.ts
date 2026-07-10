import { query } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { esCategoriaHoja } from '../../shared.js';
import { obtenerCategoria } from '../obtener/service.js';

export const desactivarCategoria = async ({ tenantId, categoriaId }: { tenantId: string; categoriaId: string }) => {
  await obtenerCategoria({ tenantId, categoriaId });

  const esHoja = await esCategoriaHoja({ tenantId, categoriaId });
  if (!esHoja) {
    throw { status: 400, mensaje: 'No se puede desactivar una categoría que tiene subcategorías. Desactive o reasigne las subcategorías primero.' };
  }

  await query(
    'UPDATE categorias SET activo = FALSE WHERE id = $1 AND tenant_id = $2',
    [categoriaId, tenantId]
  );

  logger.info('Categoría desactivada', { categoria_id: categoriaId });
};
