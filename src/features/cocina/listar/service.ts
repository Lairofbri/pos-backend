import { query } from '../../../shared/config/database.js';

type ItemRow = {
  id: string;
  orden_id: string;
  producto_id: string;
  nombre_producto: string;
  cantidad: number;
  subtotal: number;
  estado: string;
  notas: string | null;
  enviado_en: string;
  creado_en: string;
  numero_orden: number;
  tipo: string;
  origen: string;
  mesa_numero: number | null;
  mesa_nombre: string | null;
  enviado_por_nombre: string | null;
};

type OrdenAgrupada = {
  orden_id: string;
  numero_orden: number;
  tipo: string;
  origen: string;
  mesa_numero: number | null;
  mesa_nombre: string | null;
  items: {
    id: string;
    producto_id: string;
    nombre_producto: string;
    cantidad: number;
    estado: string;
    notas: string | null;
    enviado_en: string;
    enviado_por_nombre: string | null;
    creado_en: string;
  }[];
};

export const listarItemsActivos = async ({ tenantId, soloPendientes = false }: { tenantId: string; soloPendientes?: boolean }) => {
  const estados = soloPendientes ? ["'en_proceso'"] : ["'en_proceso'", "'listo'"];

  const { rows } = await query(
    `SELECT
       oi.id, oi.orden_id, oi.producto_id, oi.nombre_producto,
       oi.cantidad, oi.subtotal, oi.estado, oi.notas,
       oi.enviado_en, oi.creado_en,
       o.numero_orden, o.tipo, o.origen,
       m.numero AS mesa_numero, m.nombre AS mesa_nombre,
       u.nombre AS enviado_por_nombre
     FROM orden_items oi
     JOIN ordenes o ON o.id = oi.orden_id
     LEFT JOIN mesas m ON m.id = o.mesa_id
     LEFT JOIN usuarios u ON u.id = oi.enviado_por
     WHERE oi.tenant_id = $1
       AND oi.estado IN (${estados})
     ORDER BY
       oi.estado ASC,
       oi.enviado_en ASC NULLS LAST,
       o.mesa_id ASC`,
    [tenantId]
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
      enviado_en: item.enviado_en,
      enviado_por_nombre: item.enviado_por_nombre,
      creado_en: item.creado_en,
    });
  }

  return Object.values(ordenes).sort((a, b) =>
    a.items[0].enviado_en > b.items[0].enviado_en ? 1 : -1
  );
};
