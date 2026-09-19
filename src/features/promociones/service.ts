import { query, getClient } from '../../shared/config/database.js';
import { logger } from '../../shared/utils/logger.js';

interface DatosPromocion {
  nombre?: string;
  tipo?: string;
  descuento_porcentaje?: number | null;
  volumen_minimo?: number | null;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  dias?: number[] | null;
  vigente_desde?: string | null;
  vigente_hasta?: string | null;
  activo?: boolean;
  productos?: string[];
}

const validarReglasPromocion = (datos: DatosPromocion) => {
  const tipo = datos.tipo;
  if (!tipo) return;

  if (tipo === 'dosxuno' && datos.descuento_porcentaje != null) {
    throw { status: 400, mensaje: 'La promoción dosxuno no admite descuento_porcentaje.' };
  }
  if (tipo !== 'dosxuno' && datos.descuento_porcentaje == null) {
    throw { status: 400, mensaje: `La promoción ${tipo} requiere descuento_porcentaje.` };
  }
  if (tipo === 'volumen' && (!datos.volumen_minimo || datos.volumen_minimo < 1)) {
    throw { status: 400, mensaje: 'La promoción volumen requiere volumen_minimo.' };
  }
  if (tipo === 'happy_hour' && (!datos.hora_inicio || !datos.hora_fin)) {
    throw { status: 400, mensaje: 'La promoción happy_hour requiere hora_inicio y hora_fin.' };
  }
  if ((datos.hora_inicio && !datos.hora_fin) || (!datos.hora_inicio && datos.hora_fin)) {
    throw { status: 400, mensaje: 'hora_inicio y hora_fin deben enviarse juntas.' };
  }
};

const validarProductosTenant = async (client: Awaited<ReturnType<typeof getClient>>, tenantId: string, productos: string[] = []) => {
  const ids = [...new Set(productos)];
  if (ids.length === 0) return;

  const { rows } = await client.query(
    'SELECT id FROM productos WHERE tenant_id = $1 AND id = ANY($2::uuid[])',
    [tenantId, ids]
  );
  if (rows.length !== ids.length) {
    throw { status: 400, mensaje: 'Una o más promociones referencian productos de otro tenant o inexistentes.' };
  }
};

const SELECT_PROMO = `
  SELECT pr.*,
    COALESCE(
      (SELECT json_agg(pp2.producto_id) FROM promocion_productos pp2 WHERE pp2.promo_id = pr.id),
      '[]'::json
    ) AS productos
  FROM promociones pr`;

export const listarPromociones = async ({ tenantId }: { tenantId: string }) => {
  const { rows } = await query(
    `${SELECT_PROMO} WHERE pr.tenant_id = $1 ORDER BY pr.creado_en DESC`,
    [tenantId]
  );
  return rows;
};

export const obtenerPromocion = async ({ tenantId, promoId }: { tenantId: string; promoId: string }) => {
  const { rows } = await query(
    `${SELECT_PROMO} WHERE pr.id = $1 AND pr.tenant_id = $2`,
    [promoId, tenantId]
  );
  if (rows.length === 0) throw { status: 404, mensaje: 'Promoción no encontrada.' };
  return rows[0];
};

export const listarPromocionesActivas = async ({ tenantId }: { tenantId: string }) => {
  const { rows } = await query(
    `SELECT id, nombre, tipo, descuento_porcentaje, volumen_minimo, hora_inicio, hora_fin, dias,
            vigente_desde, vigente_hasta,
            COALESCE((SELECT json_agg(pp.producto_id) FROM promocion_productos pp WHERE pp.promo_id = promociones.id), '[]'::json) AS productos
     FROM promociones
     WHERE tenant_id = $1 AND activo = TRUE`,
    [tenantId]
  );
  return rows;
};

export const crearPromocion = async ({ tenantId, datos }: { tenantId: string; datos: DatosPromocion }) => {
  validarReglasPromocion(datos);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await validarProductosTenant(client, tenantId, datos.productos);
    const { rows } = await client.query(
      `INSERT INTO promociones
         (tenant_id, nombre, tipo, descuento_porcentaje, volumen_minimo, hora_inicio, hora_fin, dias, vigente_desde, vigente_hasta, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        tenantId,
        datos.nombre,
        datos.tipo,
        datos.descuento_porcentaje ?? null,
        datos.volumen_minimo ?? null,
        datos.hora_inicio || null,
        datos.hora_fin || null,
        datos.dias && datos.dias.length ? datos.dias : null,
        datos.vigente_desde || null,
        datos.vigente_hasta || null,
        datos.activo ?? true,
      ]
    );
    const promo = rows[0];
    if (datos.productos?.length) {
      for (const productoId of datos.productos) {
        await client.query(
          'INSERT INTO promocion_productos (promo_id, producto_id, tenant_id) VALUES ($1, $2, $3)',
          [promo.id, productoId, tenantId]
        );
      }
    }
    promo.productos = datos.productos || [];
    await client.query('COMMIT');
    logger.info('Promoción creada', { promo_id: promo.id, tenant_id: tenantId });
    return promo;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const actualizarPromocion = async ({ tenantId, promoId, datos }: { tenantId: string; promoId: string; datos: DatosPromocion }) => {
  const actual = await obtenerPromocion({ tenantId, promoId });
  validarReglasPromocion({
    ...actual,
    ...datos,
    productos: datos.productos ?? actual.productos,
  });

  const campos: string[] = [];
  const valores: unknown[] = [];
  let idx = 1;

  if (datos.nombre !== undefined) { campos.push(`nombre = $${idx++}`); valores.push(datos.nombre); }
  if (datos.tipo !== undefined) { campos.push(`tipo = $${idx++}`); valores.push(datos.tipo); }
  if (datos.descuento_porcentaje !== undefined) { campos.push(`descuento_porcentaje = $${idx++}`); valores.push(datos.descuento_porcentaje ?? null); }
  if (datos.volumen_minimo !== undefined) { campos.push(`volumen_minimo = $${idx++}`); valores.push(datos.volumen_minimo ?? null); }
  if (datos.hora_inicio !== undefined) { campos.push(`hora_inicio = $${idx++}`); valores.push(datos.hora_inicio || null); }
  if (datos.hora_fin !== undefined) { campos.push(`hora_fin = $${idx++}`); valores.push(datos.hora_fin || null); }
  if (datos.dias !== undefined) { campos.push(`dias = $${idx++}`); valores.push(datos.dias && datos.dias.length ? datos.dias : null); }
  if (datos.vigente_desde !== undefined) { campos.push(`vigente_desde = $${idx++}`); valores.push(datos.vigente_desde || null); }
  if (datos.vigente_hasta !== undefined) { campos.push(`vigente_hasta = $${idx++}`); valores.push(datos.vigente_hasta || null); }
  if (datos.activo !== undefined) { campos.push(`activo = $${idx++}`); valores.push(datos.activo); }
  campos.push(`actualizado_en = NOW()`);

  if (campos.length > 0 || "productos" in datos) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      await validarProductosTenant(client, tenantId, datos.productos ?? (actual.productos as string[]));
      if (campos.length > 0) {
        valores.push(promoId, tenantId);
        await client.query(
          `UPDATE promociones SET ${campos.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx}`,
          valores
        );
      }
      if (datos.productos !== undefined) {
        await client.query('DELETE FROM promocion_productos WHERE promo_id = $1', [promoId]);
        if (datos.productos.length) {
          for (const productoId of datos.productos) {
            await client.query(
              'INSERT INTO promocion_productos (promo_id, producto_id, tenant_id) VALUES ($1, $2, $3)',
              [promoId, productoId, tenantId]
            );
          }
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  logger.info('Promoción actualizada', { promo_id: promoId, tenant_id: tenantId });
  return obtenerPromocion({ tenantId, promoId });
};

export const desactivarPromocion = async ({ tenantId, promoId }: { tenantId: string; promoId: string }) => {
  await obtenerPromocion({ tenantId, promoId });
  const { rows } = await query(
    `UPDATE promociones SET activo = FALSE, actualizado_en = NOW()
     WHERE id = $1 AND tenant_id = $2 RETURNING *`,
    [promoId, tenantId]
  );
  return rows[0];
};

export const reportePromociones = async ({ tenantId, desde, hasta }: { tenantId: string; desde?: string; hasta?: string }) => {
  const condiciones = ['o.tenant_id = $1', "o.estado IN ('pagada')", 'oi.descuento_promo > 0'];
  const valores: unknown[] = [tenantId];
  let idx = 2;
  if (desde) { condiciones.push(`o.cerrado_en >= $${idx++}`); valores.push(desde); }
  if (hasta) { condiciones.push(`o.cerrado_en <= $${idx++}`); valores.push(hasta); }

  const { rows } = await query(
    `SELECT pr.id, pr.nombre, pr.tipo,
            COUNT(DISTINCT o.id)::INTEGER AS ventas,
            COUNT(*)::INTEGER AS lineas,
            COALESCE(SUM(oi.descuento_promo), 0) AS total_descontado
     FROM ordenes o
     JOIN orden_items oi ON oi.orden_id = o.id AND oi.estado <> 'cancelado'
     JOIN promocion_productos pp ON pp.producto_id = oi.producto_id AND pp.tenant_id = o.tenant_id
     JOIN promociones pr ON pr.id = pp.promo_id AND pr.tenant_id = o.tenant_id
     WHERE ${condiciones.join(' AND ')}
     GROUP BY pr.id, pr.nombre, pr.tipo
     ORDER BY total_descontado DESC`,
    valores
  );
  return rows;
};
