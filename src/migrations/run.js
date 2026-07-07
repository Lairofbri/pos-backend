// src/migrations/run.js
// Ejecuta todas las migraciones SQL en orden numérico
// Uso: node src/migrations/run.js
// O con npm: npm run migrate

const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { query, verificarConexion } = require('../config/database');
const logger = require('../utils/logger');

// Tabla interna para registrar qué migraciones ya se ejecutaron
const CREAR_TABLA_MIGRACIONES = `
  CREATE TABLE IF NOT EXISTS _migraciones (
    id          SERIAL PRIMARY KEY,
    archivo     VARCHAR(255) UNIQUE NOT NULL,
    hash        VARCHAR(64),
    ejecutado_en TIMESTAMPTZ DEFAULT NOW()
  );
`;

const hashFile = (ruta) => {
  const contenido = fs.readFileSync(ruta, 'utf8');
  return createHash('sha256').update(contenido).digest('hex');
};

const ejecutarMigraciones = async () => {
  logger.info('Iniciando proceso de migraciones...');
  await verificarConexion();

  // Crear tabla de control si no existe
  await query(CREAR_TABLA_MIGRACIONES);

  // Migrar tabla si existe sin columna hash
  try {
    await query('ALTER TABLE _migraciones ADD COLUMN IF NOT EXISTS hash VARCHAR(64)');
  } catch { /* ignorar si ya existe */ }

  // Leer migraciones ya ejecutadas
  const { rows: ejecutadas } = await query(
    'SELECT archivo, hash FROM _migraciones ORDER BY id'
  );
  const mapaEjecutadas = new Map(ejecutadas.map((r) => [r.archivo, r.hash]));

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
    const rutaCompleta = path.join(carpetaMigraciones, archivo);

    // Calcular hash actual del archivo
    const hashActual = hashFile(rutaCompleta);

    // Verificar si ya se ejecutó y si el hash coincide
    if (mapaEjecutadas.has(archivo)) {
      const hashPrevio = mapaEjecutadas.get(archivo);
      // Si no hay hash previo (migración anterior al tracking), no podemos detectar cambios
      if (!hashPrevio) {
        logger.debug(`Migración sin hash de referencia, saltando: ${archivo}`);
        continue;
      }
      if (hashPrevio === hashActual) {
        logger.debug(`Migración sin cambios, saltando: ${archivo}`);
        continue;
      }
      logger.info(`Migración modificada, re-ejecutando: ${archivo}`);
      await query('DELETE FROM _migraciones WHERE archivo = $1', [archivo]);
    }

    const sql = fs.readFileSync(rutaCompleta, 'utf8');

    logger.info(`Ejecutando migración: ${archivo}`);

    try {
      await query(sql);
      await query(
        'INSERT INTO _migraciones (archivo, hash) VALUES ($1, $2)',
        [archivo, hashActual]
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
