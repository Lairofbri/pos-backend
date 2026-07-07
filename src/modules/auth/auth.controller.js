// src/modules/auth/auth.controller.js
// Maneja los requests HTTP, valida el body y llama al service
// Principio S (SOLID): solo orquesta, no opera datos ni responde directamente

const authService = require('./auth.service');
const {
  loginEmailSchema,
  loginPinSchema,
  cambiarPinSchema,
  cambiarPasswordSchema,
  crearUsuarioSchema,
  actualizarUsuarioSchema,
} = require('./auth.schema');
const { exito, creado, error, errorServidor } = require('../../utils/response');
const { esUuidValido } = require('../../middlewares/uuid.middleware');
const env = require('../../config/env');
const logger = require('../../utils/logger');

const REFRESH_COOKIE = 'refresh_token';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: env.ES_PRODUCCION,
  sameSite: 'strict',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// ─────────────────────────────────────────────
// Helper: manejo de errores del service
// ─────────────────────────────────────────────
const manejarError = (req, res, err) => {
  if (err.status && err.mensaje) {
    return error(res, err.mensaje, err.status);
  }
  logger.error('Error no controlado en auth', {
    error: err.message,
    stack: err.stack,
    requestId: req.requestId,
  });
  return errorServidor(res);
};

// ─────────────────────────────────────────────
// POST /auth/login
// Login con email + password (panel admin web)
// ─────────────────────────────────────────────
const loginEmail = async (req, res) => {
  const { error: validacionError, value } = loginEmailSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resultado = await authService.loginEmail({
      email: value.email,
      password: value.password,
      tenantId: value.tenant_id,
      ip: req.ip,
    });
    const { refresh_token, ...data } = resultado;
    res.cookie(REFRESH_COOKIE, refresh_token, COOKIE_OPTS);
    return exito(res, data, 'Sesión iniciada exitosamente.');
  } catch (err) {
    return manejarError(req, res, err);
  }
};

// ─────────────────────────────────────────────
// POST /auth/login-pin
// Login con PIN (estaciones POS)
// Header requerido: X-Tenant-Id (debe ser UUID válido)
// ─────────────────────────────────────────────
const loginPin = async (req, res) => {
  const tenantId = req.headers['x-tenant-id'];

  if (!tenantId) {
    return error(res, 'Header X-Tenant-Id requerido.', 400);
  }
  // Validar que el tenant_id sea un UUID válido
  if (!esUuidValido(tenantId)) {
    return error(res, 'El header X-Tenant-Id no tiene un formato UUID válido.', 400);
  }

  const { error: validacionError, value } = loginPinSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resultado = await authService.loginPin({
      tenantId,
      usuarioId:   value.usuario_id,
      pin:         value.pin,
      ip:          req.ip,
    });
    const { refresh_token, ...data } = resultado;
    res.cookie(REFRESH_COOKIE, refresh_token, COOKIE_OPTS);
    return exito(res, data, 'Sesión iniciada exitosamente.');
  } catch (err) {
    return manejarError(req, res, err);
  }
};

// ─────────────────────────────────────────────
// POST /auth/refresh
// Lee refresh token de cookie httpOnly (primario) o body (fallback)
// ─────────────────────────────────────────────
const refresh = async (req, res) => {
  const cookieToken = req.cookies?.[REFRESH_COOKIE];
  const bodyToken = req.body?.refresh_token;
  const refreshToken = cookieToken || bodyToken;

  if (!refreshToken) {
    return error(res, 'Refresh token requerido.', 400);
  }

  try {
    const resultado = await authService.refreshAccessToken({ refreshToken });
    const { refresh_token, ...data } = resultado;
    res.cookie(REFRESH_COOKIE, refresh_token, COOKIE_OPTS);
    return exito(res, data, 'Token renovado exitosamente.');
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    return manejarError(req, res, err);
  }
};

// ─────────────────────────────────────────────
// POST /auth/logout
// Lee refresh token de cookie httpOnly (primario) o body (fallback)
// ─────────────────────────────────────────────
const logout = async (req, res) => {
  const cookieToken = req.cookies?.[REFRESH_COOKIE];
  const bodyToken = req.body?.refresh_token;
  const refreshToken = cookieToken || bodyToken;

  if (!refreshToken) {
    return error(res, 'Refresh token requerido.', 400);
  }

  try {
    await authService.logout({ refreshToken, tenantId: req.usuario.tenant_id });
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    return exito(res, null, 'Sesión cerrada exitosamente.');
  } catch (err) {
    return manejarError(req, res, err);
  }
};

// ─────────────────────────────────────────────
// GET /auth/me
// ─────────────────────────────────────────────
const me = async (req, res) => {
  try {
    const usuario = await authService.obtenerMe({
      usuarioId: req.usuario.id,
      tenantId:  req.usuario.tenant_id,
    });
    return exito(res, { usuario }, 'Datos del usuario actual.');
  } catch (err) {
    return manejarError(req, res, err);
  }
};

// ─────────────────────────────────────────────
// PUT /auth/cambiar-pin
// ─────────────────────────────────────────────
const cambiarPin = async (req, res) => {
  const { error: validacionError, value } = cambiarPinSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    await authService.cambiarPin({
      usuarioId: req.usuario.id,
      tenantId:  req.usuario.tenant_id,
      pinActual: value.pin_actual,
      pinNuevo:  value.pin_nuevo,
    });
    return exito(res, null, 'PIN actualizado exitosamente.');
  } catch (err) {
    return manejarError(req, res, err);
  }
};

// ─────────────────────────────────────────────
// PUT /auth/cambiar-password
// ─────────────────────────────────────────────
const cambiarPassword = async (req, res) => {
  const { error: validacionError, value } = cambiarPasswordSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    await authService.cambiarPassword({
      usuarioId:      req.usuario.id,
      tenantId:       req.usuario.tenant_id,
      passwordActual: value.password_actual,
      passwordNuevo:  value.password_nuevo,
    });
    return exito(res, null, 'Contraseña actualizada exitosamente.');
  } catch (err) {
    return manejarError(req, res, err);
  }
};

// ─────────────────────────────────────────────
// GET /usuarios/pin-list
// Lista para pantalla de selección de PIN
// Header requerido: X-Tenant-Id (debe ser UUID válido)
// ─────────────────────────────────────────────
const listarUsuariosParaPin = async (req, res) => {
  const tenantId = req.headers['x-tenant-id'];

  if (!tenantId) {
    return error(res, 'Header X-Tenant-Id requerido.', 400);
  }
  if (!esUuidValido(tenantId)) {
    return error(res, 'El header X-Tenant-Id no tiene un formato UUID válido.', 400);
  }

  try {
    const usuarios = await authService.listarUsuariosParaPin({ tenantId });
    return exito(res, { usuarios });
  } catch (err) {
    return manejarError(req, res, err);
  }
};

// ─────────────────────────────────────────────
// GET /usuarios
// ─────────────────────────────────────────────
const listarUsuarios = async (req, res) => {
  try {
    const usuarios = await authService.listarUsuarios({ tenantId: req.usuario.tenant_id });
    return exito(res, { usuarios });
  } catch (err) {
    return manejarError(req, res, err);
  }
};

// ─────────────────────────────────────────────
// GET /usuarios/:id
// Valida UUID antes de consultar
// ─────────────────────────────────────────────
const obtenerUsuario = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de usuario no tiene un formato UUID válido.', 400);
  }

  try {
    const usuario = await authService.obtenerUsuario({
      tenantId:  req.usuario.tenant_id,
      usuarioId: req.params.id,
    });
    return exito(res, { usuario });
  } catch (err) {
    return manejarError(req, res, err);
  }
};

// ─────────────────────────────────────────────
// POST /usuarios
// ─────────────────────────────────────────────
const crearUsuario = async (req, res) => {
  const { error: validacionError, value } = crearUsuarioSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const usuario = await authService.crearUsuario({
      tenantId: req.usuario.tenant_id,
      datos:    value,
    });
    return creado(res, { usuario }, 'Usuario creado exitosamente.');
  } catch (err) {
    return manejarError(req, res, err);
  }
};

// ─────────────────────────────────────────────
// PATCH /usuarios/:id
// Valida UUID antes de actualizar
// ─────────────────────────────────────────────
const actualizarUsuario = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de usuario no tiene un formato UUID válido.', 400);
  }

  const { error: validacionError, value } = actualizarUsuarioSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const usuario = await authService.actualizarUsuario({
      tenantId:  req.usuario.tenant_id,
      usuarioId: req.params.id,
      datos:     value,
    });
    return exito(res, { usuario }, 'Usuario actualizado exitosamente.');
  } catch (err) {
    return manejarError(req, res, err);
  }
};

// ─────────────────────────────────────────────
// POST /usuarios/:id/resetear-pin
// Valida UUID antes de resetear
// ─────────────────────────────────────────────
const resetearPin = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de usuario no tiene un formato UUID válido.', 400);
  }

  const pinNuevo = req.body?.pin_nuevo;
  if (!pinNuevo || !/^\d{6}$/.test(String(pinNuevo))) {
    return error(res, 'pin_nuevo debe tener exactamente 6 dígitos numéricos.', 400);
  }

  try {
    await authService.resetearPin({
      tenantId:  req.usuario.tenant_id,
      usuarioId: req.params.id,
      pinNuevo,
    });
    return exito(res, null, 'PIN reseteado exitosamente.');
  } catch (err) {
    return manejarError(req, res, err);
  }
};

// ─────────────────────────────────────────────
// GET /empresas — pública (listar tenants activos)
// ─────────────────────────────────────────────
const listarTenants = async (req, res) => {
  try {
    const tenants = await authService.listarTenants();
    return exito(res, { tenants });
  } catch (err) {
    return manejarError(req, res, err);
  }
};

module.exports = {
  loginEmail,
  loginPin,
  refresh,
  logout,
  me,
  cambiarPin,
  cambiarPassword,
  listarUsuarios,
  listarUsuariosParaPin,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  resetearPin,
  listarTenants,
};
