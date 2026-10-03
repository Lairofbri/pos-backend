import { randomUUID } from 'crypto';
import { query } from '../../../../shared/config/database.js';
import { env } from '../../../../shared/config/env.js';
import { crearClienteInternoDte } from '../../../../shared/dte-client.js';
import { logger } from '../../../../shared/utils/logger.js';

/**
 * Factory del servicio de creación de sucursales (Fase 3).
 * Acepta dependencias inyectables para unit tests (db fake, cliente interno
 * fake). El módulo exporta una instancia por defecto (uso normal) y la
 * factory (tests).
 *
 * Flujo (spec §6.3):
 * 1. POS crea la sucursal operativa con branch_id compartido (UUID v4).
 * 2. POS solicita la vinculación fiscal al endpoint interno del DTE.
 * 3. DTE registra el establecimiento en pending_mh_data (sin inventar
 *    códigos MH); el administrador los completa después.
 * 4. Si el DTE no responde, la sucursal queda en pending_link con
 *    sync_error y puede reintentarse (POST /sucursales/:id/vincular).
 *
 * Reglas:
 * - Idempotente por operation_id (Idempotency-Key) — no duplica sucursales.
 * - La sucursal en estado pendiente puede operar internamente pero NO emitir
 *   DTE (validación de emisión Fase 0 exige fiscal_status = 'ready').
 * - Nunca se transportan ni persisten credenciales Hacienda.
 */
const crearServicioSucursales = (dependencias: {
  db?: { query: typeof query };
  crearClienteInterno?: typeof crearClienteInternoDte;
} = {}) => {
  const db = dependencias.db || { query };
  const crearClienteInterno = dependencias.crearClienteInterno || crearClienteInternoDte;

  const crearSucursal = async ({
    tenantId,
    datos,
    operationId,
  }: {
    tenantId: string;
    datos: Record<string, unknown>;
    operationId?: string;
  }) => {
    const { nombre, direccion, telefono, es_principal } = datos as {
      nombre: string;
      direccion?: string;
      telefono?: string;
      es_principal?: boolean;
    };

    const operationIdNorm = operationId ? operationId.toLowerCase() : null;

    // 0. Idempotencia: si la operación ya se procesó, devolver la misma respuesta.
    if (operationIdNorm) {
      const { rows: cached } = await db.query(
        'SELECT response FROM idempotency_keys WHERE tenant_id = $1 AND key = $2',
        [tenantId, operationIdNorm]
      );
      if (cached.length > 0) {
        logger.info('Creación de sucursal ya registrada (idempotente)', {
          operation_id: operationIdNorm,
          tenant_id: tenantId,
        });
        return cached[0].response as { status: number; body: Record<string, unknown> };
      }
    }

    const branchId = randomUUID();
    const operationIdVinculo = operationIdNorm || randomUUID();

    // 1. Crear la sucursal local en pending_link (bloqueada para emisión).
    const { rows } = await db.query(
      `INSERT INTO sucursales (tenant_id, branch_id, nombre, direccion, telefono, es_principal, fiscal_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending_link')
       RETURNING id, tenant_id, branch_id, nombre, direccion, telefono, es_principal,
                 activo, fiscal_status, dte_establecimiento_id, sync_error, creado_en`,
      [tenantId, branchId, nombre, direccion || null, telefono || null, es_principal || false]
    );

    const sucursal = rows[0] as Record<string, unknown>;

    // 2. Solicitar el vínculo fiscal al DTE Service (idempotente por branch_id).
    try {
      const cliente = crearClienteInterno(env.DTE_SERVICE_URL);
      const vinculacion = (await cliente.post(
        `/internal/provisioning/tenants/${tenantId}/branches`,
        {
          branch_id: branchId,
          operation_id: operationIdVinculo,
          nombre,
          direccion: direccion || null,
          telefono: telefono || null,
        }
      )) as { establecimiento_id: string; fiscal_status: string };

      const fiscalStatus = vinculacion.fiscal_status || 'pending_mh_data';
      await db.query(
        `UPDATE sucursales
         SET dte_establecimiento_id = $1, fiscal_status = $2,
             last_fiscal_sync_at = NOW(), sync_error = NULL
         WHERE id = $3`,
        [vinculacion.establecimiento_id, fiscalStatus, sucursal.id]
      );
      sucursal.dte_establecimiento_id = vinculacion.establecimiento_id;
      sucursal.fiscal_status = fiscalStatus;
      sucursal.sync_error = null;

      logger.info('Sucursal vinculada al DTE Service', {
        tenant_id: tenantId,
        branch_id: branchId,
        establecimiento_id: vinculacion.establecimiento_id,
        fiscal_status: fiscalStatus,
      });
    } catch (err) {
      const e = err as { mensaje?: string; status?: number };
      const mensaje = e.mensaje || 'DTE Service no disponible para el vínculo fiscal.';
      await db.query(
        'UPDATE sucursales SET sync_error = $1, last_fiscal_sync_at = NOW() WHERE id = $2',
        [mensaje.slice(0, 500), sucursal.id]
      );
      sucursal.sync_error = mensaje;
      logger.warn('Vínculo fiscal pendiente de reintento', {
        tenant_id: tenantId,
        branch_id: branchId,
        error: mensaje,
      });
    }

    const cuerpo = { sucursal };
    const mensajeRespuesta =
      sucursal.fiscal_status === 'pending_mh_data'
        ? 'Sucursal creada y vinculada. Pendiente de datos fiscales en DTE.'
        : 'Sucursal creada. Vínculo fiscal pendiente de confirmación.';
    const respuesta = { status: 201, body: { ok: true, mensaje: mensajeRespuesta, data: cuerpo } };

    // 3. Registrar idempotencia (solo si el cliente envió Idempotency-Key).
    if (operationIdNorm) {
      await db.query(
        `INSERT INTO idempotency_keys (tenant_id, key, endpoint, response)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [tenantId, operationIdNorm, '/api/v1/admin/sucursales', JSON.stringify(respuesta)]
      );
    }

    return respuesta;
  };

  return { crearSucursal };
};

// Instancia por defecto (uso normal) + factory para unit tests.
export const servicioSucursales = crearServicioSucursales();
export const crearServicioSucursalesFactory = crearServicioSucursales;