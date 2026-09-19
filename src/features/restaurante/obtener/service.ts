import { query } from '../../../shared/config/database.js';

export const obtenerRestaurante = async ({ tenantId }: { tenantId: string }) => {
  const { rows } = await query(
    `SELECT id, nombre, nit, nrc, direccion, telefono, email, logo_url, plan, pos_default_mode
     FROM tenants
     WHERE id = $1`,
    [tenantId]
  );

  if (rows.length === 0) {
    throw { status: 404, mensaje: 'Restaurante no encontrado.' };
  }

  return rows[0];
};
