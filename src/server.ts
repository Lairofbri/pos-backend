import http from 'http';
import jwt from 'jsonwebtoken';
import { Server as SocketServer } from 'socket.io';
import type { Socket } from 'socket.io';
import app from './app.js';
import { env } from './shared/config/env.js';
const { PORT, CORS_ORIGINS, ES_PRODUCCION } = env;
import { verificarConexion } from './shared/config/database.js';
import { logger } from './shared/utils/logger.js';
import { iniciarCronDte } from './features/dte/cron.js';

const httpServer = http.createServer(app);

const io = new SocketServer(httpServer, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ES_PRODUCCION ? ['websocket'] : ['websocket', 'polling'],
});

type SocketAuth = { tenant_id?: string; usuario_id?: string };

const autenticarSocket = (socket: Socket, next: (err?: Error) => void) => {
  const token =
    socket.handshake.auth?.token ||
    (typeof socket.handshake.headers?.authorization === 'string'
      ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
      : undefined);

  if (!token) {
    return next(new Error('Token de autenticación requerido para Socket.io.'));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & {
      sub?: string;
      tenant_id?: string;
    };

    if (!decoded.tenant_id) {
      return next(new Error('Token sin tenant. Conexión rechazada.'));
    }

    (socket.data as SocketAuth) = {
      tenant_id: decoded.tenant_id,
      usuario_id: decoded.sub,
    };
    next();
  } catch (err) {
    logger.warn('Socket.io rechazó token inválido', { id: socket.id });
    next(new Error('Token inválido o expirado.'));
  }
};

io.use(autenticarSocket);

io.on('connection', (socket) => {
  const { tenant_id, usuario_id } = socket.data as SocketAuth;

  if (!tenant_id) {
    socket.disconnect(true);
    return;
  }

  // SEGURIDAD: la sala se deriva del JWT. El cliente NUNCA elige su tenant.
  socket.join(`tenant:${tenant_id}`);
  logger.debug('Cliente Socket.io conectado', { id: socket.id, tenant_id, usuario_id });

  socket.on('join:tenant', (tenantId: string) => {
    if (tenantId && tenantId !== tenant_id) {
      logger.warn('Socket.io intentó unirse a tenant ajeno', { id: socket.id, tenant_id, intento: tenantId });
    }
  });

  socket.on('disconnect', () => {
    logger.debug('Socket.io desconectado', { id: socket.id, tenant_id });
  });
});

export { io };

process.on('uncaughtException', (err: Error) => {
  logger.error('Excepción no capturada', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  const err = reason as { message?: string; stack?: string };
  logger.error('Promesa rechazada no manejada', {
    error: err?.message || String(reason),
    stack: err?.stack,
  });
  process.exit(1);
});

const arrancar = async () => {
  await verificarConexion();

  httpServer.listen(PORT, () => {
    logger.info(`POS Backend corriendo en puerto ${PORT}`, {
      entorno: process.env.NODE_ENV,
      puerto: PORT,
    });
    logger.info('Socket.io activo para tiempo real');
    iniciarCronDte();
  });

  const shutdown = (señal: string) => {
    logger.info(`Recibida señal ${señal}. Cerrando servidor limpiamente...`);
    httpServer.close(() => {
      logger.info('Servidor HTTP cerrado. Hasta pronto.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

arrancar().catch((err: Error) => {
  logger.error('Error fatal al arrancar el servidor', { error: err.message });
  process.exit(1);
});