/* eslint-disable @typescript-eslint/no-explicit-any */
import { query } from '../../../../shared/config/database.js';

export const listarCategorias = async ({ tenantId, soloActivas = true }: { tenantId: string; soloActivas?: boolean }) => {
  const condicion = soloActivas
    ? 'WHERE tenant_id = $1 AND activo = TRUE'
    : 'WHERE tenant_id = $1';

  const { rows } = await query(
    `SELECT id, parent_id, nombre, descripcion, orden, icono, color, activo, creado_en
     FROM categorias
     ${condicion}
     ORDER BY orden ASC, nombre ASC`,
    [tenantId]
  );
  return rows;
};

export const listarArbolCategorias = async ({ tenantId, soloActivas = true }: { tenantId: string; soloActivas?: boolean }) => {
  const condicion = soloActivas ? 'FALSE' : 'TRUE';

  const { rows } = await query(
    `WITH RECURSIVE arbol AS (
       SELECT id, parent_id, nombre, descripcion, orden, icono, color, activo, creado_en, 0 AS nivel
       FROM categorias
       WHERE tenant_id = $1 AND parent_id IS NULL AND (${condicion} OR activo = TRUE)
       UNION ALL
       SELECT c.id, c.parent_id, c.nombre, c.descripcion, c.orden, c.icono, c.color, c.activo, c.creado_en, a.nivel + 1
       FROM categorias c
       JOIN arbol a ON c.parent_id = a.id
       WHERE c.tenant_id = $1 AND (${condicion} OR c.activo = TRUE) AND a.nivel < 3
     )
     SELECT id, parent_id, nombre, descripcion, orden, icono, color, activo, creado_en, nivel
     FROM arbol
     ORDER BY nivel, orden ASC, nombre ASC`,
    [tenantId]
  );

  const mapa: Record<string, any> = {};
  for (const c of rows as any[]) {
    c.hijos = [];
    mapa[c.id] = c;
  }

  const arbol: any[] = [];
  for (const c of rows as any[]) {
    if (c.parent_id && mapa[c.parent_id]) {
      mapa[c.parent_id].hijos.push(c);
    } else if (!c.parent_id) {
      arbol.push(c);
    }
  }

  return arbol;
};
