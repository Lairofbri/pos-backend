import { query, getClient } from '../../shared/config/database.js';
import { obtenerClientePorTenant } from '../../shared/dte-client.js';
import { logger } from '../../shared/utils/logger.js';
import { limpiarPayloadSecreto, tieneCamposSecretos } from './payload-seguro.js';
import { mapearEstadoFiscal, extraerResultado } from './estados.js';

const ENDPOINTS: Record<string, string> = {
  '01': '/api/dte/emitir/fcf',
  '03': '/api/dte/emitir/ccf',
  '14': '/api/dte/emitir/fse',
};

const INTERVALO_MS = 2 * 60 * 1000;

// Fase 3 — estados fiscales explícitos del DTE en el POS.
// (mapearEstadoFiscal y extraerResultado provienen de ./estados.ts)

type PendienteRow = {
  id: string;
  orden_id: string;
  tenant_id: string;
  tipo_dte: string;
  payload: string | Record<string, unknown>;
  intentos: number;
  max_intentos: number;
};

// Fase 3 — reclamo atómico de pendientes: bloquea las filas reclamadas
// (FOR UPDATE SKIP LOCKED) para que múltiples instancias del cron no
// procesen la misma fila en paralelo.
const reclamarPendientes = async () => {
  const { rows } = await query(
    `UPDATE dte_pendientes
     SET estado = 'procesando', actualizado_en = NOW()
     WHERE id IN (
       SELECT id FROM dte_pendientes
       WHERE (
         estado IN ('pendiente', 'fallo')
         OR (estado = 'procesando' AND actualizado_en < NOW() - INTERVAL '5 minutes')
       )
       AND intentos < max_intentos
       ORDER BY intentos ASC, creado_en ASC
       LIMIT 10
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`
  );
  return rows;
};

const parsearPayload = (payload: string | Record<string, unknown>): Record<string, unknown> => {
  const crudo = typeof payload === 'string' ? JSON.parse(payload) : payload;
  return limpiarPayloadSecreto(crudo);
};

const persistirRechazoPendiente = async (pendiente: PendienteRow, mensaje: string, detalles?: unknown) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO dtes_orden (orden_id, tenant_id, tipo_dte, estado, json_envio, errores, creado_en)
       VALUES ($1, $2, $3, 'rechazado', $4, $5, NOW())
       ON CONFLICT (tenant_id, orden_id, tipo_dte) DO UPDATE
       SET estado = 'rechazado', errores = EXCLUDED.errores, actualizado_en = NOW()`,
      [
        pendiente.orden_id, pendiente.tenant_id, pendiente.tipo_dte,
        JSON.stringify(parsearPayload(pendiente.payload)),
        JSON.stringify({ mensaje, detalles }),
      ]
    );

    await client.query(
      `UPDATE ordenes
       SET dte_estado = 'rechazado',
           dte_emitido_en = COALESCE(dte_emitido_en, NOW())
       WHERE id = $1`,
      [pendiente.orden_id]
    );

    await client.query(
      `UPDATE dte_pendientes SET estado = 'completado', actualizado_en = NOW() WHERE id = $1`,
      [pendiente.id]
    );

    await client.query('COMMIT');
  } catch (errTx) {
    await client.query('ROLLBACK');
    logger.error('Cron DTE: error al persistir rechazo', { error: (errTx as Error).message, ordenId: pendiente.orden_id });
  } finally {
    client.release();
  }
};

const procesarPendientes = async () => {
  try {
    const pendientes = await reclamarPendientes();

    if (pendientes.length === 0) return;

    logger.info(`Cron DTE: ${pendientes.length} pendientes por procesar`);

    for (const row of pendientes) {
      const pendiente = row as unknown as PendienteRow;

      try {
        const endpoint = ENDPOINTS[pendiente.tipo_dte];
        if (!endpoint) {
          await query(
            `UPDATE dte_pendientes SET estado = 'fallo', intentos = intentos + 1, ultimo_error = 'Tipo DTE no soportado', actualizado_en = NOW() WHERE id = $1`,
            [pendiente.id]
          );
          continue;
        }

        const payload = parsearPayload(pendiente.payload);

        // SEGURIDAD: los payloads históricos pueden contener secretos.
        if (tieneCamposSecretos(
          typeof pendiente.payload === 'string' ? JSON.parse(pendiente.payload) : pendiente.payload
        )) {
          logger.warn('Cron DTE: payload histórico contenía campos secretos — fueron removidos', {
            ordenId: pendiente.orden_id,
          });
        }

        const cliente = await obtenerClientePorTenant(pendiente.tenant_id);
        const resp = await cliente.post(endpoint, payload);
        const resultado = extraerResultado(resp);
        const estadoFiscal = mapearEstadoFiscal(resultado.estado as string);

        const client = await getClient();
        try {
          await client.query('BEGIN');

          // Fase 3 — no duplicar: si ya existe un DTE para (tenant, orden, tipo),
          // solo refrescar la referencia en la orden sin insertar otra fila.
          const { rows: yaExiste } = await client.query(
            `SELECT id FROM dtes_orden
             WHERE tenant_id = $1 AND orden_id = $2 AND tipo_dte = $3`,
            [pendiente.tenant_id, pendiente.orden_id, pendiente.tipo_dte]
          );

          if (yaExiste.length === 0) {
            await client.query(
              `INSERT INTO dtes_orden (orden_id, tenant_id, tipo_dte, codigo_generacion, numero_control, estado, json_envio, json_respuesta, creado_en)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
               ON CONFLICT (tenant_id, orden_id, tipo_dte) DO UPDATE
               SET codigo_generacion = EXCLUDED.codigo_generacion,
                   numero_control = EXCLUDED.numero_control,
                   estado = EXCLUDED.estado,
                   json_respuesta = EXCLUDED.json_respuesta,
                   actualizado_en = NOW()`,
              [
                pendiente.orden_id, pendiente.tenant_id, pendiente.tipo_dte,
                resultado.codigo_generacion || null, resultado.numero_control || null,
                estadoFiscal, JSON.stringify(payload), JSON.stringify(resultado),
              ]
            );
          }

          await client.query(
            `UPDATE ordenes
             SET dte_codigo_generacion = COALESCE($1, dte_codigo_generacion),
                 dte_numero_control = COALESCE($2, dte_numero_control),
                 dte_estado = $3,
                 dte_emitido_en = COALESCE(dte_emitido_en, NOW())
             WHERE id = $4`,
            [resultado.codigo_generacion || null, resultado.numero_control || null, estadoFiscal, pendiente.orden_id]
          );

          await client.query(
            `UPDATE dte_pendientes SET estado = 'completado', actualizado_en = NOW() WHERE id = $1`,
            [pendiente.id]
          );

          await client.query('COMMIT');

          logger.info('Cron DTE: pendiente procesado exitosamente', {
            ordenId: pendiente.orden_id,
            codigoGeneracion: resultado.codigo_generacion,
            estado: estadoFiscal,
          });
        } catch (errTx) {
          await client.query('ROLLBACK');
          throw errTx;
        } finally {
          client.release();
        }
      } catch (err) {
        const e = err as { status?: number; mensaje?: string; message?: string; detalles?: unknown };
        const mensajeError = e.mensaje || (err as Error).message || 'Error desconocido';

        // Fase 3 — rechazo fiscal: estado final, no se reintenta.
        if (e.status === 422) {
          await persistirRechazoPendiente(pendiente, mensajeError, e.detalles);
          logger.warn('Cron DTE: DTE rechazado (terminal, sin reintento)', {
            ordenId: pendiente.orden_id,
            error: mensajeError,
          });
          continue;
        }

        await query(
          `UPDATE dte_pendientes
           SET estado = 'fallo',
               intentos = intentos + 1,
               ultimo_error = $1,
               actualizado_en = NOW()
           WHERE id = $2`,
          [mensajeError, pendiente.id]
        );

        logger.warn('Cron DTE: error al procesar pendiente', {
          ordenId: pendiente.orden_id,
          error: mensajeError,
          intento: pendiente.intentos + 1,
        });
      }
    }
  } catch (err) {
    logger.error('Cron DTE: error al consultar pendientes', { error: (err as Error).message });
  }
};

export const iniciarCronDte = () => {
  logger.info('Cron DTE iniciado — cada 2 minutos');
  setInterval(procesarPendientes, INTERVALO_MS);
};