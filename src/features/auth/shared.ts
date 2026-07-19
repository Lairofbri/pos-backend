import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '../../shared/config/database.js';
import { env } from '../../shared/config/env.js';
import { logger } from '../../shared/utils/logger.js';

const SALT_ROUNDS = 12;
const MAX_INTENTOS_PIN = 5;
const MINUTOS_BLOQUEO = 15;

const generarPayload = (usuario: Record<string, unknown>) => ({
  sub: usuario.id as string,
  tenant_id: usuario.tenant_id as string,
  rol: usuario.rol as string,
  nombre: usuario.nombre as string,
  sucursal_id: (usuario.sucursal_id as string) || null,
});

const generarTokens = (usuario: Record<string, unknown>) => {
  const payload = generarPayload(usuario);
  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
  const refreshToken = jwt.sign(
    { sub: usuario.id as string, tenant_id: usuario.tenant_id as string },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions
  );
  return { accessToken, refreshToken };
};

const hashRefreshToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

const guardarRefreshToken = async (usuarioId: string, tenantId: string, refreshToken: string, dispositivo: string | null, ip: string | null) => {
  const tokenHash = hashRefreshToken(refreshToken);
  const decoded = jwt.decode(refreshToken) as { exp: number };
  const expiraEn = new Date(decoded.exp * 1000);
  await query(
    `INSERT INTO refresh_tokens (usuario_id, tenant_id, token_hash, dispositivo, ip_origen, expira_en)
     VALUES ($1, $2, $3, $4, $5::inet, $6)`,
    [usuarioId, tenantId, tokenHash, dispositivo || null, ip || null, expiraEn]
  );
};

const formatearUsuario = (row: Record<string, unknown>) => ({
  id: row.id as string,
  tenant_id: row.tenant_id as string,
  sucursal_id: row.sucursal_id as string | null,
  nombre: row.nombre as string,
  apellido: row.apellido as string | null,
  email: row.email as string | null,
  rol: row.rol as string,
  activo: row.activo as boolean,
  ultimo_acceso: row.ultimo_acceso as string | null,
});

export const loginEmail = async ({ email, password, tenantId, ip }: { email: string; password: string; tenantId: string; ip: string | undefined }) => {
  const { rows } = await query(
    `SELECT u.*, t.activo as tenant_activo
     FROM usuarios u
     JOIN tenants t ON t.id = u.tenant_id
     WHERE u.email = $1 AND u.tenant_id = $2 AND u.activo = TRUE`,
    [email.toLowerCase(), tenantId]
  );

  if (rows.length === 0) {
    throw { status: 401, mensaje: 'Credenciales incorrectas.' };
  }

  const usuario = rows[0] as Record<string, unknown>;

  if (!usuario.tenant_activo) {
    throw { status: 403, mensaje: 'La cuenta del restaurante está inactiva.' };
  }

  if (!usuario.password_hash) {
    throw { status: 401, mensaje: 'Este usuario no tiene acceso al panel web.' };
  }

  const passwordValido = await bcrypt.compare(password, usuario.password_hash as string);
  if (!passwordValido) {
    throw { status: 401, mensaje: 'Credenciales incorrectas.' };
  }

  await query(
    'UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1 AND tenant_id = $2',
    [usuario.id, usuario.tenant_id]
  );

  const { accessToken, refreshToken } = generarTokens(usuario);
  await guardarRefreshToken(usuario.id as string, usuario.tenant_id as string, refreshToken, null, ip || null);

  logger.info('Login email exitoso', { usuario_id: usuario.id as string, rol: usuario.rol as string });

  return {
    usuario: formatearUsuario(usuario),
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: env.JWT_EXPIRES_IN,
  };
};

export const loginPin = async ({ tenantId, usuarioId, pin, ip }: { tenantId: string; usuarioId?: string; pin: string; ip: string | undefined }) => {
  if (usuarioId) {
    return loginPinConUsuario({ tenantId, usuarioId, pin, ip });
  }
  return loginPinPorPin({ tenantId, pin, ip });
};

const loginPinConUsuario = async ({ tenantId, usuarioId, pin, ip }: { tenantId: string; usuarioId: string; pin: string; ip: string | undefined }) => {
  const { rows } = await query(
    `SELECT u.*, t.activo as tenant_activo
     FROM usuarios u
     JOIN tenants t ON t.id = u.tenant_id
     WHERE u.id = $1 AND u.tenant_id = $2 AND u.activo = TRUE`,
    [usuarioId, tenantId]
  );

  if (rows.length === 0) {
    throw { status: 401, mensaje: 'Credenciales incorrectas.' };
  }

  const usuario = rows[0] as Record<string, unknown>;

  if (!usuario.tenant_activo) {
    throw { status: 403, mensaje: 'La cuenta del restaurante está inactiva.' };
  }

  if (usuario.bloqueado_hasta && new Date() >= new Date(usuario.bloqueado_hasta as string)) {
    await query(
      'UPDATE usuarios SET intentos_pin = 0, bloqueado_hasta = NULL WHERE id = $1 AND tenant_id = $2',
      [usuarioId, tenantId]
    );
    usuario.intentos_pin = 0;
    usuario.bloqueado_hasta = null;
  }

  if (usuario.bloqueado_hasta && new Date() < new Date(usuario.bloqueado_hasta as string)) {
    const minutosRestantes = Math.ceil(
      (new Date(usuario.bloqueado_hasta as string).getTime() - new Date().getTime()) / 60000
    );
    throw {
      status: 429,
      mensaje: `Cuenta bloqueada temporalmente. Intenta en ${minutosRestantes} minuto(s).`,
    };
  }

  if (!usuario.pin_hash) {
    throw { status: 401, mensaje: 'Credenciales incorrectas.' };
  }

  const pinValido = await bcrypt.compare(String(pin), usuario.pin_hash as string);

  if (!pinValido) {
    const { rows: actualizados } = await query(
      `UPDATE usuarios
       SET intentos_pin = intentos_pin + 1,
           bloqueado_hasta = CASE
             WHEN intentos_pin + 1 >= $1 THEN NOW() + $2::interval
             ELSE NULL
           END
       WHERE id = $3 AND tenant_id = $4
       RETURNING intentos_pin, bloqueado_hasta`,
      [MAX_INTENTOS_PIN, `${MINUTOS_BLOQUEO} minutes`, usuarioId, tenantId]
    );

    const nuevosIntentos = (actualizados[0] as Record<string, unknown>).intentos_pin as number;

    if (nuevosIntentos >= MAX_INTENTOS_PIN) {
      logger.warn('Usuario bloqueado por intentos fallidos de PIN', {
        usuario_id: usuarioId,
        tenant_id: tenantId,
      });
    }

    const intentosRestantes = MAX_INTENTOS_PIN - nuevosIntentos;
    throw {
      status: 401,
      mensaje: intentosRestantes > 0
        ? `PIN incorrecto. ${intentosRestantes} intento(s) restante(s).`
        : `PIN incorrecto. Cuenta bloqueada por ${MINUTOS_BLOQUEO} minutos.`,
    };
  }

  await query(
    'UPDATE usuarios SET intentos_pin = 0, bloqueado_hasta = NULL, ultimo_acceso = NOW() WHERE id = $1 AND tenant_id = $2',
    [usuario.id, usuario.tenant_id]
  );

  const { accessToken, refreshToken } = generarTokens(usuario);
  await guardarRefreshToken(usuario.id as string, usuario.tenant_id as string, refreshToken, null, ip || null);

  logger.info('Login PIN exitoso', { usuario_id: usuario.id as string, rol: usuario.rol as string });

  return {
    usuario: formatearUsuario(usuario),
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: env.JWT_EXPIRES_IN,
  };
};

const loginPinPorPin = async ({ tenantId, pin, ip }: { tenantId: string; pin: string; ip: string | undefined }) => {
  const { rows } = await query(
    `SELECT u.*, t.activo as tenant_activo
     FROM usuarios u
     JOIN tenants t ON t.id = u.tenant_id
     WHERE u.tenant_id = $1 AND u.activo = TRUE AND u.pin_hash IS NOT NULL`,
    [tenantId]
  );

  if (rows.length === 0) {
    throw { status: 401, mensaje: 'Credenciales incorrectas.' };
  }

  if (!(rows[0] as Record<string, unknown>).tenant_activo) {
    throw { status: 403, mensaje: 'La cuenta del restaurante está inactiva.' };
  }

  let usuarioMatch: Record<string, unknown> | null = null;
  for (const row of rows) {
    const match = await bcrypt.compare(String(pin), (row as Record<string, unknown>).pin_hash as string);
    if (match) {
      usuarioMatch = row as Record<string, unknown>;
      break;
    }
  }

  if (!usuarioMatch) {
    throw { status: 401, mensaje: 'PIN incorrecto.' };
  }

  const usuario = usuarioMatch;

  await query(
    'UPDATE usuarios SET intentos_pin = 0, bloqueado_hasta = NULL, ultimo_acceso = NOW() WHERE id = $1 AND tenant_id = $2',
    [usuario.id, usuario.tenant_id]
  );

  const { accessToken, refreshToken } = generarTokens(usuario);
  await guardarRefreshToken(usuario.id as string, usuario.tenant_id as string, refreshToken, null, ip || null);

  logger.info('Login PIN exitoso (por PIN)', { usuario_id: usuario.id as string, rol: usuario.rol as string });

  return {
    usuario: formatearUsuario(usuario),
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: env.JWT_EXPIRES_IN,
  };
};

export const refreshAccessToken = async ({ refreshToken }: { refreshToken: string }) => {
  try {
    jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw { status: 401, mensaje: 'Refresh token inválido o expirado.' };
  }

  const tokenHash = hashRefreshToken(refreshToken);
  const { rows } = await query(
    `SELECT rt.*, u.activo as usuario_activo, u.rol, u.nombre, u.apellido,
            u.email, u.sucursal_id, t.activo as tenant_activo
     FROM refresh_tokens rt
     JOIN usuarios u ON u.id = rt.usuario_id
     JOIN tenants  t ON t.id = rt.tenant_id
     WHERE rt.token_hash = $1 AND rt.activo = TRUE AND rt.expira_en > NOW()`,
    [tokenHash]
  );

  if (rows.length === 0) {
    throw { status: 401, mensaje: 'Sesión inválida. Inicia sesión nuevamente.' };
  }

  const sesion = rows[0] as Record<string, unknown>;

  if (!sesion.usuario_activo || !sesion.tenant_activo) {
    throw { status: 403, mensaje: 'Cuenta inactiva.' };
  }

  await query(
    'UPDATE refresh_tokens SET activo = FALSE WHERE token_hash = $1 AND tenant_id = $2',
    [tokenHash, sesion.tenant_id as string]
  );

  const usuario = {
    id: sesion.usuario_id as string,
    tenant_id: sesion.tenant_id as string,
    rol: sesion.rol as string,
    nombre: sesion.nombre as string,
    apellido: sesion.apellido as string,
    sucursal_id: sesion.sucursal_id as string,
  };

  const { accessToken, refreshToken: nuevoRefreshToken } = generarTokens(usuario);
  await guardarRefreshToken(usuario.id, usuario.tenant_id, nuevoRefreshToken, sesion.dispositivo as string | null, null);

  return {
    access_token: accessToken,
    refresh_token: nuevoRefreshToken,
    expires_in: env.JWT_EXPIRES_IN,
  };
};

export const logout = async ({ refreshToken, tenantId }: { refreshToken: string; tenantId: string }) => {
  if (!refreshToken) return;

  const tokenHash = hashRefreshToken(refreshToken);
  await query(
    'UPDATE refresh_tokens SET activo = FALSE WHERE token_hash = $1 AND tenant_id = $2',
    [tokenHash, tenantId]
  );
};

export const cambiarPin = async ({ usuarioId, tenantId, pinActual, pinNuevo }: { usuarioId: string; tenantId: string; pinActual: string; pinNuevo: string }) => {
  const { rows } = await query(
    'SELECT pin_hash FROM usuarios WHERE id = $1 AND tenant_id = $2',
    [usuarioId, tenantId]
  );

  if (rows.length === 0) {
    throw { status: 404, mensaje: 'Usuario no encontrado.' };
  }

  const pinActualValido = await bcrypt.compare(String(pinActual), (rows[0] as Record<string, unknown>).pin_hash as string);
  if (!pinActualValido) {
    throw { status: 401, mensaje: 'El PIN actual es incorrecto.' };
  }

  const nuevoPinHash = await bcrypt.hash(String(pinNuevo), SALT_ROUNDS);
  await query(
    'UPDATE usuarios SET pin_hash = $1 WHERE id = $2 AND tenant_id = $3',
    [nuevoPinHash, usuarioId, tenantId]
  );

  await query(
    'UPDATE refresh_tokens SET activo = FALSE WHERE usuario_id = $1 AND tenant_id = $2 AND activo = TRUE',
    [usuarioId, tenantId]
  );

  logger.info('PIN cambiado', { usuario_id: usuarioId });
};

export const cambiarPassword = async ({ usuarioId, tenantId, passwordActual, passwordNuevo }: { usuarioId: string; tenantId: string; passwordActual: string; passwordNuevo: string }) => {
  const { rows } = await query(
    'SELECT password_hash FROM usuarios WHERE id = $1 AND tenant_id = $2',
    [usuarioId, tenantId]
  );

  if (rows.length === 0 || !(rows[0] as Record<string, unknown>).password_hash) {
    throw { status: 404, mensaje: 'Usuario no encontrado o sin acceso web.' };
  }

  const passValido = await bcrypt.compare(passwordActual, (rows[0] as Record<string, unknown>).password_hash as string);
  if (!passValido) {
    throw { status: 401, mensaje: 'El password actual es incorrecto.' };
  }

  const nuevoHash = await bcrypt.hash(passwordNuevo, SALT_ROUNDS);
  await query(
    'UPDATE usuarios SET password_hash = $1 WHERE id = $2 AND tenant_id = $3',
    [nuevoHash, usuarioId, tenantId]
  );

  await query(
    'UPDATE refresh_tokens SET activo = FALSE WHERE usuario_id = $1 AND tenant_id = $2 AND activo = TRUE',
    [usuarioId, tenantId]
  );

  logger.info('Password cambiado', { usuario_id: usuarioId });
};

export const listarUsuarios = async ({ tenantId }: { tenantId: string }) => {
  const { rows } = await query(
    `SELECT id, nombre, apellido, email, rol, sucursal_id, activo, ultimo_acceso, creado_en
     FROM usuarios
     WHERE tenant_id = $1
     ORDER BY rol, nombre`,
    [tenantId]
  );
  return rows;
};

export const obtenerUsuario = async ({ tenantId, usuarioId }: { tenantId: string; usuarioId: string }) => {
  const { rows } = await query(
    `SELECT id, nombre, apellido, email, rol, sucursal_id, activo, ultimo_acceso, creado_en
     FROM usuarios
     WHERE id = $1 AND tenant_id = $2`,
    [usuarioId, tenantId]
  );
  if (rows.length === 0) throw { status: 404, mensaje: 'Usuario no encontrado.' };
  return rows[0];
};

export const obtenerMe = async ({ usuarioId, tenantId }: { usuarioId: string; tenantId: string }) => {
  const { rows } = await query(
    `SELECT id, nombre, apellido, email, rol, sucursal_id, activo, ultimo_acceso
     FROM usuarios
     WHERE id = $1 AND tenant_id = $2`,
    [usuarioId, tenantId]
  );
  if (rows.length === 0) {
    throw { status: 401, mensaje: 'Usuario no encontrado.' };
  }
  if (!(rows[0] as Record<string, unknown>).activo) {
    throw { status: 403, mensaje: 'Cuenta de usuario desactivada.' };
  }
  return rows[0];
};

export const crearUsuario = async ({ tenantId, datos }: { tenantId: string; datos: Record<string, unknown> }) => {
  const { nombre, apellido, email, pin, password, rol, sucursal_id } = datos;

  if (email) {
    const { rows: existe } = await query(
      'SELECT id FROM usuarios WHERE email = $1 AND tenant_id = $2',
      [(email as string).toLowerCase(), tenantId]
    );
    if (existe.length > 0) {
      throw { status: 409, mensaje: 'Ya existe un usuario con ese email en este restaurante.' };
    }
  }

  const pinHash = await bcrypt.hash(String(pin), SALT_ROUNDS);
  const passwordHash = password ? await bcrypt.hash(String(password), SALT_ROUNDS) : null;

  const { rows } = await query(
    `INSERT INTO usuarios (tenant_id, sucursal_id, nombre, apellido, email, password_hash, pin_hash, rol)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, nombre, apellido, email, rol, sucursal_id, activo, creado_en`,
    [
      tenantId,
      (sucursal_id as string) || null,
      nombre as string,
      (apellido as string) || null,
      email ? (email as string).toLowerCase() : null,
      passwordHash,
      pinHash,
      rol as string,
    ]
  );

  logger.info('Usuario creado', { usuario_id: (rows[0] as Record<string, unknown>).id as string, tenant_id: tenantId, rol: rol as string });
  return rows[0];
};

export const actualizarUsuario = async ({ tenantId, usuarioId, datos }: { tenantId: string; usuarioId: string; datos: Record<string, unknown> }) => {
  await obtenerUsuario({ tenantId, usuarioId });

  const campos: string[] = [];
  const valores: unknown[] = [];
  let idx = 1;

  if (datos.nombre !== undefined) { campos.push(`nombre = $${idx++}`); valores.push(datos.nombre); }
  if (datos.apellido !== undefined) { campos.push(`apellido = $${idx++}`); valores.push(datos.apellido); }
  if (datos.email !== undefined) { campos.push(`email = $${idx++}`); valores.push((datos.email as string)?.toLowerCase() || null); }
  if (datos.rol !== undefined) { campos.push(`rol = $${idx++}`); valores.push(datos.rol); }
  if (datos.sucursal_id !== undefined) { campos.push(`sucursal_id = $${idx++}`); valores.push(datos.sucursal_id); }
  if (datos.activo !== undefined) { campos.push(`activo = $${idx++}`); valores.push(datos.activo); }

  if (campos.length === 0) {
    throw { status: 400, mensaje: 'No hay campos para actualizar.' };
  }

  valores.push(usuarioId, tenantId);

  const { rows } = await query(
    `UPDATE usuarios SET ${campos.join(', ')}
     WHERE id = $${idx++} AND tenant_id = $${idx}
     RETURNING id, nombre, apellido, email, rol, sucursal_id, activo`,
    valores
  );

  logger.info('Usuario actualizado', { usuario_id: usuarioId });
  return rows[0];
};

export const resetearPin = async ({ tenantId, usuarioId, pinNuevo }: { tenantId: string; usuarioId: string; pinNuevo: string }) => {
  await obtenerUsuario({ tenantId, usuarioId });

  const pinHash = await bcrypt.hash(String(pinNuevo), SALT_ROUNDS);
  await query(
    'UPDATE usuarios SET pin_hash = $1, intentos_pin = 0, bloqueado_hasta = NULL WHERE id = $2 AND tenant_id = $3',
    [pinHash, usuarioId, tenantId]
  );

  await query(
    'UPDATE refresh_tokens SET activo = FALSE WHERE usuario_id = $1 AND tenant_id = $2 AND activo = TRUE',
    [usuarioId, tenantId]
  );

  logger.info('PIN reseteado por administrador', { usuario_id: usuarioId });
};

export const listarUsuariosParaPin = async ({ tenantId }: { tenantId: string }) => {
  const { rows } = await query(
    `SELECT id, nombre, apellido, rol
     FROM usuarios
     WHERE tenant_id = $1 AND activo = TRUE
       AND pin_hash IS NOT NULL
       AND (bloqueado_hasta IS NULL OR bloqueado_hasta < NOW())
     ORDER BY nombre`,
    [tenantId]
  );
  return rows;
};

export const listarTenants = async () => {
  const { rows } = await query(
    'SELECT id, nombre, logo_url FROM tenants WHERE activo = TRUE ORDER BY nombre'
  );
  return rows;
};
