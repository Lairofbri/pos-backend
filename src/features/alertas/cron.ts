import { query } from '../../shared/config/database.js';
import { evaluarYNotificar } from './notificar.js';
import { logger } from '../../shared/utils/logger.js';

const INTERVALO_MS = 15 * 60 * 1000;

const evaluarTodosLosTenants = async () => {
  try {
    const { rows } = await query('SELECT id FROM tenants');
    for (const row of rows as { id: string }[]) {
      await evaluarYNotificar(row.id);
    }
  } catch (err) {
    logger.error('Cron alertas: error al evaluar tenants', {
      error: (err as Error).message,
    });
  }
};

export const iniciarCronAlertas = () => {
  logger.info('Cron alertas iniciado — cada 15 minutos');
  void evaluarTodosLosTenants();
  setInterval(evaluarTodosLosTenants, INTERVALO_MS);
};