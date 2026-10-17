import { query } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';
import { camposEmpresaEnviados, MENSAJE_EMPRESA_SOLO_DTE } from '../../../shared/empresa.js';

/**
 * Actualización de la configuración del restaurante (F2, 2026-10-16).
 *
 * El POS solo escribe la preferencia OPERATIVA `pos_default_mode`. Los datos de
 * EMPRESA (nombre, nit, nrc, direccion, telefono, email, logo_url) son fuente
 * de verdad del DTE Service: si llegan, el servicio también los rechaza
 * (defensa en profundidad, además del bloqueo del handler).
 *
 * Factory con dependencias inyectables para unit tests (db fake).
 */
const crearServicioRestaurante = (dependencias: { db?: { query: typeof query } } = {}) => {
  const db = dependencias.db || { query };

  const actualizarRestaurante = async ({
    tenantId,
    datos,
  }: {
    tenantId: string;
    datos: Record<string, unknown>;
  }) => {
    const camposEmpresa = camposEmpresaEnviados(datos);
    if (camposEmpresa.length > 0) {
      throw { status: 409, mensaje: MENSAJE_EMPRESA_SOLO_DTE, campos: camposEmpresa };
    }

    if (datos.pos_default_mode === undefined) {
      throw { status: 400, mensaje: 'No hay campos operativos del POS para actualizar.' };
    }

    const { rows } = await db.query(
      `UPDATE tenants SET pos_default_mode = $1
       WHERE id = $2
       RETURNING id, pos_default_mode`,
      [datos.pos_default_mode, tenantId]
    );

    if (rows.length === 0) {
      throw { status: 404, mensaje: 'Restaurante no encontrado.' };
    }

    logger.info('Preferencias operativas del POS actualizadas', {
      tenant_id: tenantId,
      pos_default_mode: datos.pos_default_mode,
    });

    return rows[0];
  };

  return { actualizarRestaurante };
};

// Instancia por defecto (uso normal) + factory para unit tests.
export const servicioRestaurante = crearServicioRestaurante();
export const crearServicioRestauranteFactory = crearServicioRestaurante;
export const actualizarRestaurante = servicioRestaurante.actualizarRestaurante;
