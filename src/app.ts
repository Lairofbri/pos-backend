import path from 'path';
import fs from 'fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import { env } from './shared/config/env.js';
const { CORS_ORIGINS, ES_PRODUCCION } = env;
import { logger } from './shared/utils/logger.js';
import { noEncontrado, errorServidor } from './shared/utils/response.js';
import { requestIdMiddleware } from './shared/utils/requestId.js';
import { resolverSucursal } from './shared/middlewares/sucursal.middleware.js';

import authRoutes from './features/auth/routes.js';
import productosRoutes from './features/productos/routes.js';
import posRoutes from './features/pos/routes.js';
import clientesRoutes from './features/clientes/routes.js';
import cajaRoutes from './features/caja/routes.js';
import impresionRoutes from './features/impresion/routes.js';
import catalogosRoutes from './features/catalogos/routes.js';
import cocinaRoutes from './features/cocina/routes.js';
import combosRoutes from './features/combos/routes.js';
import menusRoutes from './features/menus/routes.js';
import permisosRoutes from './features/permisos/routes.js';
import dteRoutes from './features/dte/routes.js';
import adminRoutes from './features/admin/routes.js';

const app = express();

if (ES_PRODUCCION && env.TRUST_PROXY) {
  app.set('trust proxy', 1);
}

app.use(requestIdMiddleware);

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/uploads', express.static(uploadsDir));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true }));
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

app.use(cors({
  origin: ES_PRODUCCION
    ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) return callback(null, true);
        if (CORS_ORIGINS.includes(origin)) return callback(null, true);
        callback(new Error('Origen no permitido por CORS'));
      }
    : true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'X-Sucursal-Id'],
  credentials: true,
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, mensaje: 'Demasiadas solicitudes. Intenta más tarde.' },
  skip: () => !ES_PRODUCCION,
}));

const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { ok: false, mensaje: 'Demasiados intentos de login. Intenta en 15 minutos.' },
});
app.use('/api/auth/login', limiteAuth);
app.use('/api/auth/login-pin', limiteAuth);
app.use('/api/v1/auth/login', limiteAuth);
app.use('/api/v1/auth/login-pin', limiteAuth);

const limitePinList = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { ok: false, mensaje: 'Demasiadas solicitudes. Intenta más tarde.' },
});
app.use('/api/usuarios/pin-list', limitePinList);
app.use('/api/v1/usuarios/pin-list', limitePinList);

const limiteRefresh = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { ok: false, mensaje: 'Demasiadas solicitudes de refresh. Intenta más tarde.' },
});
app.use('/api/auth/refresh', limiteRefresh);
app.use('/api/v1/auth/refresh', limiteRefresh);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.debug(`${req.method} ${req.path}`, {
    tenant: req.headers['x-tenant-id'] ?? '-',
    ip: req.ip,
  });
  next();
});

if (!ES_PRODUCCION) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { apiReference } = require('@scalar/express-api-reference') as typeof import('@scalar/express-api-reference');

  app.get('/docs', apiReference({
    spec: { url: '/api/openapi.json' },
    theme: 'purple',
  }));

  app.get('/api/openapi.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/yaml');
    res.sendFile(path.join(__dirname, '..', 'docs', 'api', 'openapi.yaml'));
  });
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, env: process.env.NODE_ENV, timestamp: new Date().toISOString() });
});

const apiV1 = express.Router();
apiV1.use(authRoutes);
apiV1.use(resolverSucursal);
apiV1.use(productosRoutes);
apiV1.use(posRoutes);
apiV1.use(clientesRoutes);
apiV1.use(cajaRoutes);
apiV1.use(permisosRoutes);
apiV1.use(combosRoutes);
apiV1.use(cocinaRoutes);
apiV1.use(menusRoutes);
apiV1.use(catalogosRoutes);
apiV1.use(impresionRoutes);
apiV1.use(dteRoutes);
apiV1.use(adminRoutes);

app.use('/api/v1', apiV1);
app.use('/api', apiV1);

app.use((_req: Request, res: Response) => {
  noEncontrado(res, 'Ruta no encontrada.');
});

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
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

export default app;
