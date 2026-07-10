import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { query, verificarConexion } from '../shared/config/database.js';
import { logger } from '../shared/utils/logger.js';

const CREAR_TABLA_MIGRACIONES = `
  CREATE TABLE IF NOT EXISTS _migraciones (
    id          SERIAL PRIMARY KEY,
    archivo     VARCHAR(255) UNIQUE NOT NULL,
    hash        VARCHAR(64),
    ejecutado_en TIMESTAMPTZ DEFAULT NOW()
  );
`;

interface MigracionRow {
  archivo: string;
  hash: string;
}

const hashFile = (ruta: string) => {
  const contenido = fs.readFileSync(ruta, 'utf8');
  return createHash('sha256').update(contenido).digest('hex');
};

const ejecutarMigraciones = async () => {
  logger.info('Iniciando proceso de migraciones...');
  await verificarConexion();

  await query(CREAR_TABLA_MIGRACIONES);

  try {
    await query('ALTER TABLE _migraciones ADD COLUMN IF NOT EXISTS hash VARCHAR(64)');
  } catch { /* already exists */ }

  const { rows: ejecutadas } = await query(
    'SELECT archivo, hash FROM _migraciones ORDER BY id'
  ) as unknown as { rows: MigracionRow[] };
  const mapaEjecutadas = new Map(ejecutadas.map((r) => [r.archivo, r.hash]));

  const carpetaMigraciones = path.join(process.cwd(), 'migrations');

  if (!fs.existsSync(carpetaMigraciones)) {
    logger.warn('Carpeta migrations/ no encontrada. No hay nada que ejecutar.');
    process.exit(0);
  }

  const archivos = fs
    .readdirSync(carpetaMigraciones)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let ejecutadasAhora = 0;

  for (const archivo of archivos) {
    const rutaCompleta = path.join(carpetaMigraciones, archivo);
    const hashActual = hashFile(rutaCompleta);

    if (mapaEjecutadas.has(archivo)) {
      const hashPrevio = mapaEjecutadas.get(archivo);
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
      ejecutadasAhora++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Error en migración ${archivo}`, { error: message });
      process.exit(1);
    }
  }

  if (ejecutadasAhora === 0) {
    logger.info('Todo al día. No hay migraciones pendientes.');
  } else {
    logger.info(`Migraciones completadas: ${ejecutadasAhora}`);
  }

  process.exit(0);
};

ejecutarMigraciones();
