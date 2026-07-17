import { query } from '../../../shared/config/database.js';

type Filtros = {
  pagina: number;
  limite: number;
  estado?: string;
  tipo_dte?: string;
  desde?: string;
  hasta?: string;
};

export const listar = async ({ tenantId, filtros }: { tenantId: string; filtros: Filtros }) => {
  const condiciones = ['tenant_id = $1'];
  const valores: unknown[] = [tenantId];
  let idx = 2;

  if (filtros.estado) {
    condiciones.push(`estado = $${idx++}`);
    valores.push(filtros.estado);
  }
  if (filtros.tipo_dte) {
    condiciones.push(`tipo_dte = $${idx++}`);
    valores.push(filtros.tipo_dte);
  }
  if (filtros.desde) {
    condiciones.push(`creado_en >= $${idx++}`);
    valores.push(filtros.desde);
  }
  if (filtros.hasta) {
    condiciones.push(`creado_en <= $${idx++}`);
    valores.push(filtros.hasta);
  }

  const offset = (filtros.pagina - 1) * filtros.limite;

  const { rows: totalRows } = await query(
    `SELECT COUNT(*) AS total FROM dtes_orden WHERE ${condiciones.join(' AND ')}`,
    valores
  );
  const total = parseInt((totalRows[0] as { total: string }).total, 10);

  const { rows } = await query(
    `SELECT * FROM dtes_orden
     WHERE ${condiciones.join(' AND ')}
     ORDER BY creado_en DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...valores, filtros.limite, offset]
  );

  return {
    data: rows,
    total,
    pagina: filtros.pagina,
    limite: filtros.limite,
    paginas: Math.ceil(total / filtros.limite),
  };
};
