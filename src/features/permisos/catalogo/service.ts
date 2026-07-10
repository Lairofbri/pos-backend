import { query } from '../../../shared/config/database.js';

type PermisoRow = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  grupo: string;
};

export const listarCatalogo = async () => {
  const { rows } = await query(
    `SELECT id, codigo, nombre, descripcion, modulo AS grupo
     FROM permisos
     ORDER BY modulo, codigo`
  );
  return rows as unknown as PermisoRow[];
};
