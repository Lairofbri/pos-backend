import crypto from 'node:crypto';

// src/shared/utils/crypto.ts
// Cifrado de secretos en reposo para el POS Backend (Fase 1).
//
// Se usa para la API Key técnica de integración con DTE Service:
//   - AES-256-GCM: cifrado autenticado (detecta manipulación del ciphertext).
//   - KDF basado en scrypt (clave maestra → clave de 256 bits).
//   - Salt e IV aleatorios por operación.
//   - Formato versionado: "enc:v2:<salt>:<iv>:<authTag>:<ciphertext>".
//
// La clave maestra (POS_ENCRYPTION_KEY) se inyecta por parámetro: los
// llamadores la obtienen de env/Secret Manager, nunca de código o logs.

const PREFIJO_V2 = 'enc:v2:';

const derivarClave = (claveMaestra: string, salt: Buffer): Buffer =>
  crypto.scryptSync(claveMaestra, salt, 32);

export const encriptarTexto = (texto: string | null | undefined, claveMaestra: string): string | null => {
  if (!texto) return null;
  try {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const clave = derivarClave(claveMaestra, salt);

    const cipher = crypto.createCipheriv('aes-256-gcm', clave, iv);
    const ciphertext = Buffer.concat([cipher.update(String(texto), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return PREFIJO_V2 + [
      salt.toString('base64'),
      iv.toString('base64'),
      authTag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  } catch (err) {
    throw new Error(`Error al encriptar: ${(err as Error).message}`);
  }
};

export const desencriptarTexto = (
  textoEncriptado: string | null | undefined,
  claveMaestra: string
): string | null => {
  if (!textoEncriptado) return null;
  if (!textoEncriptado.startsWith(PREFIJO_V2)) {
    throw new Error('Formato de cifrado no soportado.');
  }

  const resto = textoEncriptado.slice(PREFIJO_V2.length);
  const [saltB64, ivB64, tagB64, dataB64] = resto.split(':');
  if (!saltB64 || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Formato de cifrado v2 inválido.');
  }

  const salt = Buffer.from(saltB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const clave = derivarClave(claveMaestra, salt);

  const decipher = crypto.createDecipheriv('aes-256-gcm', clave, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
};