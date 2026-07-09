import Joi from 'joi';

export const actualizarComboSchema = Joi.object({
  nombre: Joi.string().min(2).max(100).optional(),
  precio: Joi.number().precision(2).min(0).optional(),
  activo: Joi.boolean().optional(),
  productos: Joi.array()
    .items(Joi.object({
      producto_id: Joi.string().uuid().required(),
      cantidad: Joi.number().integer().min(1).default(1),
    }))
    .min(1)
    .optional(),
}).min(1);

export type ActualizarComboBody = {
  nombre?: string;
  precio?: number;
  activo?: boolean;
  productos?: { producto_id: string; cantidad: number }[];
};
