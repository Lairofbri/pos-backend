import { query } from '../../../shared/config/database.js';
import { enriquecerComponentes, listarComponentesCombo, resumenCombo } from '../shared.js';

type ComboRow = {
  id: string;
  nombre: string;
  precio: number;
  activo: boolean;
  creado_en: string;
};

export const obtenerCombo = async ({ tenantId, comboId }: { tenantId: string; comboId: string }) => {
  const { rows } = await query(
    'SELECT id, nombre, precio, activo, creado_en FROM combos WHERE id = $1 AND tenant_id = $2',
    [comboId, tenantId]
  );

  if (rows.length === 0) {
    throw { status: 404, mensaje: 'Combo no encontrado.' };
  }

  const combo = rows[0] as unknown as ComboRow;
  const componentes = await listarComponentesCombo({ tenantId, comboId });
  const productos = await enriquecerComponentes({ tenantId, componentes });

  const resumen = resumenCombo(productos);

  return { ...combo, productos, ...resumen };
};
