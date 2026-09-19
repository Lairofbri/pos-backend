import { query } from '../../../shared/config/database.js';
import { enriquecerComponentes, listarComponentesCombo, resumenCombo } from '../shared.js';

type ComboRow = {
  id: string;
  nombre: string;
  precio: number;
  activo: boolean;
  creado_en: string;
};

export const listarCombos = async ({ tenantId, soloActivos = true }: { tenantId: string; soloActivos?: boolean }) => {
  const condicion = soloActivos
    ? 'WHERE c.tenant_id = $1 AND c.activo = TRUE'
    : 'WHERE c.tenant_id = $1';

  const { rows } = await query(
    `SELECT c.id, c.nombre, c.precio, c.activo, c.creado_en
     FROM combos c
     ${condicion}
     ORDER BY c.nombre ASC`,
    [tenantId]
  );

  const combos = rows as unknown as ComboRow[];

  for (const combo of combos) {
    const componentes = await listarComponentesCombo({ tenantId, comboId: combo.id });
    const productos = await enriquecerComponentes({ tenantId, componentes });
    const resumen = resumenCombo(productos);

    Object.assign(combo, { productos, ...resumen });
  }

  return combos;
};
