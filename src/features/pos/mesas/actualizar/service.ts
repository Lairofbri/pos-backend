import { query } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { obtenerMesaShared } from '../../shared.js';

export const actualizarMesa = async ({ tenantId, mesaId, datos }: { tenantId: string; mesaId: string; datos: Record<string, unknown> }) => {
  await obtenerMesaShared({ tenantId, mesaId });

  const campos: string[] = [];
  const valores: unknown[] = [];
  let idx = 1;

  const d = datos as {
    numero?: string;
    nombre?: string;
    capacidad?: number;
    activo?: boolean;
    estado?: string;
  };

  if (d.numero !== undefined) { campos.push(`numero = $${idx++}`); valores.push(d.numero); }
  if (d.nombre !== undefined) { campos.push(`nombre = $${idx++}`); valores.push(d.nombre); }
  if (d.capacidad !== undefined) { campos.push(`capacidad = $${idx++}`); valores.push(d.capacidad); }
  if (d.activo !== undefined) { campos.push(`activo = $${idx++}`); valores.push(d.activo); }
  if (d.estado !== undefined) { campos.push(`estado = $${idx++}`); valores.push(d.estado); }

  valores.push(mesaId, tenantId);

  const { rows } = await query(
    `UPDATE mesas SET ${campos.join(', ')}
     WHERE id = $${idx++} AND tenant_id = $${idx}
     RETURNING id, numero, nombre, capacidad, estado, activo`,
    valores
  );

  logger.info('Mesa actualizada', { mesa_id: mesaId });
  return rows[0];
};
