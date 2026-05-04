// src/server.js
// Punto de entrada: levanta el servidor HTTP y Socket.io

const http = require('http');
const { Server: SocketServer } = require('socket.io');
const app = require('./app');
const { PORT, CORS_ORIGINS, ES_PRODUCCION } = require('./config/env');
const { verificarConexion } = require('./config/database');
const logger = require('./utils/logger');

const httpServer = http.createServer(app);

// ─────────────────────────────────────────────
// Socket.io — tiempo real para el panel admin
// ─────────────────────────────────────────────
const io = new SocketServer(httpServer, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // En producción solo WebSocket, en dev también polling (más fácil para debuggear)
  transports: ES_PRODUCCION ? ['websocket'] : ['websocket', 'polling'],
});

// Namespace para el panel admin en tiempo real
// Cada tenant se une a su propia sala: tenant:<tenant_id>
io.on('connection', (socket) => {
  logger.debug('Cliente Socket.io conectado', { id: socket.id });

  // El cliente envía su tenant_id al conectarse
  socket.on('join:tenant', (tenantId) => {
    if (tenantId) {
      socket.join(`tenant:${tenantId}`);
      logger.debug(`Socket unido a sala tenant:${tenantId}`);
    }
  });

  socket.on('disconnect', () => {
    logger.debug('Cliente Socket.io desconectado', { id: socket.id });
  });
});

// Exportar io para usarlo en otros módulos (ej: emitir eventos desde el servicio de ventas)
module.exports.io = io;

// ─────────────────────────────────────────────
// Arrancar el servidor
// ─────────────────────────────────────────────
const arrancar = async () => {
  // Verificar conexión a BD antes de aceptar tráfico
  await verificarConexion();

  httpServer.listen(PORT, () => {
    logger.info(`POS Backend corriendo en puerto ${PORT}`, {
      entorno: process.env.NODE_ENV,
      puerto: PORT,
    });
    logger.info('Socket.io activo para tiempo real');
  });

  // Manejo de shutdown limpio (Railway envía SIGTERM antes de detener el contenedor)
  const shutdown = (señal) => {
    logger.info(`Recibida señal ${señal}. Cerrando servidor limpiamente...`);
    httpServer.close(() => {
      logger.info('Servidor HTTP cerrado. Hasta pronto.');
      process.exit(0);
    });
    // Si no cierra en 10s, forzar
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
};

arrancar().catch((err) => {
  logger.error('Error fatal al arrancar el servidor', { error: err.message });
  process.exit(1);
});
