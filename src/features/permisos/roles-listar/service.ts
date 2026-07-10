import { query } from '../../../shared/config/database.js';

export const listarRoles = async () => {
  const { rows } = await query('SELECT unnest(fn_roles_validos()) AS rol');
  return (rows as { rol: string }[]).map(r => r.rol);
};
