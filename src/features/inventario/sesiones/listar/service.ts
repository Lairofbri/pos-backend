import { query } from '../../../../shared/config/database.js';

export const listarSesiones = async ({
  tenantId,
  filtros = {},
}: {
  tenantId: string;
  filtros?: {
    sucursal_id?: string;
    estado?: string;
    pagina?: number;
    limite?: number;
  };
}) => {
  const {
    sucursal_id,
    estado,
    pagina = 1,
    limite = 20,
  } = filtros;

  const condiciones = ['s.tenant_id = $1'];
  const valores: unknown[] = [tenantId];
  let idx = 2;

  if (sucursal_id) {
    condiciones.push(`s.sucursal_id = $${idx++}`);
    valores.push(sucursal_id);
  }

  if (estado) {
    condiciones.push(`s.estado = $${idx++}`);
    valores.push(estado);
  }

  const offset = (pagina - 1) * limite;

  const { rows } = await query(
    `SELECT
       s.id, s.sucursal_id, su.nombre AS sucursal_nombre,
       s.estado, s.notas, s.stock_snapshot, s.creado_en, s.cerrado_en,
       u.nombre AS creado_por_nombre,
       COUNT(c.id)::int AS productos_contados,
       jsonb_array_length(s.stock_snapshot::jsonb)::int AS total_productos_con_stock
     FROM inventario_sesiones s
     LEFT JOIN sucursales su ON su.id = s.sucursal_id
     LEFT JOIN usuarios u ON u.id = s.creado_por
     LEFT JOIN inventario_conteos c ON c.sesion_id = s.id
     WHERE ${condiciones.join(' AND ')}
     GROUP BY s.id, su.nombre, u.nombre
     ORDER BY s.creado_en DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    [...valores, limite, offset]
  );

  const { rows: conteo } = await query(
    `SELECT COUNT(*) as total
     FROM inventario_sesiones s
     WHERE ${condiciones.join(' AND ')}`,
    valores
  );

  return {
    sesiones: rows,
    paginacion: {
      total: parseInt((conteo[0] as { total: string }).total),
      pagina,
      limite,
      paginas: Math.ceil(parseInt((conteo[0] as { total: string }).total) / limite),
    },
  };
};
