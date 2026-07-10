import Joi from 'joi';

export const actualizarMenuSchema = Joi.object({
  titulo: Joi.string().min(2).max(100).optional(),
  icono: Joi.string().max(50).optional().allow('', null),
  ruta: Joi.string().max(200).optional().allow('', null),
  parent_id: Joi.string().uuid().optional().allow(null),
  orden: Joi.number().integer().min(0).optional(),
  permiso_codigo: Joi.string().max(100).optional().allow('', null),
  activo: Joi.boolean().optional(),
}).min(1);

export type ActualizarMenuBody = {
  titulo?: string;
  icono?: string | null;
  ruta?: string | null;
  parent_id?: string | null;
  orden?: number;
  permiso_codigo?: string | null;
  activo?: boolean;
};
