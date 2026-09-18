import type { PoolClient } from 'pg';

type PromoRow = {
  id: string;
  nombre: string;
  tipo: 'porcentaje' | 'dosxuno' | 'volumen' | 'happy_hour';
  descuento_porcentaje: string | number | null;
  volumen_minimo: number | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  dias: number[] | null;
  vigente_desde: string | null;
  vigente_hasta: string | null;
  productos: string[] | null;
};

type ItemRow = {
  id: string;
  producto_id: string | null;
  cantidad: string | number;
  precio_unitario: string | number;
};

export const aplicarPromocionesOrden = async (
  client: PoolClient,
  tenantId: string,
  ordenId: string
) => {
  const { rows } = await client.query(
    `SELECT
       pr.id, pr.nombre, pr.tipo, pr.descuento_porcentaje, pr.volumen_minimo,
       pr.hora_inicio, pr.hora_fin, pr.dias, pr.vigente_desde, pr.vigente_hasta,
       CASE WHEN COUNT(pp.id) = 0 THEN NULL
            ELSE (SELECT json_agg(x.producto_id) FROM (SELECT pp2.producto_id FROM promocion_productos pp2 WHERE pp2.promo_id = pr.id) x)
       END AS productos
     FROM promociones pr
     LEFT JOIN promocion_productos pp ON pp.promo_id = pr.id
     WHERE pr.tenant_id = $1 AND pr.activo = TRUE
     GROUP BY pr.id`,
    [tenantId]
  );

  const ahora = new Date();
  const diaSemana = ahora.getDay();
  const horaActual = ahora.getHours() * 60 + ahora.getMinutes();

  const toMin = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const activas = (rows as PromoRow[]).filter((pr) => {
    if (pr.vigente_desde && ahora < new Date(pr.vigente_desde)) return false;
    if (pr.vigente_hasta && ahora > new Date(pr.vigente_hasta)) return false;
    if (pr.dias && pr.dias.length > 0 && !pr.dias.includes(diaSemana)) return false;
    if (pr.hora_inicio && pr.hora_fin) {
      const start = toMin(pr.hora_inicio);
      const end = toMin(pr.hora_fin);
      if (start <= end) {
        if (horaActual < start || horaActual > end) return false;
      } else if (horaActual < start && horaActual > end) {
        return false;
      }
    }
    return true;
  });

  if (activas.length === 0) {
    await client.query(
      'UPDATE orden_items SET descuento_promo = 0 WHERE orden_id = $1',
      [ordenId]
    );
    await client.query(
      "UPDATE ordenes SET promociones_aplicadas = '[]'::jsonb WHERE id = $1",
      [ordenId]
    );
    return [];
  }

  const { rows: items } = await client.query(
    `SELECT id, producto_id, cantidad, precio_unitario
     FROM orden_items
     WHERE orden_id = $1 AND estado <> 'cancelado' AND producto_id IS NOT NULL`,
    [ordenId]
  );

  const redondear2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const aplicadasMap = new Map<string, { promo_id: string; nombre: string; tipo: string; monto: number }>();

  for (const item of items as ItemRow[]) {
    const productoId = item.producto_id as string;
    const cantidad = Number(item.cantidad) || 0;
    const precioUnitario = Number(item.precio_unitario) || 0;
    const base = precioUnitario * cantidad;

    let mejor = 0;
    let mejorInfo: { promo_id: string; nombre: string; tipo: string } | null = null;

    for (const pr of activas) {
      const scope = pr.productos;
      if (scope && scope.length > 0 && !scope.includes(productoId)) continue;

      let desc = 0;
      if (pr.tipo === 'dosxuno') {
        const gratis = Math.floor(cantidad / 2);
        if (gratis > 0) desc = gratis * precioUnitario;
      } else {
        const min = pr.tipo === 'volumen' ? Number(pr.volumen_minimo || 2) : Number(pr.volumen_minimo || 0);
        if (cantidad < min) continue;
        const pct = Number(pr.descuento_porcentaje || 0) / 100;
        desc = base * pct;
      }
      desc = Math.min(desc, base);
      if (desc > mejor) {
        mejor = redondear2(desc);
        mejorInfo = { promo_id: pr.id, nombre: pr.nombre, tipo: pr.tipo };
      }
    }

    if (mejor > 0) {
      await client.query(
        'UPDATE orden_items SET descuento_promo = $1 WHERE id = $2',
        [mejor, item.id]
      );
      if (mejorInfo) {
        const existente = aplicadasMap.get(mejorInfo.promo_id);
        aplicadasMap.set(mejorInfo.promo_id, {
          ...mejorInfo,
          monto: redondear2((existente?.monto || 0) + mejor),
        });
      }
    } else {
      await client.query(
        'UPDATE orden_items SET descuento_promo = 0 WHERE id = $1',
        [item.id]
      );
    }
  }

  const aplicadas = [...aplicadasMap.values()];
  await client.query(
    'UPDATE ordenes SET promociones_aplicadas = $1 WHERE id = $2',
    [JSON.stringify(aplicadas), ordenId]
  );

  return aplicadas;
};
