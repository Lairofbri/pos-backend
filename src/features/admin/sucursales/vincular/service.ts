import { randomUUID } from 'crypto';
import { query } from '../../../../shared/config/database.js';
import { env } from '../../../../shared/config/env.js';
import { crearClienteInternoDte } from '../../../../shared/dte-client.js';
import { logger } from '../../../../shared/utils/logger.js';

/**
 * Factory del servicio de reintento de vínculo fiscal (Fase 3).
 * Acepta dependencias inyectables para unit tests (db fake, cliente interno
 * fake). El módulo exporta una instancia por defecto (uso normal) y la
 * factory (tests).
 *
 * Reintenta el vínculo fiscal de una sucursal POS hacia el DTE Service
 * (spec §6.3 / §12 — Reintentar). La creación de sucursal deja el vínculo en
 * pending_link con sync_error si el DTE no respondió. Este endpoint reintenta
 * con el branch_id ya asignado; el DTE es idempotente por (tenant_id,
 * branch_id), así que un reintento nunca duplica establecimientos.
 */
const crearServicioVinculoSucursal = (dependencias: {
  db?: { query: typeof query };
  crearClienteInterno?: typeof crearClienteInternoDte;
} = {}) => {
  const db = dependencias.db || { query };
  const crearClienteInterno = dependencias.crearClienteInterno || crearClienteInternoDte;

  const vincular = async ({ tenantId, sucursalId }: { tenantId: string; sucursalId: string }) => {
    const { rows } = await db.query(
      `SELECT id, tenant_id, branch_id, nombre, direccion, telefono,
              dte_establecimiento_id, fiscal_status, sync_error
       FROM sucursales
       WHERE id = $1 AND tenant_id = $2`,
      [sucursalId, tenantId]
    );

    if (rows.length === 0) {
      throw { status: 404, mensaje: 'Sucursal no encontrada.' };
    }

    const sucursal = rows[0] as Record<string, unknown>;

    if (!sucursal.branch_id) {
      throw { status: 409, mensaje: 'La sucursal no tiene branch_id para vincular.' };
    }
    if (sucursal.fiscal_status === 'ready') {
      return { sucursal, duplicado: true };
    }
    if (sucursal.fiscal_status === 'inactive') {
      throw { status: 409, mensaje: 'La sucursal está inactiva y no puede vincularse.' };
    }

    const cliente = crearClienteInterno(env.DTE_SERVICE_URL);
    const vinculacion = (await cliente.post(
      `/internal/provisioning/tenants/${tenantId}/branches`,
      {
        branch_id: sucursal.branch_id,
        operation_id: randomUUID(),
        nombre: sucursal.nombre,
        direccion: sucursal.direccion || null,
        telefono: sucursal.telefono || null,
      }
    )) as { establecimiento_id: string; fiscal_status: string };

    const fiscalStatus = vinculacion.fiscal_status || 'pending_mh_data';

    await db.query(
      `UPDATE sucursales
       SET dte_establecimiento_id = $1, fiscal_status = $2,
           sync_error = NULL, last_fiscal_sync_at = NOW()
       WHERE id = $3`,
      [vinculacion.establecimiento_id, fiscalStatus, sucursalId]
    );

    const actualizada = {
      ...sucursal,
      dte_establecimiento_id: vinculacion.establecimiento_id,
      fiscal_status: fiscalStatus,
      sync_error: null,
    };

    logger.info('Vínculo fiscal reintentado con éxito', {
      tenant_id: tenantId,
      branch_id: sucursal.branch_id,
      establecimiento_id: vinculacion.establecimiento_id,
      fiscal_status: fiscalStatus,
    });

    return { sucursal: actualizada, duplicado: false };
  };

  return { vincular };
};

// Instancia por defecto (uso normal) + factory para unit tests.
export const servicioVinculoSucursal = crearServicioVinculoSucursal();
export const crearServicioVinculoSucursalFactory = crearServicioVinculoSucursal;