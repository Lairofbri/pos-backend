// src/app.js
// Configuración central de Express: middlewares globales, rutas, manejo de errores

const path = require('path');
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const { CORS_ORIGINS, ES_PRODUCCION } = env;
const logger = require('./utils/logger');
const { noEncontrado, errorServidor } = require('./utils/response');
const { requestIdMiddleware } = require('./utils/requestId');

// ── Importar rutas de módulos ──
const authRoutes      = require('./modules/auth/auth.routes');
const productosRoutes = require('./modules/productos/productos.routes');
const posRoutes       = require('./modules/pos/pos.routes');
const clientesRoutes  = require('./modules/clientes/clientes.routes');
const cajaRoutes      = require('./modules/caja/caja.routes');
const permisosRoutes  = require('./modules/permisos/permisos.routes');
const combosRoutes    = require('./modules/combos/combos.routes');
const cocinaRoutes    = require('./modules/cocina/cocina.routes');
const menusRoutes     = require('./modules/menus/menus.routes');
const catalogosRoutes = require('./modules/catalogos/catalogos.routes');


const app = express();

// Trust proxy: Express lee X-Forwarded-For para IP real del cliente
// Detrás de Railway el rate-limit y logs de IP no funcionan sin esto
if (ES_PRODUCCION && env.TRUST_PROXY) {
  app.set('trust proxy', 1);
}

// ─────────────────────────────────────────────
// Request ID — correlación de logs (antes que cualquier middleware)
// ─────────────────────────────────────────────
app.use(requestIdMiddleware);

// ── Crear carpeta de uploads si no existe ──
const uploadsDir = path.join(__dirname, '..', 'uploads');
const fs = require('fs');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ── Servir archivos subidos localmente ──
app.use('/uploads', express.static(uploadsDir));

// ─────────────────────────────────────────────
// Middlewares de seguridad
// ─────────────────────────────────────────────

// Helmet: headers de seguridad HTTP (CSP se aplica solo a /api abajo)
app.use(helmet({ contentSecurityPolicy: false }));
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true }));
// CSP solo en rutas /api — /docs y /health quedan libres para Scalar
app.use(['/api', '/api/v1'], helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
  },
}));

// CORS: solo orígenes de la configuración (en dev permite todo para Postman/Scalar)
app.use(cors({
  origin: ES_PRODUCCION
    ? (origin, callback) => {
        if (!origin) return callback(null, true);
        if (CORS_ORIGINS.includes(origin)) return callback(null, true);
        callback(new Error('Origen no permitido por CORS'));
      }
    : true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id'],
  credentials: true,
}));

// Rate limiting global: 300 requests por IP cada 15 minutos
// Para endpoints de login, se aplica un límite más estricto en las rutas
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, mensaje: 'Demasiadas solicitudes. Intenta más tarde.' },
  skip: () => !ES_PRODUCCION, // Solo aplica en producción
}));

// Rate limiting estricto para endpoints de autenticación
const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { ok: false, mensaje: 'Demasiados intentos de login. Intenta en 15 minutos.' },
});
app.use('/api/auth/login',     limiteAuth);
app.use('/api/auth/login-pin',  limiteAuth);
app.use('/api/usuarios/pin-list', limiteAuth);
app.use('/api/v1/auth/login',     limiteAuth);
app.use('/api/v1/auth/login-pin',  limiteAuth);
app.use('/api/v1/usuarios/pin-list', limiteAuth);

// Rate limit para refresh de token — evita abuso en rotación de tokens
const limiteRefresh = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { ok: false, mensaje: 'Demasiadas solicitudes de refresh. Intenta más tarde.' },
});
app.use('/api/auth/refresh',  limiteRefresh);
app.use('/api/v1/auth/refresh', limiteRefresh);

// Parse JSON body + cookies
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Log de cada request (requestId se inyecta automáticamente vía AsyncLocalStorage)
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`, {
    tenant: req.headers['x-tenant-id'] || '-',
    ip: req.ip,
  });
  next();
});

// ─────────────────────────────────────────────
// Documentación API (Scalar) — solo en desarrollo
// ─────────────────────────────────────────────
if (!ES_PRODUCCION) {
  const { apiReference } = require('@scalar/express-api-reference');
  const path = require('path');

  app.get('/docs', apiReference({
    spec: { url: '/api/openapi.json' },
    theme: 'purple',
  }));

  app.get('/api/openapi.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/yaml');
    res.sendFile(path.join(__dirname, '..', 'docs', 'api', 'openapi.yaml'));
  });
}

// ─────────────────────────────────────────────
// Health check — para Railway y monitoreo
// ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV, timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────────
// Rutas de la API — versionadas (v1) y legacy
// ─────────────────────────────────────────────
const apiV1 = express.Router();
apiV1.use(authRoutes);
apiV1.use(productosRoutes);
apiV1.use(posRoutes);
apiV1.use(clientesRoutes);
apiV1.use(cajaRoutes);
apiV1.use(permisosRoutes);
apiV1.use(combosRoutes);
apiV1.use(cocinaRoutes);
apiV1.use(menusRoutes);
apiV1.use(catalogosRoutes);

app.use('/api/v1', apiV1);
app.use('/api',     apiV1); // backward compat — el frontend actual usa /api/
// ─────────────────────────────────────────────
// 404 — Ruta no encontrada
// ─────────────────────────────────────────────
app.use((_req, res) => {
  noEncontrado(res, 'Ruta no encontrada.');
});

// ─────────────────────────────────────────────
// Error handler global
// Captura errores no manejados que lleguen aquí vía next(err)
// ─────────────────────────────────────────────
app.use((err, req, res, _next) => {
  // Error de CORS
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ ok: false, mensaje: err.message });
  }

  logger.error('Error no capturado', {
    error: err.message,
    stack: ES_PRODUCCION ? undefined : err.stack,
    ruta: req.path,
    requestId: req.requestId,
  });

  return errorServidor(res);
});

module.exports = app;
