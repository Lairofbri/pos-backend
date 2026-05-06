// src/app.js
// Configuración central de Express: middlewares globales, rutas, manejo de errores

const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const rateLimit = require('express-rate-limit');
const { CORS_ORIGINS, ES_PRODUCCION } = require('./config/env');
const logger = require('./utils/logger');
const { noEncontrado, errorServidor } = require('./utils/response');

// ── Importar rutas de módulos ──
const authRoutes      = require('./modules/auth/auth.routes');
const productosRoutes = require('./modules/productos/productos.routes');
const posRoutes       = require('./modules/pos/pos.routes');
const clientesRoutes  = require('./modules/clientes/clientes.routes');
const cajaRoutes      = require('./modules/caja/caja.routes');
// Aquí se irán agregando los demás módulos:


const app = express();

// ─────────────────────────────────────────────
// Middlewares de seguridad
// ─────────────────────────────────────────────

// Helmet: headers de seguridad HTTP
app.use(helmet());

// CORS: solo orígenes de la configuración
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (Electron, apps móviles, Postman en dev)
    if (!origin) return callback(null, true);
    if (CORS_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
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
app.use('/api/auth/login', limiteAuth);
app.use('/api/auth/login-pin', limiteAuth);

// Parse JSON body
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

// Log de cada request (solo en desarrollo)
if (!ES_PRODUCCION) {
  app.use((req, _res, next) => {
    logger.debug(`${req.method} ${req.path}`, {
      tenant: req.headers['x-tenant-id'] || '-',
      ip: req.ip,
    });
    next();
  });
}

// ─────────────────────────────────────────────
// Health check — para Railway y monitoreo
// ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV, timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────────
// Rutas de la API
// ─────────────────────────────────────────────
app.use('/api', authRoutes);
app.use('/api', productosRoutes);
app.use('/api', posRoutes);
app.use('/api', clientesRoutes);
app.use('/api', cajaRoutes);


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
  });

  return errorServidor(res);
});

module.exports = app;
