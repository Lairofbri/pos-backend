import { query, getClient } from '../../shared/config/database.js';
import { obtenerCajaAbierta } from '../caja/shared.js';
import { listarRentabilidad } from '../productos/rentabilidad/service.js';
import { obtenerEvolucion } from '../productos/rentabilidad/evolucion.service.js';

export interface Alerta {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  titulo: string;
  descripcion: string;
  accion?: { label: string; ruta: string };
  desde: string;
}

export interface AlertaConfig {
  tendencia_caida_pct: number;
  silencio_desde: string | null;
  silencio_hasta: string | null;
  cooldown_minutos: number;
}

export interface AlertaHistorialRow {
  alerta_id: string;
  estado: string;
  primera_deteccion: string;
  ultima_deteccion: string;
  veces_detectada: number;
  ultimo_titulo: string | null;
  ultima_descripcion: string | null;
  ultima_severidad: string | null;
}

const PESO_SEVERIDAD: Record<Alerta['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const soloFecha = (d: Date) => d.toISOString().slice(0, 10);

const CONFIG_DEFAULT: AlertaConfig = {
  tendencia_caida_pct: 10,
  silencio_desde: null,
  silencio_hasta: null,
  cooldown_minutos: 120,
};

export const obtenerConfigAlertas = async ({ tenantId }: { tenantId: string }): Promise<AlertaConfig> => {
  const { rows } = await query(
    `SELECT tendencia_caida_pct, silencio_desde, silencio_hasta, cooldown_minutos
     FROM alertas_config WHERE tenant_id = $1`,
    [tenantId]
  );
  const row = rows[0] as Partial<AlertaConfig> | undefined;
  if (!row) {
    await query(
      `INSERT INTO alertas_config (tenant_id) VALUES ($1)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId]
    );
    return { ...CONFIG_DEFAULT };
  }
  return {
    tendencia_caida_pct: Number(row.tendencia_caida_pct),
    silencio_desde: row.silencio_desde ? String(row.silencio_desde).slice(0, 5) : null,
    silencio_hasta: row.silencio_hasta ? String(row.silencio_hasta).slice(0, 5) : null,
    cooldown_minutos: Number(row.cooldown_minutos),
  };
};

export const guardarConfigAlertas = async ({
  tenantId,
  datos,
}: {
  tenantId: string;
  datos: Partial<AlertaConfig>;
}): Promise<AlertaConfig> => {
  await query(
    `INSERT INTO alertas_config (tenant_id, tendencia_caida_pct, silencio_desde, silencio_hasta, cooldown_minutos)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tenant_id) DO UPDATE SET
       tendencia_caida_pct = EXCLUDED.tendencia_caida_pct,
       silencio_desde = EXCLUDED.silencio_desde,
       silencio_hasta = EXCLUDED.silencio_hasta,
       cooldown_minutos = EXCLUDED.cooldown_minutos,
       actualizado_en = NOW()`,
    [
      tenantId,
      datos.tendencia_caida_pct ?? CONFIG_DEFAULT.tendencia_caida_pct,
      datos.silencio_desde || null,
      datos.silencio_hasta || null,
      datos.cooldown_minutos ?? CONFIG_DEFAULT.cooldown_minutos,
    ]
  );
  return obtenerConfigAlertas({ tenantId });
};

export const enHorarioSilencioso = (config: AlertaConfig, ahora = new Date()): boolean => {
  if (!config.silencio_desde || !config.silencio_hasta) return false;
  const minutos = ahora.getHours() * 60 + ahora.getMinutes();
  const [hd, md] = config.silencio_desde.split(':').map(Number);
  const [hh, mh] = config.silencio_hasta.split(':').map(Number);
  const desde = hd * 60 + md;
  const hasta = hh * 60 + mh;
  if (desde === hasta) return false;
  if (desde < hasta) return minutos >= desde && minutos < hasta;
  return minutos >= desde || minutos < hasta;
};

const calcularAlertasActuales = async ({
  tenantId,
  sucursalId,
  config,
}: {
  tenantId: string;
  sucursalId?: string | null;
  config: AlertaConfig;
}): Promise<Alerta[]> => {
  const alertas: Alerta[] = [];

  const { rows: stockRows } = await query(
    `SELECT COUNT(*)::INTEGER AS cantidad
     FROM productos
     WHERE tenant_id = $1 AND tiene_stock = TRUE AND stock_actual < stock_minimo`,
    [tenantId]
  );
  const stockBajo = (stockRows[0] as { cantidad: number }).cantidad;
  if (stockBajo > 0) {
    alertas.push({
      id: 'stock-bajo',
      severity: 'critical',
      titulo: 'Stock bajo de ingredientes',
      descripcion: `${stockBajo} producto${stockBajo > 1 ? 's tienen' : ' tiene'} stock por debajo del mínimo.`,
      accion: { label: 'Ver inventario', ruta: '/admin/inventario' },
      desde: new Date().toISOString(),
    });
  }

  const { productos } = await listarRentabilidad({ tenantId });
  const enPerdida = productos.filter((p) => p.alerta === 'perdida');
  if (enPerdida.length > 0) {
    alertas.push({
      id: 'rentabilidad-perdida',
      severity: 'warning',
      titulo: 'Productos en pérdida',
      descripcion: `${enPerdida.length} producto${enPerdida.length > 1 ? 's generan' : ' genera'} margen negativo. Revisa costos.`,
      accion: { label: 'Ver rentabilidad', ruta: '/admin/rentabilidad' },
      desde: new Date().toISOString(),
    });
  }

  const hace7d = new Date();
  hace7d.setDate(hace7d.getDate() - 7);
  const evolucion = await obtenerEvolucion({
    tenantId,
    filtros: { desde: soloFecha(hace7d), hasta: soloFecha(new Date()) },
  });
  if (evolucion.length >= 3) {
    const [d1, d2, d3] = evolucion.slice(-3);
    const bajando = d1.ingresos > d2.ingresos && d2.ingresos > d3.ingresos;
    if (bajando && d1.ingresos > 0) {
      const pct = ((d1.ingresos - d3.ingresos) / d1.ingresos) * 100;
      const umbral = config.tendencia_caida_pct;
      if (pct >= umbral) {
        alertas.push({
          id: 'tendencia-bajando',
          severity: 'warning',
          titulo: 'Ventas en descenso',
          descripcion: `Los ingresos cayeron un ${pct.toFixed(0)}% en los últimos 3 días.`,
          desde: new Date().toISOString(),
        });
      }
    }
  }

  const caja = await obtenerCajaAbierta({ tenantId, sucursalId });
  if (!caja) {
    alertas.push({
      id: 'caja-cerrada',
      severity: 'info',
      titulo: 'Caja cerrada',
      descripcion: 'No hay caja abierta. Abre una caja para comenzar a operar.',
      accion: { label: 'Ir a caja', ruta: '/admin/caja' },
      desde: new Date().toISOString(),
    });
  }

  return alertas.sort((a, b) => PESO_SEVERIDAD[a.severity] - PESO_SEVERIDAD[b.severity]);
};

export const obtenerAlertas = async ({
  tenantId,
  sucursalId = null,
}: {
  tenantId: string;
  sucursalId?: string | null;
}): Promise<Alerta[]> => {
  const config = await obtenerConfigAlertas({ tenantId });
  const actuales = await calcularAlertasActuales({ tenantId, sucursalId, config });

  const client = await getClient();
  try {
    await client.query('BEGIN');

    for (const a of actuales) {
      await client.query(
        `INSERT INTO alertas_estado
           (tenant_id, alerta_id, estado, ultimo_titulo, ultima_descripcion, ultima_severidad, ultima_accion)
         VALUES ($1, $2, 'activa', $3, $4, $5, $6)
         ON CONFLICT (tenant_id, alerta_id) DO UPDATE SET
           ultima_deteccion = NOW(),
           veces_detectada = alertas_estado.veces_detectada + 1,
           ultimo_titulo = EXCLUDED.ultimo_titulo,
           ultima_descripcion = EXCLUDED.ultima_descripcion,
           ultima_severidad = EXCLUDED.ultima_severidad,
           ultima_accion = EXCLUDED.ultima_accion,
           estado = CASE
             WHEN alertas_estado.estado = 'resuelta'
              AND alertas_estado.silenciada_hasta IS NOT NULL
              AND alertas_estado.silenciada_hasta > NOW()
             THEN 'resuelta'
             ELSE 'activa'
           END,
           silenciada_hasta = CASE
             WHEN alertas_estado.estado = 'resuelta'
              AND alertas_estado.silenciada_hasta IS NOT NULL
              AND alertas_estado.silenciada_hasta > NOW()
             THEN alertas_estado.silenciada_hasta
             ELSE NULL
           END`,
        [tenantId, a.id, a.titulo, a.descripcion, a.severity, JSON.stringify(a.accion ?? null)]
      );
    }

    if (actuales.length > 0) {
      await client.query(
        `UPDATE alertas_estado SET estado = 'resuelta', silenciada_hasta = NULL
         WHERE tenant_id = $1 AND alerta_id <> ALL($2::text[]) AND estado = 'activa'`,
        [tenantId, actuales.map((a) => a.id)]
      );
    } else {
      await client.query(
        `UPDATE alertas_estado SET estado = 'resuelta', silenciada_hasta = NULL
         WHERE tenant_id = $1 AND estado = 'activa'`,
        [tenantId]
      );
    }

    const { rows } = await client.query(
      `SELECT alerta_id, primera_deteccion, ultimo_titulo, ultima_descripcion, ultima_severidad, ultima_accion
       FROM alertas_estado
       WHERE tenant_id = $1 AND estado = 'activa'
         AND (silenciada_hasta IS NULL OR silenciada_hasta <= NOW())`,
      [tenantId]
    );

    await client.query('COMMIT');

    const alertas = (rows as Array<{
      alerta_id: string;
      primera_deteccion: string;
      ultimo_titulo: string | null;
      ultima_descripcion: string | null;
      ultima_severidad: string | null;
      ultima_accion: string | Record<string, unknown> | null;
    }>).map((r) => ({
      id: r.alerta_id,
      severity: (r.ultima_severidad ?? 'info') as Alerta['severity'],
      titulo: r.ultimo_titulo ?? r.alerta_id,
      descripcion: r.ultima_descripcion ?? '',
      accion: r.ultima_accion
        ? (typeof r.ultima_accion === 'string' ? JSON.parse(r.ultima_accion) : r.ultima_accion)
        : undefined,
      desde: new Date(r.primera_deteccion).toISOString(),
    }));

    return alertas.sort((a, b) => PESO_SEVERIDAD[a.severity] - PESO_SEVERIDAD[b.severity]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const resolverAlerta = async ({
  tenantId,
  alertaId,
}: {
  tenantId: string;
  alertaId: string;
}): Promise<{ alerta_id: string; silenciada_hasta: string | null }> => {
  const config = await obtenerConfigAlertas({ tenantId });
  const cooldown = `${config.cooldown_minutos} minutes`;

  const { rows } = await query(
    `UPDATE alertas_estado
     SET estado = 'resuelta', silenciada_hasta = NOW() + $3::interval
     WHERE tenant_id = $1 AND alerta_id = $2 AND estado = 'activa'
     RETURNING alerta_id, silenciada_hasta`,
    [tenantId, alertaId, cooldown]
  );

  if (rows.length === 0) {
    throw { status: 404, mensaje: 'La alerta no está activa o no existe.' };
  }

  return rows[0] as { alerta_id: string; silenciada_hasta: string };
};

export const listarHistorialAlertas = async ({
  tenantId,
  limite = 20,
}: {
  tenantId: string;
  limite?: number;
}): Promise<AlertaHistorialRow[]> => {
  const { rows } = await query(
    `SELECT alerta_id, estado, primera_deteccion, ultima_deteccion, veces_detectada,
            ultimo_titulo, ultima_descripcion, ultima_severidad
     FROM alertas_estado
     WHERE tenant_id = $1 AND estado = 'resuelta'
     ORDER BY ultima_deteccion DESC
     LIMIT $2`,
    [tenantId, limite]
  );
  return rows as unknown as AlertaHistorialRow[];
};