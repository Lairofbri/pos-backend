// src/modules/auth/auth.service.js
// Lógica de negocio para autenticación
// El controller llama a estos métodos — nunca toca la BD directamente

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../../config/database');
const { JWT_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES_IN } = require('../../config/env');
const logger = require('../../utils/logger');

const SALT_ROUNDS = 10;
// Bloqueo temporal después de N intentos fallidos de PIN
const MAX_INTENTOS_PIN = 5;
const MINUTOS_BLOQUEO  = 15;

// ─────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────

/** Genera el payload del JWT de acceso */
const generarPayload = (usuario) => ({
  sub:        usuario.id,
  tenant_id:  usuario.tenant_id,
  rol:        usuario.rol,
  nombre:     usuario.nombre,
  sucursal_id: usuario.sucursal_id || null,
});

/** Genera un par de tokens: acceso (corto) + refresh (largo) */
const generarTokens = (usuario) => {
  const payload = generarPayload(usuario);

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  const refreshToken = jwt.sign(
    { sub: usuario.id, tenant_id: usuario.tenant_id },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
};

/** Hash SHA-256 del refresh token para guardar en BD (nunca el raw) */
const hashRefreshToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

/** Registra el refresh token en la BD */
const guardarRefreshToken = async (usuarioId, tenantId, refreshToken, dispositivo, ip) => {
  const tokenHash = hashRefreshToken(refreshToken);
  // Calcular expiración en JS para guardar en BD
  const decoded = jwt.decode(refreshToken);
  const expiraEn = new Date(decoded.exp * 1000);

  await query(
    `INSERT INTO refresh_tokens (usuario_id, tenant_id, token_hash, dispositivo, ip_origen, expira_en)
     VALUES ($1, $2, $3, $4, $5::inet, $6)`,
    [usuarioId, tenantId, tokenHash, dispositivo || null, ip || null, expiraEn]
  );
};

/** Datos públicos del usuario (sin hashes) */
const formatearUsuario = (row) => ({
  id:          row.id,
  tenant_id:   row.tenant_id,
  sucursal_id: row.sucursal_id,
  nombre:      row.nombre,
  apellido:    row.apellido,
  email:       row.email,
  rol:         row.rol,
  ultimo_acceso: row.ultimo_acceso,
});

// ─────────────────────────────────────────────
// Login con email + password (panel web admin)
// ─────────────────────────────────────────────
const loginEmail = async ({ email, password, dispositivo, ip }) => {
  // Buscar usuario activo por email (cross-tenant — email es único global)
  const { rows } = await query(
    `SELECT u.*, t.activo as tenant_activo
     FROM usuarios u
     JOIN tenants t ON t.id = u.tenant_id
     WHERE u.email = $1 AND u.activo = TRUE`,
    [email.toLowerCase()]
  );

  if (rows.length === 0) {
    throw { status: 401, mensaje: 'Credenciales incorrectas.' };
  }

  const usuario = rows[0];

  if (!usuario.tenant_activo) {
    throw { status: 403, mensaje: 'La cuenta del restaurante está inactiva.' };
  }

  if (!usuario.password_hash) {
    throw { status: 401, mensaje: 'Este usuario no tiene acceso al panel web.' };
  }

  // Verificar password
  const passwordValido = await bcrypt.compare(password, usuario.password_hash);
  if (!passwordValido) {
    throw { status: 401, mensaje: 'Credenciales incorrectas.' };
  }

  // Actualizar último acceso
  await query(
    'UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1',
    [usuario.id]
  );

  const { accessToken, refreshToken } = generarTokens(usuario);
  await guardarRefreshToken(usuario.id, usuario.tenant_id, refreshToken, dispositivo, ip);

  logger.info('Login email exitoso', { usuario_id: usuario.id, rol: usuario.rol });

  return {
    usuario: formatearUsuario(usuario),
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: JWT_EXPIRES_IN,
  };
};

// ─────────────────────────────────────────────
// Login con PIN (estaciones POS)
// El tenant_id viene del header X-Tenant-Id (middleware)
// ─────────────────────────────────────────────
const loginPin = async ({ tenantId, usuarioId, pin, dispositivo, ip }) => {
  // Buscar usuario dentro del tenant
  const { rows } = await query(
    `SELECT u.*, t.activo as tenant_activo
     FROM usuarios u
     JOIN tenants t ON t.id = u.tenant_id
     WHERE u.id = $1 AND u.tenant_id = $2`,
    [usuarioId, tenantId]
  );

  if (rows.length === 0) {
    throw { status: 401, mensaje: 'Usuario no encontrado en este restaurante.' };
  }

  const usuario = rows[0];

  if (!usuario.tenant_activo) {
    throw { status: 403, mensaje: 'La cuenta del restaurante está inactiva.' };
  }

  if (!usuario.activo) {
    throw { status: 403, mensaje: 'Este usuario está desactivado.' };
  }

  // Verificar si está bloqueado temporalmente
  if (usuario.bloqueado_hasta && new Date() < new Date(usuario.bloqueado_hasta)) {
    const minutosRestantes = Math.ceil(
      (new Date(usuario.bloqueado_hasta) - new Date()) / 60000
    );
    throw {
      status: 429,
      mensaje: `Cuenta bloqueada temporalmente. Intenta en ${minutosRestantes} minuto(s).`,
    };
  }

  // Verificar PIN
  const pinValido = await bcrypt.compare(String(pin), usuario.pin_hash);

  if (!pinValido) {
    // Incrementar contador de intentos fallidos
    const nuevosIntentos = (usuario.intentos_pin || 0) + 1;
    let bloqueadoHasta = null;

    if (nuevosIntentos >= MAX_INTENTOS_PIN) {
      bloqueadoHasta = new Date(Date.now() + MINUTOS_BLOQUEO * 60 * 1000);
      logger.warn('Usuario bloqueado por intentos fallidos de PIN', {
        usuario_id: usuarioId,
        tenant_id: tenantId,
      });
    }

    await query(
      'UPDATE usuarios SET intentos_pin = $1, bloqueado_hasta = $2 WHERE id = $3',
      [nuevosIntentos, bloqueadoHasta, usuarioId]
    );

    const intentosRestantes = MAX_INTENTOS_PIN - nuevosIntentos;
    throw {
      status: 401,
      mensaje: intentosRestantes > 0
        ? `PIN incorrecto. ${intentosRestantes} intento(s) restante(s).`
        : `PIN incorrecto. Cuenta bloqueada por ${MINUTOS_BLOQUEO} minutos.`,
    };
  }

  // PIN correcto — resetear intentos y actualizar último acceso
  await query(
    'UPDATE usuarios SET intentos_pin = 0, bloqueado_hasta = NULL, ultimo_acceso = NOW() WHERE id = $1',
    [usuario.id]
  );

  const { accessToken, refreshToken } = generarTokens(usuario);
  await guardarRefreshToken(usuario.id, usuario.tenant_id, refreshToken, dispositivo, ip);

  logger.info('Login PIN exitoso', { usuario_id: usuario.id, rol: usuario.rol });

  return {
    usuario: formatearUsuario(usuario),
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: JWT_EXPIRES_IN,
  };
};

// ─────────────────────────────────────────────
// Refresh: generar nuevo access token
// ─────────────────────────────────────────────
const refreshAccessToken = async ({ refreshToken }) => {
  // Verificar firma del refresh token
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
  } catch {
    throw { status: 401, mensaje: 'Refresh token inválido o expirado.' };
  }

  // Verificar que el token esté registrado y activo en BD
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

  const sesion = rows[0];

  if (!sesion.usuario_activo || !sesion.tenant_activo) {
    throw { status: 403, mensaje: 'Cuenta inactiva.' };
  }

  // Generar nuevo access token (el refresh token sigue siendo el mismo)
  const nuevoAccessToken = jwt.sign(
    {
      sub:         sesion.usuario_id,
      tenant_id:   sesion.tenant_id,
      rol:         sesion.rol,
      nombre:      sesion.nombre,
      sucursal_id: sesion.sucursal_id,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    access_token: nuevoAccessToken,
    expires_in: JWT_EXPIRES_IN,
  };
};

// ─────────────────────────────────────────────
// Logout: invalidar refresh token
// ─────────────────────────────────────────────
const logout = async ({ refreshToken }) => {
  if (!refreshToken) return; // Silencioso si no hay token

  const tokenHash = hashRefreshToken(refreshToken);
  await query(
    'UPDATE refresh_tokens SET activo = FALSE WHERE token_hash = $1',
    [tokenHash]
  );
};

// ─────────────────────────────────────────────
// Cambiar PIN propio
// ─────────────────────────────────────────────
const cambiarPin = async ({ usuarioId, tenantId, pinActual, pinNuevo }) => {
  const { rows } = await query(
    'SELECT pin_hash FROM usuarios WHERE id = $1 AND tenant_id = $2',
    [usuarioId, tenantId]
  );

  if (rows.length === 0) {
    throw { status: 404, mensaje: 'Usuario no encontrado.' };
  }

  const pinActualValido = await bcrypt.compare(String(pinActual), rows[0].pin_hash);
  if (!pinActualValido) {
    throw { status: 401, mensaje: 'El PIN actual es incorrecto.' };
  }

  const nuevoPinHash = await bcrypt.hash(String(pinNuevo), SALT_ROUNDS);
  await query(
    'UPDATE usuarios SET pin_hash = $1 WHERE id = $2',
    [nuevoPinHash, usuarioId]
  );

  logger.info('PIN cambiado', { usuario_id: usuarioId });
};

// ─────────────────────────────────────────────
// Cambiar password propio
// ─────────────────────────────────────────────
const cambiarPassword = async ({ usuarioId, tenantId, passwordActual, passwordNuevo }) => {
  const { rows } = await query(
    'SELECT password_hash FROM usuarios WHERE id = $1 AND tenant_id = $2',
    [usuarioId, tenantId]
  );

  if (rows.length === 0 || !rows[0].password_hash) {
    throw { status: 404, mensaje: 'Usuario no encontrado o sin acceso web.' };
  }

  const passValido = await bcrypt.compare(passwordActual, rows[0].password_hash);
  if (!passValido) {
    throw { status: 401, mensaje: 'El password actual es incorrecto.' };
  }

  const nuevoHash = await bcrypt.hash(passwordNuevo, SALT_ROUNDS);
  await query(
    'UPDATE usuarios SET password_hash = $1 WHERE id = $2',
    [nuevoHash, usuarioId]
  );

  logger.info('Password cambiado', { usuario_id: usuarioId });
};

// ─────────────────────────────────────────────
// CRUD de usuarios (solo administrador)
// ─────────────────────────────────────────────

const listarUsuarios = async ({ tenantId }) => {
  const { rows } = await query(
    `SELECT id, nombre, apellido, email, rol, sucursal_id, activo, ultimo_acceso, creado_en
     FROM usuarios
     WHERE tenant_id = $1
     ORDER BY rol, nombre`,
    [tenantId]
  );
  return rows;
};

const obtenerUsuario = async ({ tenantId, usuarioId }) => {
  const { rows } = await query(
    `SELECT id, nombre, apellido, email, rol, sucursal_id, activo, ultimo_acceso, creado_en
     FROM usuarios
     WHERE id = $1 AND tenant_id = $2`,
    [usuarioId, tenantId]
  );
  if (rows.length === 0) throw { status: 404, mensaje: 'Usuario no encontrado.' };
  return rows[0];
};

const crearUsuario = async ({ tenantId, datos }) => {
  const { nombre, apellido, email, pin, password, rol, sucursal_id } = datos;

  // Verificar email único si se provee
  if (email) {
    const { rows: existe } = await query(
      'SELECT id FROM usuarios WHERE email = $1',
      [email.toLowerCase()]
    );
    if (existe.length > 0) {
      throw { status: 409, mensaje: 'Ya existe un usuario con ese email.' };
    }
  }

  const pinHash      = await bcrypt.hash(String(pin), SALT_ROUNDS);
  const passwordHash = password ? await bcrypt.hash(password, SALT_ROUNDS) : null;

  const { rows } = await query(
    `INSERT INTO usuarios (tenant_id, sucursal_id, nombre, apellido, email, password_hash, pin_hash, rol)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, nombre, apellido, email, rol, sucursal_id, activo, creado_en`,
    [
      tenantId,
      sucursal_id || null,
      nombre,
      apellido || null,
      email ? email.toLowerCase() : null,
      passwordHash,
      pinHash,
      rol,
    ]
  );

  logger.info('Usuario creado', { usuario_id: rows[0].id, tenant_id: tenantId, rol });
  return rows[0];
};

const actualizarUsuario = async ({ tenantId, usuarioId, datos }) => {
  // Verificar que el usuario existe en el tenant
  await obtenerUsuario({ tenantId, usuarioId });

  // Construir SET dinámico solo con los campos enviados
  const campos = [];
  const valores = [];
  let idx = 1;

  if (datos.nombre !== undefined)      { campos.push(`nombre = $${idx++}`);      valores.push(datos.nombre); }
  if (datos.apellido !== undefined)    { campos.push(`apellido = $${idx++}`);    valores.push(datos.apellido); }
  if (datos.email !== undefined)       { campos.push(`email = $${idx++}`);       valores.push(datos.email?.toLowerCase() || null); }
  if (datos.rol !== undefined)         { campos.push(`rol = $${idx++}`);         valores.push(datos.rol); }
  if (datos.sucursal_id !== undefined) { campos.push(`sucursal_id = $${idx++}`); valores.push(datos.sucursal_id); }
  if (datos.activo !== undefined)      { campos.push(`activo = $${idx++}`);      valores.push(datos.activo); }

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

// Resetear PIN de un usuario (solo admin)
const resetearPin = async ({ tenantId, usuarioId, pinNuevo }) => {
  await obtenerUsuario({ tenantId, usuarioId });

  const pinHash = await bcrypt.hash(String(pinNuevo), SALT_ROUNDS);
  await query(
    'UPDATE usuarios SET pin_hash = $1, intentos_pin = 0, bloqueado_hasta = NULL WHERE id = $2 AND tenant_id = $3',
    [pinHash, usuarioId, tenantId]
  );

  logger.info('PIN reseteado por administrador', { usuario_id: usuarioId });
};

// Listar usuarios activos del tenant (para la pantalla de selección de PIN en la estación)
const listarUsuariosParaPin = async ({ tenantId }) => {
  const { rows } = await query(
    `SELECT id, nombre, apellido, rol
     FROM usuarios
     WHERE tenant_id = $1 AND activo = TRUE
     ORDER BY nombre`,
    [tenantId]
  );
  return rows;
};

module.exports = {
  loginEmail,
  loginPin,
  refreshAccessToken,
  logout,
  cambiarPin,
  cambiarPassword,
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  resetearPin,
  listarUsuariosParaPin,
};
