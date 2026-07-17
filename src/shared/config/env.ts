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

  JWT_SECRET: requerida('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '1h',
  JWT_REFRESH_SECRET: requerida('JWT_REFRESH_SECRET'),
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
} as const;

export type Env = typeof env;
