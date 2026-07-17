import { query, getClient } from '../../shared/config/database.js';
import { obtenerClientePorTenant } from '../../shared/dte-client.js';
import { logger } from '../../shared/utils/logger.js';

const ENDPOINTS: Record<string, string> = {
  '01': '/api/dte/emitir/fcf',
  '03': '/api/dte/emitir/ccf',
  '14': '/api/dte/emitir/fse',
};

const INTERVALO_MS = 2 * 60 * 1000;

type PendienteRow = {
  id: string;
  orden_id: string;
  tenant_id: string;
  tipo_dte: string;
  payload: string | Record<string, unknown>;
  intentos: number;
  max_intentos: number;
};

const procesarPendientes = async () => {
  try {
    const { rows: pendientes } = await query(
      `SELECT * FROM dte_pendientes
       WHERE estado IN ('pendiente', 'fallo')
         AND intentos < max_intentos
       ORDER BY intentos ASC, creado_en ASC
       LIMIT 10`
    );

    if (pendientes.length === 0) return;

    logger.info(`Cron DTE: ${pendientes.length} pendientes por procesar`);

    for (const row of pendientes) {
      const pendiente = row as unknown as PendienteRow;

      try {
        await query(
          `UPDATE dte_pendientes SET estado = 'procesando', actualizado_en = NOW() WHERE id = $1`,
          [pendiente.id]
        );

        const endpoint = ENDPOINTS[pendiente.tipo_dte];
        if (!endpoint) {
          await query(
            `UPDATE dte_pendientes SET estado = 'fallo', intentos = intentos + 1, ultimo_error = 'Tipo DTE no soportado', actualizado_en = NOW() WHERE id = $1`,
            [pendiente.id]
          );
          continue;
        }

        const payload = typeof pendiente.payload === 'string'
          ? JSON.parse(pendiente.payload)
          : pendiente.payload;

        const cliente = await obtenerClientePorTenant(pendiente.tenant_id);
        const resp = await cliente.post(endpoint, payload);
        const resultado = resp as unknown as Record<string, unknown>;

        const client = await getClient();
        try {
          await client.query('BEGIN');

          await client.query(
            `UPDATE ordenes
             SET dte_codigo_generacion = $1,
                 dte_numero_control = $2,
                 dte_estado = 'emitido',
                 dte_emitido_en = NOW()
             WHERE id = $3`,
            [resultado.codigo_generacion || null, resultado.numero_control || null, pendiente.orden_id]
          );

          await client.query(
            `INSERT INTO dtes_orden (orden_id, tenant_id, tipo_dte, codigo_generacion, numero_control, estado, json_envio, json_respuesta, creado_en)
             VALUES ($1, $2, $3, $4, $5, 'emitido', $6, $7, NOW())`,
            [
              pendiente.orden_id, pendiente.tenant_id, pendiente.tipo_dte,
              resultado.codigo_generacion || null, resultado.numero_control || null,
              JSON.stringify(payload), JSON.stringify(resultado),
            ]
          );

          await client.query(
            `UPDATE dte_pendientes SET estado = 'completado', actualizado_en = NOW() WHERE id = $1`,
            [pendiente.id]
          );

          await client.query('COMMIT');

          logger.info('Cron DTE: pendiente procesado exitosamente', {
            ordenId: pendiente.orden_id,
            codigoGeneracion: resultado.codigo_generacion,
          });
        } catch (errTx) {
          await client.query('ROLLBACK');
          throw errTx;
        } finally {
          client.release();
        }
      } catch (err) {
        const mensajeError = (err as { mensaje?: string; message?: string }).mensaje
          || (err as Error).message
          || 'Error desconocido';
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
