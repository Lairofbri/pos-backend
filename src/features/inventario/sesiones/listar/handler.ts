import type { Request, Response } from 'express';
import { exito, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { listarSesiones } from './service.js';

export const handler = async (req: Request, res: Response) => {
  try {
    const { sucursal_id, estado, pagina, limite } = req.query;
    const resultado = await listarSesiones({
      tenantId: req.usuario!.tenant_id,
      filtros: {
        sucursal_id: sucursal_id as string | undefined,
        estado: estado as string | undefined,
        pagina: pagina ? parseInt(pagina as string) : undefined,
        limite: limite ? parseInt(limite as string) : undefined,
      },
    });
    return exito(res, resultado, `Sesiones de inventario — ${resultado.paginacion.total} encontradas.`);
  } catch (err) {
    logger.error('Error al listar sesiones', { error: (err as Error).message });
    return errorServidor(res);
  }
};
