import { query } from '../../../shared/config/database.js';

type PermisoRow = {
  modulo: string;
};

export const obtenerPermisosRol = async ({ tenantId, rol }: { tenantId: string; rol: string }) => {
  const { rows } = await query('SELECT * FROM fn_permisos_rol($1, $2)', [rol, tenantId]);

  const agruparPorModulo = (permisos: PermisoRow[]) => {
    const modulos: Record<string, unknown[]> = {};
    for (const p of permisos) {
      if (!modulos[p.modulo]) modulos[p.modulo] = [];
      modulos[p.modulo].push(p);
    }
    return Object.entries(modulos).map(([modulo, permisos]) => ({ modulo, permisos }));
  };

  return agruparPorModulo(rows as unknown as PermisoRow[]);
};
