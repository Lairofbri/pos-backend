import Joi from 'joi';

export const listarDTESchema = Joi.object({
  pagina: Joi.number().integer().min(1).optional().default(1),
  limite: Joi.number().integer().min(1).max(100).optional().default(20),
  estado: Joi.string().valid('emitido', 'anulado', 'rechazado').optional(),
  tipo_dte: Joi.string().valid('01', '03', '14').optional(),
  desde: Joi.date().iso().optional(),
  hasta: Joi.date().iso().optional(),
});

export type ListarDTEFiltros = {
  pagina: number;
  limite: number;
  estado?: string;
  tipo_dte?: string;
  desde?: string;
  hasta?: string;
};
