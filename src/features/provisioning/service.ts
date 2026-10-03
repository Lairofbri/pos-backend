import { env } from '../../shared/config/env.js';
import { query } from '../../shared/config/database.js';
import { crearClienteInternoDte } from '../../shared/dte-client.js';
import { encriptarTexto } from '../../shared/utils/crypto.js';
import { logger } from '../../shared/utils/logger.js';

/**
 * Alta de empresa iniciada desde POS (spec §6.1).
 *
 * Flujo:
 * 1. Usuario con rol plataforma solicita el alta (tenant_id + operation_id).
 * 2. POS llama al endpoint interno de provisión del DTE Service.
 * 3. DTE crea el tenant fiscal (pending_fiscal_setup) y devuelve la API Key
 *    técnica UNA sola vez. El POS la guarda cifrada (AES-256-GCM) — nunca en
 *    claro en BD ni en logs.
 * 4. POS crea su proyección operativa con el MISMO tenant_id.
 * 5. POS confirma a DTE que almacenó la clave (PATCH status).
 *
 * Idempotencia: reintentar con el mismo operation_id devuelve el resultado
 * cacheado y NO duplica tenants ni claves.
 *
 * TESTABILIDAD: factory con dependencias inyectables.
 */

type DatosCrearTenant = {
  tenant_id: string;
  operation_id: string;
  nombre: string;
  nit: string;
  nrc?: string | null;
  email?: string | null;
};

type ResultadoProvisionDte = {
  tenant_id: string;
  nombre: string;
  provisioning_status: string;
  api_key: string | null;
};

const crearServicioProvisionPos = (dependencias: {
  db?: { query: typeof query };
  crearClienteInterno?: typeof crearClienteInternoDte;
  cifrar?: typeof encriptarTexto;
} = {}) => {
  const db = dependencias.db || { query };
  const crearClienteInterno = dependencias.crearClienteInterno || crearClienteInternoDte;
  const cifrar = dependencias.cifrar || encriptarTexto;

  const crearTenantPos = async ({
    tenantIdOperador,
    datos,
    operationId,
  }: {
    tenantIdOperador: string;
    datos: DatosCrearTenant;
    operationId: string;
  }) => {
    const operationIdNorm = operationId.toLowerCase();

    // 1. Idempotencia: la clave de operación se scopea al tenant del operador
    // (la empresa nueva aún no existe en esta base).
    const { rows: cached } = await db.query(
      'SELECT response FROM idempotency_keys WHERE tenant_id = $1 AND key = $2',
      [tenantIdOperador, operationIdNorm]
    );
    if (cached.length > 0) {
      logger.info('Provisión de empresa ya registrada (idempotente)', {
        operation_id: operationIdNorm,
        tenant_id: datos.tenant_id,
      });
      return cached[0].response as { status: number; body: Record<string, unknown> };
    }

    const baseURL = env.DTE_SERVICE_URL;
    const cliente = crearClienteInterno(baseURL);

    // 2. Llamar al DTE Service (fuente de verdad fiscal).
    const resultado = (await cliente.post('/internal/provisioning/tenants', {
      tenant_id: datos.tenant_id,
      operation_id: operationIdNorm,
      nombre: datos.nombre,
      nit: datos.nit,
      nrc: datos.nrc || null,
      email: datos.email || null,
    })) as unknown as ResultadoProvisionDte;

    const tenantId = resultado.tenant_id;

    // 4. Proyección operativa del tenant con el mismo tenant_id (ANTES de
    // almacenar la clave: la fila debe existir).
    await db.query(
      `INSERT INTO tenants (id, nombre, nit, nrc, email, dte_service_url, activo, fiscal_sync_status, last_fiscal_sync_at)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, 'pending_fiscal_setup', NOW())
       ON CONFLICT (id) DO UPDATE SET
         nombre = EXCLUDED.nombre,
         nit = EXCLUDED.nit,
         nrc = COALESCE(EXCLUDED.nrc, tenants.nrc),
         email = COALESCE(EXCLUDED.email, tenants.email),
         dte_service_url = EXCLUDED.dte_service_url,
         last_fiscal_sync_at = NOW()`,
      [tenantId, datos.nombre, datos.nit, datos.nrc || null, datos.email || null, baseURL]
    );

    // 3.5. Onboarding del tenant nuevo (Fase 7): permisos, catálogos y menús
    // default. Idempotentes por tenant (sp_* → re-ejecutar no duplica).
    // El "usuario inicial" queda como decisión del propietario (spec Fase 7
    // pendientes): crear credenciales iniciales es riesgo de seguridad.
    await db.query('CALL sp_sembrar_permisos_tenant($1)', [tenantId]);
    await db.query('CALL sp_sembrar_catalogos_tenant($1)', [tenantId]);
    await db.query('CALL sp_sembrar_menus_tenant($1)', [tenantId]);

    // 3. Almacenar la API Key cifrada (si se entregó por primera vez).
    let apiKeyAlmacenada = false;
    if (resultado.api_key) {
      const cifrada = cifrar(resultado.api_key, env.POS_ENCRYPTION_KEY);
      await db.query(
        'UPDATE tenants SET dte_api_key_enc = $1, actualizado_en = NOW() WHERE id = $2',
        [cifrada, tenantId]
      );
      apiKeyAlmacenada = true;
    }

    // 5. Confirmar a DTE que el POS almacenó la clave (habilita la rotación
    // segura si el reintento ocurre antes de esta confirmación).
    if (apiKeyAlmacenada) {
      await cliente.patch(`/internal/provisioning/tenants/${tenantId}/status`, {
        operation_id: operationIdNorm,
        status: 'pending_fiscal_setup',
      });
    }

    const body = {
      ok: true,
      mensaje: 'Empresa creada. Integración con DTE Service configurada.',
      data: {
        tenant_id: tenantId,
        fiscal_sync_status: 'pending_fiscal_setup',
        api_key_entregada: apiKeyAlmacenada,
      },
    };
    const respuesta = { status: 201, body };

    await db.query(
      `INSERT INTO idempotency_keys (tenant_id, key, endpoint, response)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [tenantIdOperador, operationIdNorm, '/provisioning/tenants', JSON.stringify(respuesta)]
    );

    logger.info('Empresa creada desde POS', {
      tenant_id: tenantId,
      operation_id: operationIdNorm,
      fiscal_sync_status: 'pending_fiscal_setup',
      // NUNCA loguear la API Key.
    });

    return respuesta;
  };

  return { crearTenantPos };
};

// Instancia por defecto (uso normal) + factory para unit tests.
export const servicioProvisionPos = crearServicioProvisionPos();
export const crearServicioProvisionPosFactory = crearServicioProvisionPos;