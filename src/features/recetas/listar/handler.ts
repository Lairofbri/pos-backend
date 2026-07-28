import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { esUuidValido } from '../../../shared/middlewares/uuid.middleware.js';
import { listarRecetas } from './service.js';

export const handler = async (req: Request, res: Response) => {
  const pagina = req.query.pagina ? Number(req.query.pagina) : 1;
  const limite = req.query.limite ? Number(req.query.limite) : 20;

  if (req.query.pagina && (!Number.isInteger(pagina) || pagina < 1)) {
    return error(res, 'El parámetro pagina debe ser un número entero positivo.', 400);
  }
  if (req.query.limite && (!Number.isInteger(limite) || limite < 1)) {
    return error(res, 'El parámetro limite debe ser un número entero positivo.', 400);
  }
  if (req.query.categoria_id && !esUuidValido(req.query.categoria_id)) {
    return error(res, 'El parámetro categoria_id no tiene un formato UUID válido.', 400);
  }

  try {
    const resultado = await listarRecetas({
      tenantId: req.usuario!.tenant_id,
      filtros: {
        categoria_id: req.query.categoria_id as string | undefined,
        busqueda: req.query.busqueda as string | undefined,
        pagina,
        limite,
      },
    });
    return exito(res, resultado);
  } catch (err) {
    logger.error('Error al listar recetas', { error: (err as Error).message });
    return errorServidor(res);
  }
};
