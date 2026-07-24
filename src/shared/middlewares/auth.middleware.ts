import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { query } from '../config/database.js';
import { noAutenticado } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export const autenticar = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  const authHeader = req.headers['authorization'];

  if (apiKey) {
    return autenticarApiKey(req, res, next);
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return noAutenticado(res);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & {
      sub: string;
      tenant_id: string;
      rol: string;
      nombre: string;
      email: string;
      sucursal_id?: string;
      establecimiento_id?: string;
    };

    req.authMode = 'jwt';
    req.usuario = {
      id: decoded.sub,
      tenant_id: decoded.tenant_id,
      rol: decoded.rol,
      nombre: decoded.nombre,
      email: decoded.email,
      sucursal_id: decoded.sucursal_id ?? '',
      establecimiento_id: decoded.establecimiento_id || null,
    };

    next();
  } catch (err) {
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      return noAutenticado(res, 'Sesión expirada. Por favor inicia sesión nuevamente.');
    }
    return noAutenticado(res, 'Token inválido.');
  }
};

const autenticarApiKey = async (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  const tenantId = req.headers['x-tenant-id'] as string | undefined;

  try {
    let hashValido: string | null = null;
    let tenantEncontrado: string | null = null;

    if (tenantId) {
      const { rows } = await query(
        'SELECT id, api_key_hash FROM tenants WHERE id = $1 AND activo = TRUE',
        [tenantId]
      );
      if (rows.length > 0 && (rows[0] as Record<string, unknown>).api_key_hash) {
        hashValido = (rows[0] as Record<string, unknown>).api_key_hash as string;
        tenantEncontrado = (rows[0] as Record<string, unknown>).id as string;
      }
    }

    if (!hashValido) {
      logger.warn('API Key sin hash válido', { ip: req.ip, ruta: req.path });
      return noAutenticado(res, 'API Key inválida.');
    }

    const valida = await bcrypt.compare(apiKey, hashValido);
    if (!valida) {
      logger.warn('API Key inválida', { ip: req.ip, ruta: req.path });
      return noAutenticado(res, 'API Key inválida.');
    }

    req.authMode = 'apikey';
    req.usuario = {
      id: '',
      tenant_id: tenantEncontrado || '',
      nombre: 'API',
      email: '',
      rol: 'admin',
      sucursal_id: '',
      establecimiento_id: null,
    };

    next();
  } catch (err) {
    logger.error('Error al verificar API Key', { error: (err as Error).message });
    return noAutenticado(res, 'Error al verificar credenciales.');
  }
};
