import { query } from '../../../shared/config/database.js';

type OrdenRow = {
  numero_orden: number;
  tipo: string;
  notas: string | null;
  creado_en: string;
  mesa_numero: number | null;
  usuario_nombre: string | null;
};

type ItemRow = {
  nombre_producto: string;
  cantidad: number;
  notas: string | null;
  estado: string;
  enviado_en: string;
};

export const getTicketTexto = async ({ tenantId, ordenId }: { tenantId: string; ordenId: string }) => {
  const { rows: ordenRows } = await query(
    `SELECT o.numero_orden, o.tipo, o.notas, o.creado_en,
            m.numero AS mesa_numero,
            u.nombre AS usuario_nombre
     FROM ordenes o
     LEFT JOIN mesas m ON m.id = o.mesa_id
     LEFT JOIN usuarios u ON u.id = o.usuario_id
     WHERE o.id = $1 AND o.tenant_id = $2`,
    [ordenId, tenantId]
  );

  if (ordenRows.length === 0) {
    throw { status: 404, mensaje: 'Orden no encontrada.' };
  }

  const orden = ordenRows[0] as unknown as OrdenRow;

  const { rows: items } = await query(
    `SELECT nombre_producto, cantidad, notas, estado, enviado_en
     FROM orden_items
     WHERE orden_id = $1 AND tenant_id = $2
       AND estado IN ('en_proceso', 'listo')
     ORDER BY creado_en ASC`,
    [ordenId, tenantId]
  );

  const itemRows = items as unknown as ItemRow[];
  const ahora = new Date();
  const hora = ahora.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });
  const fecha = ahora.toLocaleDateString('es-SV');

  const ticket: string[] = [];
  ticket.push('╔══════════════════════════╗');
  ticket.push('║      COMANDAS COCINA     ║');
  ticket.push('╚══════════════════════════╝');
  ticket.push('');
  ticket.push(`Fecha: ${fecha}  ${hora}`);
  ticket.push(`Orden #${orden.numero_orden}`);
  ticket.push(`Mesa: ${orden.mesa_numero ?? 'Para llevar'}`);
  ticket.push(`Tipo: ${orden.tipo}`);
  ticket.push(`Mesero: ${orden.usuario_nombre ?? '-'}`);
  ticket.push('────────────────────────────');

  for (const item of itemRows) {
    ticket.push('');
    ticket.push(`  ${item.cantidad}x  ${item.nombre_producto}`);
    if (item.notas) {
      ticket.push(`       └─ ${item.notas}`);
    }
  }

  ticket.push('');
  ticket.push('────────────────────────────');
  ticket.push('Notas:');
  ticket.push(`  ${orden.notas ?? '(sin notas)'}`);
  ticket.push('');
  ticket.push('════════════════════════════');
  ticket.push('');

  return ticket.join('\n');
};
