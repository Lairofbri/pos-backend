// src/migrations/run.js
// Ejecuta todas las migraciones SQL en orden numérico
// Uso: node src/migrations/run.js
// O con npm: npm run migrate

const fs = require('fs');
const path = require('path');
const { query, verificarConexion } = require('../config/database');
const logger = require('../utils/logger');

// Tabla interna para registrar qué migraciones ya se ejecutaron
const CREAR_TABLA_MIGRACIONES = `
  CREATE TABLE IF NOT EXISTS _migraciones (
    id          SERIAL PRIMARY KEY,
    archivo     VARCHAR(255) UNIQUE NOT NULL,
    ejecutado_en TIMESTAMPTZ DEFAULT NOW()
  );
`;

const ejecutarMigraciones = async () => {
  logger.info('Iniciando proceso de migraciones...');
  await verificarConexion();

  // Crear tabla de control si no existe
  await query(CREAR_TABLA_MIGRACIONES);

  // Leer migraciones ya ejecutadas
  const { rows: ejecutadas } = await query(
    'SELECT archivo FROM _migraciones ORDER BY id'
  );
  const yaEjecutadas = new Set(ejecutadas.map((r) => r.archivo));

  // Leer archivos .sql de la carpeta migrations/ en la raíz del proyecto
  const carpetaMigraciones = path.join(__dirname, '..', '..', 'migrations');
  
  if (!fs.existsSync(carpetaMigraciones)) {
    logger.warn('Carpeta migrations/ no encontrada. No hay nada que ejecutar.');
    process.exit(0);
  }

  const archivos = fs
    .readdirSync(carpetaMigraciones)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // Ordenar numéricamente por nombre: 001_, 002_, etc.

  let ejecutadas_ahora = 0;

  for (const archivo of archivos) {
    if (yaEjecutadas.has(archivo)) {
      logger.debug(`Migración ya ejecutada, saltando: ${archivo}`);
      continue;
    }

    const rutaCompleta = path.join(carpetaMigraciones, archivo);
    const sql = fs.readFileSync(rutaCompleta, 'utf8');

    logger.info(`Ejecutando migración: ${archivo}`);

    try {
      // Ejecutar migración y registrarla — ambos en la misma query secuencial
      await query(sql);
      await query(
        'INSERT INTO _migraciones (archivo) VALUES ($1)',
        [archivo]
      );
      logger.info(`Migración completada: ${archivo}`);
      ejecutadas_ahora++;
    } catch (err) {
      logger.error(`Error en migración ${archivo}`, { error: err.message });
      process.exit(1);
    }
  }

  if (ejecutadas_ahora === 0) {
    logger.info('Todo al día. No hay migraciones pendientes.');
  } else {
    logger.info(`Migraciones completadas: ${ejecutadas_ahora}`);
  }

  process.exit(0);
};

ejecutarMigraciones();
