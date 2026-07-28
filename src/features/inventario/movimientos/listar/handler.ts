import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { esUuidValido } from '../../../../shared/middlewares/uuid.middleware.js';
import { listarMovimientos } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado en inventario', { error: (err as Error).message, stack: (err as Error).stack });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  const pagina = req.query.pagina ? Number(req.query.pagina) : 1;
  const limite = req.query.limite ? Number(req.query.limite) : 20;

  if (req.query.pagina && (!Number.isInteger(pagina) || pagina < 1)) {
    return error(res, 'El parámetro pagina debe ser un número entero positivo.', 400);
  }
  if (req.query.limite && (!Number.isInteger(limite) || limite < 1)) {
    return error(res, 'El parámetro limite debe ser un número entero positivo.', 400);
  }
  if (req.query.producto_id && !esUuidValido(req.query.producto_id)) {
    return error(res, 'El parámetro producto_id no tiene un formato UUID válido.', 400);
  }

  const tiposValidos = ['compra', 'ajuste', 'merma', 'devolucion', 'consumo'];
  if (req.query.tipo && !tiposValidos.includes(req.query.tipo as string)) {
    return error(res, `El parámetro tipo debe ser uno de: ${tiposValidos.join(', ')}.`, 400);
  }

  try {
    const resultado = await listarMovimientos({
      tenantId: req.usuario!.tenant_id,
      filtros: {
        producto_id: req.query.producto_id as string | undefined,
        tipo: req.query.tipo as string | undefined,
        desde: req.query.desde as string | undefined,
        hasta: req.query.hasta as string | undefined,
        pagina,
        limite,
      },
    });
    return exito(res, resultado);
  } catch (err) {
    return manejarError(res, err);
  }
};
