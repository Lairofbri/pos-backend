import { io } from '../../server.js';
import { query } from '../../shared/config/database.js';
import { logger } from '../../shared/utils/logger.js';
import { obtenerAlertas, obtenerConfigAlertas, enHorarioSilencioso, type Alerta } from './service.js';

const firmar = (alertas: Alerta[]) =>
  alertas.map((a) => `${a.id}|${a.severity}|${a.descripcion}`).join(';');

export const evaluarYNotificar = async (tenantId: string): Promise<boolean> => {
  try {
    const [config, alertas] = await Promise.all([
      obtenerConfigAlertas({ tenantId }),
      obtenerAlertas({ tenantId }),
    ]);
    const firma = firmar(alertas);

    const { rows } = await query(
      `INSERT INTO alertas_snapshot (tenant_id, firma)
       VALUES ($1, $2)
       ON CONFLICT (tenant_id) DO UPDATE
       SET firma = EXCLUDED.firma, actualizado_en = NOW()
       WHERE alertas_snapshot.firma IS DISTINCT FROM EXCLUDED.firma
       RETURNING firma`,
      [tenantId, firma]
    );

    if (rows.length === 0) {
      return false;
    }

    if (enHorarioSilencioso(config)) {
      logger.debug('Alertas: emisión silenciada por horario', { tenant_id: tenantId });
      return false;
    }

    io.to(`tenant:${tenantId}`).emit('alertas:actualizadas', alertas);
    logger.debug('Alertas emitidas por socket', {
      tenant_id: tenantId,
      cantidad: alertas.length,
    });
    return true;
  } catch (err) {
    logger.error('Error al evaluar alertas para notificación', {
      tenant_id: tenantId,
      error: (err as Error).message,
    });
    return false;
  }
};
