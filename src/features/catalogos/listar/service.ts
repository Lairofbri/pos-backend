import { query } from '../../../shared/config/database.js';

export const obtenerCatalogos = async ({ tenantId, depto }: { tenantId: string; depto?: string }) => {
  const { rows: roles } = await query(
    'SELECT unnest(fn_roles_validos()) AS valor'
  );

  const rolesArr = roles.map((r: { valor: string }) => ({
    valor: (r as { valor: string }).valor,
    label: r.valor.charAt(0).toUpperCase() + r.valor.slice(1),
  }));

  const { rows } = await query('SELECT fn_catalogos($1) AS data', [tenantId]);
  const catalogos = (rows[0] as { data?: Record<string, unknown> })?.data || {};

  const { rows: unidadesRows } = await query(
    'SELECT id, nombre, abreviatura, categoria, factor FROM unidades_medida WHERE tenant_id = $1 AND activo = TRUE ORDER BY categoria, nombre',
    [tenantId]
  );

  const { rows: departamentos } = await query(
    'SELECT codigo AS valor, nombre AS label FROM departamentos ORDER BY codigo'
  );

  let municipios: unknown[] = [];
  if (depto) {
    const { rows: munis } = await query(
      'SELECT codigo AS valor, nombre AS label FROM municipios WHERE departamento_cod = $1 ORDER BY nombre',
      [depto]
    );
    municipios = munis;
  } else {
    const { rows: munis } = await query(
      'SELECT m.codigo AS valor, m.nombre AS label, m.departamento_cod AS depto FROM municipios m ORDER BY m.departamento_cod, m.nombre'
    );
    municipios = munis;
  }

  const { rows: sectores } = await query(
    'SELECT codigo AS valor, nombre AS label FROM sectores_economicos ORDER BY codigo'
  );

  return {
    roles: rolesArr,
    tipos_documento: (catalogos.tipos_documento as unknown[]) || [],
    metodos_pago: (catalogos.metodos_pago as unknown[]) || [],
    movimientos_tipo: (catalogos.movimientos_tipo as unknown[]) || [],
    origenes_orden: (catalogos.origenes_orden as unknown[]) || [],
    unidades_medida: unidadesRows,
    departamentos,
    municipios,
    sectores_economicos: sectores,
  };
};
