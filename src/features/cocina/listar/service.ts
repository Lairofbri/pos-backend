import { query } from '../../../shared/config/database.js';

type ItemRow = {
  id: string;
  orden_id: string;
  producto_id: string | null;
  nombre_producto: string;
  cantidad: number;
  subtotal: number;
  estado: string;
  notas: string | null;
  enviado_en: string;
  creado_en: string;
  combo_id: string | null;
  combo_nombre: string | null;
  numero_orden: number;
  tipo: string;
  origen: string;
  mesa_numero: number | null;
  mesa_nombre: string | null;
  enviado_por_nombre: string | null;
  orden_estado: string;
};

type OrdenAgrupada = {
  orden_id: string;
  numero_orden: number;
  tipo: string;
  origen: string;
  mesa_numero: number | null;
  mesa_nombre: string | null;
  orden_estado: string;
  items: {
    id: string;
    producto_id: string | null;
    nombre_producto: string;
    cantidad: number;
    estado: string;
    notas: string | null;
    combo_id: string | null;
    combo_nombre: string | null;
    enviado_en: string;
    enviado_por_nombre: string | null;
    creado_en: string;
  }[];
};

export const listarItemsActivos = async ({ tenantId, soloPendientes = false, sucursalId }: { tenantId: string; soloPendientes?: boolean; sucursalId?: string }) => {
  const estados = soloPendientes ? ["'en_proceso'"] : ["'en_proceso'", "'listo'"];

  const valores: unknown[] = [tenantId];
  let idx = 2;
  let sucursalCondicion = '';
  if (sucursalId) {
    sucursalCondicion = ` AND o.sucursal_id = $${idx++}`;
    valores.push(sucursalId);
  }

  const { rows } = await query(
    `SELECT
        oi.id, oi.orden_id, oi.producto_id, oi.nombre_producto,
        oi.cantidad, oi.subtotal, oi.estado, oi.notas,
        oi.enviado_en, oi.creado_en, oi.combo_id,
        (SELECT c.nombre FROM combos c WHERE c.id = oi.combo_id) AS combo_nombre,
        o.estado AS orden_estado, o.numero_orden, o.tipo, o.origen,
       m.numero AS mesa_numero, m.nombre AS mesa_nombre,
       u.nombre AS enviado_por_nombre
     FROM orden_items oi
     JOIN ordenes o ON o.id = oi.orden_id
     LEFT JOIN mesas m ON m.id = o.mesa_id
     LEFT JOIN usuarios u ON u.id = oi.enviado_por
      WHERE oi.tenant_id = $1
        AND oi.estado IN (${estados})
        AND o.estado NOT IN ('pagada', 'cancelada', 'entregada')
        ${sucursalCondicion}
     ORDER BY
       oi.estado ASC,
       oi.enviado_en ASC NULLS LAST,
       o.mesa_id ASC`,
    valores
  );

  const items = rows as unknown as ItemRow[];
  const ordenes: Record<string, OrdenAgrupada> = {};

  for (const item of items) {
    const key = item.orden_id;
    if (!ordenes[key]) {
      ordenes[key] = {
        orden_id: item.orden_id,
        numero_orden: item.numero_orden,
        tipo: item.tipo,
        origen: item.origen,
        orden_estado: item.orden_estado,
        mesa_numero: item.mesa_numero,
        mesa_nombre: item.mesa_nombre,
        items: [],
      };
    }
    ordenes[key].items.push({
      id: item.id,
      producto_id: item.producto_id,
      nombre_producto: item.nombre_producto,
      cantidad: item.cantidad,
      estado: item.estado,
      notas: item.notas,
      combo_id: item.combo_id,
      combo_nombre: item.combo_nombre,
      enviado_en: item.enviado_en,
      enviado_por_nombre: item.enviado_por_nombre,
      creado_en: item.creado_en,
    });
  }

  return Object.values(ordenes).sort((a, b) =>
    a.items[0].enviado_en > b.items[0].enviado_en ? 1 : -1
  );
};
