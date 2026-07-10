import { query } from '../../../shared/config/database.js';

export const obtenerCatalogos = async ({ tenantId }: { tenantId: string }) => {
  const { rows: roles } = await query(
    'SELECT unnest(fn_roles_validos()) AS valor'
  );

  const rolesArr = roles.map((r: { valor: string }) => ({
    valor: (r as { valor: string }).valor,
    label: r.valor.charAt(0).toUpperCase() + r.valor.slice(1),
  }));

  const { rows } = await query('SELECT fn_catalogos($1) AS data', [tenantId]);
  const catalogos = (rows[0] as { data?: Record<string, unknown> })?.data || {};

  return {
    zonas: (catalogos.zonas as unknown[]) || [],
    roles: rolesArr,
    tipos_documento: (catalogos.tipos_documento as unknown[]) || [],
    metodos_pago: (catalogos.metodos_pago as unknown[]) || [],
    movimientos_tipo: (catalogos.movimientos_tipo as unknown[]) || [],
    origenes_orden: (catalogos.origenes_orden as unknown[]) || [],
  };
};
