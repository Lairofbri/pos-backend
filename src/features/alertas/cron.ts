import { servicioEmpresaDte } from '../../shared/dte-empresa.js';
import { evaluarYNotificar } from './notificar.js';
import { logger } from '../../shared/utils/logger.js';

const INTERVALO_MS = 15 * 60 * 1000;

/**
 * F3 (spec «DTE única fuente de verdad», 2026-10-16): el cron itera los
 * tenants activos desde el DTE Service (fuente de verdad de empresa), no
 * desde la tabla local `tenants`. Si el DTE no responde, se registra el error
 * y se reintenta en el próximo ciclo (las alertas son best-effort).
 */
const evaluarTodosLosTenants = async () => {
  try {
    const tenants = await servicioEmpresaDte.listarTenants();
    for (const tenant of tenants as { id: string }[]) {
      await evaluarYNotificar(tenant.id);
    }
  } catch (err) {
    logger.error('Cron alertas: error al obtener las empresas del DTE', {
      error: (err as Error).message,
    });
  }
};

export const iniciarCronAlertas = () => {
  logger.info('Cron alertas iniciado — cada 15 minutos');
  void evaluarTodosLosTenants();
  setInterval(evaluarTodosLosTenants, INTERVALO_MS);
};
