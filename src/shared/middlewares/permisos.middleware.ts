import type { Request, Response, NextFunction } from 'express';
import { query } from '../config/database.js';
import { sinPermiso } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export const requierePermiso = (...codigos: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario) {
      return sinPermiso(res, 'No autenticado.');
    }

    if (req.usuario.rol === 'administrador') {
      return next();
    }

    try {
      for (const codigo of codigos) {
        const { rows } = await query(
          'SELECT fn_tiene_permiso($1, $2, $3) AS tiene',
          [req.usuario.rol, codigo, req.usuario.tenant_id]
        );
        if ((rows[0] as { tiene?: boolean })?.tiene) {
          return next();
        }
      }

      return sinPermiso(res, 'No tienes permiso para realizar esta acción.');
    } catch (err) {
      logger.error('Error verificando permisos', {
        error: err instanceof Error ? err.message : String(err),
        usuario_id: req.usuario.id,
        rol: req.usuario.rol,
        permisos_requeridos: codigos,
      });
      return sinPermiso(res, 'Error al verificar permisos.');
    }
  };
};
