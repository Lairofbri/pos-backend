import http from 'http';
import jwt from 'jsonwebtoken';
import { Server as SocketServer } from 'socket.io';
import app from './app.js';
import { env } from './shared/config/env.js';
const { PORT, CORS_ORIGINS, ES_PRODUCCION } = env;
import { verificarConexion } from './shared/config/database.js';
import { logger } from './shared/utils/logger.js';
import { iniciarCronDte } from './features/dte/cron.js';
import { iniciarCronAlertas } from './features/alertas/cron.js';

const httpServer = http.createServer(app);

const io = new SocketServer(httpServer, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ES_PRODUCCION ? ['websocket'] : ['websocket', 'polling'],
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (typeof token !== 'string' || !token) {
    return next(new Error('Socket authentication required'));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { tenant_id?: string };
    if (!decoded.tenant_id) return next(new Error('Socket tenant missing'));
    socket.data.tenantId = decoded.tenant_id;
    return next();
  } catch {
    return next(new Error('Invalid socket token'));
  }
});

io.on('connection', (socket) => {
  logger.debug('Cliente Socket.io conectado', { id: socket.id });
  const tenantId = socket.data.tenantId as string;
  socket.join(`tenant:${tenantId}`);
  logger.debug(`Socket unido a sala tenant:${tenantId}`);

  socket.on('disconnect', () => {
    logger.debug('Cliente Socket.io desconectado', { id: socket.id });
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
    iniciarCronAlertas();
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
