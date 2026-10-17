import { query } from '../../../shared/config/database.js';
import { env } from '../../../shared/config/env.js';
import { encriptarTexto } from '../../../shared/utils/crypto.js';
import { logger } from '../../../shared/utils/logger.js';

/**
 * Factory del receptor de eventos de provisión del DTE Service
 * (Fase 2 + Fase 3 + F5).
 * Acepta dependencias inyectables para unit tests (db fake). El módulo exporta
 * una instancia por defecto (uso normal) y la factory (tests).
 *
 * El DTE Service es la fuente de verdad de EMPRESA y SUCURSAL; el POS solo
 * mantiene un espejo MÍNIMO de identidad técnica del tenant (`id`, `activo`).
 *
 * ALCANCE (F5, 2026-10-16): el POS ya NO guarda nada de empresa/sucursal.
 * - `TENANT_CREADO` proyecta la fila mínima del tenant (para el gate de cuenta
 *   activa y las FK operativas por `tenant_id`) y siembra el onboarding
 *   operativo (permisos + catálogos).
 * - `BRANCH_VINCULADO` queda como evento ACEPTADO e IDEMPOTENTE pero sin
 *   proyección: la tabla `sucursales` se retiró (migración 081) y las lecturas
 *   de establecimiento salen del DTE.
 * - `USUARIO_INICIAL` sigue creando el administrador del POS.
 *
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

  /**
   * Onboarding del POS para un tenant nuevo (riesgo 3 del análisis «DTE única
   * fuente de verdad»): sin esto la empresa queda **con todos los permisos
   * denegados y sin catálogos operativos**.
   *
   * Los MENÚS no se siembran: `menus` es un catálogo GLOBAL compartido por
   * todas las empresas (decisión del propietario 2026-10-16, migración 080).
   * Lo que sí es por tenant son los PERMISOS (rol_permisos) y los catálogos.
   *
   * Las funciones son idempotentes (ON CONFLICT), así que re-entregar
   * `TENANT_CREADO` también repara tenants creados antes de esta corrección
   * (p. ej. al usar «Reintentar sync» en el DTE).
   */
  const sembrarOnboardingTenant = async (tenantId: string) => {
    await db.query('CALL sp_sembrar_permisos_tenant($1)', [tenantId]);
    await db.query('CALL sp_sembrar_catalogos_tenant($1)', [tenantId]);
  };

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
      // F5 — espejo MÍNIMO: el POS ya no guarda identidad de empresa (nombre,
      // NIT, NRC, email). Solo proyecta la existencia técnica del tenant para
      // el gate de cuenta activa y las FK operativas por `tenant_id`.
      await db.query(
        `INSERT INTO tenants (id, activo)
         VALUES ($1, TRUE)
         ON CONFLICT (id) DO NOTHING`,
        [tenantId]
      );

      // Onboarding operativo del tenant: permisos por rol (matriz completa del
      // rol `administrador`) y catálogos. Los menús del sidebar son globales
      // (migración 080) y no se siembran por tenant.
      await sembrarOnboardingTenant(tenantId);
    }

    if (tipoEvento === 'BRANCH_VINCULADO') {
      // F5 — el POS ya no proyecta sucursales: el DTE es la única fuente de
      // verdad y las lecturas de establecimiento salen de su API. El evento se
      // acepta (ack idempotente para el outbox del DTE) sin escribir nada.
      const p = payload as PayloadBranch;
      logger.info('BRANCH_VINCULADO aceptado sin proyección: el POS ya no guarda sucursales (DTE es la fuente)', {
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
   * API Key de integración POS → DTE (entrega automática, 2026-10-17).
   *
   * El DTE genera la clave, guarda **solo su hash** y la entrega acá por el
   * canal interno (`X-Internal-Api-Key`, red privada). El POS la cifra
   * (AES-256-GCM con `POS_ENCRYPTION_KEY`) y la guarda en
   * `tenants.dte_api_key_enc`; NUNCA se persiste en texto plano, ni se
   * devuelve, ni se loguea.
   *
   * Idempotente: reentregar la clave (misma o rotada) sobrescribe.
   * Si el tenant aún no está proyectado → 409 (el DTE puede reintentar tras
   * entregar `TENANT_CREADO`).
   */
  const guardarApiKeyDte = async ({ tenantId, apiKey }: { tenantId: string; apiKey: string }) => {
    const clave = String(apiKey ?? '').trim();
    if (clave.length < 16) {
      throw { status: 400, mensaje: 'api_key inválida.' };
    }

    const { rows } = await db.query('SELECT id FROM tenants WHERE id = $1', [tenantId]);
    if (rows.length === 0) {
      logger.warn('API Key DTE rechazada: tenant no proyectado', { tenantId });
      throw { status: 409, mensaje: 'Tenant no proyectado en POS. Procesar TENANT_CREADO primero.' };
    }

    const cifrado = encriptarTexto(clave, env.POS_ENCRYPTION_KEY);
    if (!cifrado) {
      throw { status: 500, mensaje: 'No se pudo cifrar la API Key de facturación.' };
    }

    await db.query(
      `UPDATE tenants
          SET dte_api_key_enc = $1, actualizado_en = NOW()
        WHERE id = $2`,
      [cifrado, tenantId]
    );

    logger.info('API Key de integración DTE guardada (cifrada)', { tenantId });

    return { tenant_id: tenantId, configurada: true };
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
       ON CONFLICT (tenant_id, email) WHERE email IS NOT NULL DO NOTHING`,
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

  return { recibirEvento, guardarApiKeyDte };
};

// Instancia por defecto (uso normal) + factory para unit tests.
export const servicioEventosProvision = crearServicioEventosProvision();
export const crearServicioEventosProvisionFactory = crearServicioEventosProvision;