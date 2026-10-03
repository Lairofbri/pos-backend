import 'dotenv/config';

const requerida = (nombre: string): string => {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Variable de entorno requerida no definida: ${nombre}`);
  }
  return valor;
};

const opcionalInt = (nombre: string, porDefecto: number): number => {
  const valor = process.env[nombre];
  return valor ? parseInt(valor, 10) : porDefecto;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: opcionalInt('PORT', 3000),
  ES_PRODUCCION: process.env.NODE_ENV === 'production',
  TRUST_PROXY: process.env.TRUST_PROXY !== 'false',

  DATABASE_URL: requerida('DATABASE_URL'),
  DB_SSL_REJECT_UNAUTHORIZED: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',

  JWT_SECRET: (() => {
    const secret = requerida('JWT_SECRET');
    if (secret.length < 64) {
      throw new Error(
        '[POS-BACKEND] JWT_SECRET debe tener al menos 64 caracteres (256 bits mínimo).\n' +
        'Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
      );
    }
    return secret;
  })(),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '15m',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? '', // Ya no requerido — migrado a opaque tokens
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',

  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim()),

  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',

  R2_ENDPOINT: process.env.R2_ENDPOINT ?? '',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ?? '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ?? '',
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME ?? 'pos-productos',
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL ?? '',

  DTE_SERVICE_URL: process.env.DTE_SERVICE_URL ?? 'http://localhost:4000',
  DTE_API_KEY: process.env.DTE_API_KEY ?? '',
  DTE_TIMEOUT: opcionalInt('DTE_TIMEOUT', 10000),

  // Provisión interna POS ↔ DTE (Fase 2):
  // INTERNAL_API_KEY valida eventos entrantes del DTE Service.
  // DTE_INTERNAL_API_KEY se envía al DTE Service en /internal/provisioning/*.
  // Son claves servidor-a-servidor, DISTINTAS de la API Key técnica del
  // tenant y de las credenciales Hacienda. Opcionales: si no están
  // configuradas, las rutas internas fallan cerradas.
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY ?? '',
  DTE_INTERNAL_API_KEY: process.env.DTE_INTERNAL_API_KEY ?? '',

  // Clave maestra para cifrar secretos en reposo (p.ej. dte_api_key_enc).
  // AES-256-GCM vía scrypt — ver src/shared/utils/crypto.ts.
  // OBLIGATORIA: sin ella el servicio no arranca (fail-fast).
  POS_ENCRYPTION_KEY: (() => {
    const clave = requerida('POS_ENCRYPTION_KEY');
    if (clave.length < 32) {
      throw new Error(
        '[POS-BACKEND] POS_ENCRYPTION_KEY debe tener al menos 32 caracteres.\n' +
        'Genera una con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
      );
    }
    return clave;
  })(),
} as const;

export type Env = typeof env;
