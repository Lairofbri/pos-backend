import { query } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';

/**
 * Factory del receptor de eventos de provisión del DTE Service
 * (Fase 2 + Fase 3). Acepta dependencias inyectables para unit tests (db
 * fake). El módulo exporta una instancia por defecto (uso normal) y la
 * factory (tests).
 *
 * El DTE Service es la fuente de verdad fiscal; el POS crea/actualiza su
 * proyección operativa con los MISMO identificadores (tenant_id / branch_id).
 * Idempotente:
 * - idempotency_keys (operation_id) → respuesta cacheada.
 * - INSERT con ON CONFLICT → nunca duplica filas.
 *
 * REGLA: el payload del evento nunca contiene credenciales Hacienda ni
 * secretos de firma; nada de esto se persiste en POS.
 */
type PayloadTenant = { nombre: string; nombre_comercial?: string | null; nit: string; nrc?: string | null; email?: string | null };
type PayloadBranch = {
  branch_id: string;
  establecimiento_id: string;
  fiscal_status: string;
  nombre: string;
  direccion?: string | null;
  telefono?: string | null;
};
type PayloadUsuarioInicial = {
  nombre: string;
  apellido?: string | null;
  email: string;
  rol: string;
  password_hash: string;
  pin_hash: string;
};

const crearServicioEventosProvision = (dependencias: { db?: { query: typeof query } } = {}) => {
  const db = dependencias.db || { query };

  const recibirEvento = async ({
    operationId,
    tipoEvento,
    tenantId,
    payload,
  }: {
    operationId: string;
    tipoEvento: string;
    tenantId: string;
    payload: PayloadTenant | PayloadBranch | PayloadUsuarioInicial;
  }) => {
    // Idempotencia: si la operación ya se procesó, devolver la misma respuesta.
    const { rows: cached } = await db.query(
      'SELECT response FROM idempotency_keys WHERE tenant_id = $1 AND key = $2',
      [tenantId, operationId]
    );
    if (cached.length > 0) {
      logger.info('Evento de provisión ya procesado (idempotente)', { operationId, tenantId, tipoEvento });
      return cached[0].response as { status: number; body: Record<string, unknown> };
    }

    if (tipoEvento === 'TENANT_CREADO') {
      const p = payload as PayloadTenant;
      await db.query(
        `INSERT INTO tenants (id, nombre, nombre_comercial, nit, nrc, email, activo, fiscal_sync_status, last_fiscal_sync_at)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, 'pending_fiscal_setup', NOW())
         ON CONFLICT (id) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           nombre_comercial = COALESCE(EXCLUDED.nombre_comercial, tenants.nombre_comercial, EXCLUDED.nombre),
           nit = EXCLUDED.nit,
           nrc = COALESCE(EXCLUDED.nrc, tenants.nrc),
           email = COALESCE(EXCLUDED.email, tenants.email),
           last_fiscal_sync_at = NOW()`,
        [tenantId, p.nombre, p.nombre_comercial || p.nombre, p.nit, p.nrc || null, p.email || null]
      );
    }

    if (tipoEvento === 'BRANCH_VINCULADO') {
      const p = payload as PayloadBranch;

      // La proyección del tenant debe existir (el evento TENANT_CREADO se
      // entrega antes por el outbox). Si falta, responder error para que el
      // outbox reintente el evento más tarde.
      const { rows: tenants } = await db.query('SELECT id FROM tenants WHERE id = $1', [tenantId]);
      if (tenants.length === 0) {
        logger.warn('BRANCH_VINCULADO rechazado: tenant no proyectado', { operationId, tenantId });
        throw { status: 409, mensaje: 'Tenant no proyectado en POS. Procesar TENANT_CREADO primero.' };
      }

      const activo = p.fiscal_status !== 'inactive';

      await db.query(
        `INSERT INTO sucursales
           (tenant_id, branch_id, dte_establecimiento_id, nombre, direccion, telefono,
            fiscal_status, activo, last_fiscal_sync_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (tenant_id, branch_id) WHERE branch_id IS NOT NULL DO UPDATE SET
           dte_establecimiento_id = EXCLUDED.dte_establecimiento_id,
           nombre = EXCLUDED.nombre,
           direccion = COALESCE(EXCLUDED.direccion, sucursales.direccion),
           telefono = COALESCE(EXCLUDED.telefono, sucursales.telefono),
           fiscal_status = EXCLUDED.fiscal_status,
           sync_error = NULL,
           activo = EXCLUDED.activo,
           last_fiscal_sync_at = NOW()`,
        [
          tenantId,
          p.branch_id,
          p.establecimiento_id,
          p.nombre,
          p.direccion || null,
          p.telefono || null,
          p.fiscal_status,
          activo,
        ]
      );

      logger.info('Sucursal sincronizada desde DTE', {
        operationId,
        tenantId,
        branch_id: p.branch_id,
        establecimiento_id: p.establecimiento_id,
        fiscal_status: p.fiscal_status,
      });
    }

    if (tipoEvento === 'USUARIO_INICIAL') {
      const p = payload as PayloadUsuarioInicial;
      await aplicarUsuarioInicial({ operationId, tenantId, usuario: p });
    }

    const body = { ok: true, mensaje: 'Evento de provisión procesado.', data: { tenant_id: tenantId } };
    const resultado = { status: 200, body };

    await db.query(
      `INSERT INTO idempotency_keys (tenant_id, key, endpoint, response)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [tenantId, operationId, '/internal/provisioning/events', JSON.stringify(resultado)]
    );

    logger.info('Evento de provisión procesado', {
      operationId,
      tenantId,
      tipoEvento,
      // NUNCA loguear secretos ni credenciales.
    });

    return resultado;
  };

  /**
   * Usuario administrador inicial del tenant (evento USUARIO_INICIAL).
   *
   * REGLAS (2026-10-07):
   * - SOLO hashes bcrypt en el payload: el POS nunca recibe la contraseña ni
   *   el PIN en claro (validado por schema).
   * - Idempotente: si el email ya existe en el tenant, es un no-op.
   * - Aislamiento: si el email pertenece a OTRO tenant, se rechaza con 409
   *   (el outbox DTE lo reintentará sin éxito; el error queda visible como
   *   evento fallido para el operador de plataforma).
   * - El tenant debe estar proyectado (TENANT_CREADO se entrega antes); si
   *   falta, 409 para que el outbox reintente.
   */
  const aplicarUsuarioInicial = async ({
    operationId,
    tenantId,
    usuario,
  }: {
    operationId: string;
    tenantId: string;
    usuario: PayloadUsuarioInicial;
  }) => {
    const { rows: tenants } = await db.query('SELECT id FROM tenants WHERE id = $1', [tenantId]);
    if (tenants.length === 0) {
      logger.warn('USUARIO_INICIAL rechazado: tenant no proyectado', { operationId, tenantId });
      throw { status: 409, mensaje: 'Tenant no proyectado en POS. Procesar TENANT_CREADO primero.' };
    }

    const { rows: enEsteTenant } = await db.query(
      'SELECT id FROM usuarios WHERE email = $1 AND tenant_id = $2',
      [usuario.email, tenantId]
    );
    if (enEsteTenant.length > 0) {
      logger.info('USUARIO_INICIAL ya existía en el tenant (idempotente)', {
        operationId,
        tenantId,
        email: usuario.email,
      });
      return;
    }

    const { rows: enOtroTenant } = await db.query(
      'SELECT id FROM usuarios WHERE email = $1 AND tenant_id <> $2',
      [usuario.email, tenantId]
    );
    if (enOtroTenant.length > 0) {
      logger.warn('USUARIO_INICIAL rechazado: email en uso por otra empresa', {
        operationId,
        tenantId,
        email: usuario.email,
      });
      throw { status: 409, mensaje: 'El email del administrador ya está en uso por otra empresa.' };
    }

    await db.query(
      `INSERT INTO usuarios (tenant_id, sucursal_id, nombre, apellido, email, password_hash, pin_hash, rol)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO NOTHING`,
      [tenantId, usuario.nombre, usuario.apellido || null, usuario.email, usuario.password_hash, usuario.pin_hash, usuario.rol]
    );

    logger.info('Usuario inicial sincronizado desde DTE', {
      operationId,
      tenantId,
      email: usuario.email,
      rol: usuario.rol,
      // NUNCA loguear hashes ni credenciales.
    });
  };

  return { recibirEvento };
};

// Instancia por defecto (uso normal) + factory para unit tests.
export const servicioEventosProvision = crearServicioEventosProvision();
export const crearServicioEventosProvisionFactory = crearServicioEventosProvision;