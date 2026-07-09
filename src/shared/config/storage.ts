import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const MIME_TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_TAMANO_BYTES = 2 * 1024 * 1024;

const usarR2 = Boolean(env.R2_ENDPOINT && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY);

type ClienteS3 = InstanceType<typeof import('@aws-sdk/client-s3').S3Client>;

let clienteR2: ClienteS3 | undefined;
let PutObjectCommand: typeof import('@aws-sdk/client-s3').PutObjectCommand;
let DeleteObjectCommand: typeof import('@aws-sdk/client-s3').DeleteObjectCommand;

if (usarR2) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const s3 = require('@aws-sdk/client-s3') as typeof import('@aws-sdk/client-s3');
  PutObjectCommand = s3.PutObjectCommand;
  DeleteObjectCommand = s3.DeleteObjectCommand;
  clienteR2 = new s3.S3Client({
    region: 'auto',
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
}

const keyProducto = (tenantId: string, productoId: string) =>
  `tenants/${tenantId}/productos/${productoId}.webp`;

const urlPublica = (tenantId: string, productoId: string) => {
  if (usarR2) {
    const base = env.R2_PUBLIC_URL.replace(/\/+$/, '');
    return `${base}/${keyProducto(tenantId, productoId)}`;
  }
  return `/uploads/${keyProducto(tenantId, productoId)}`;
};

const rutaLocal = (tenantId: string, productoId: string) =>
  path.join(__dirname, '..', '..', '..', 'uploads', keyProducto(tenantId, productoId));

type SubirImagenParams = {
  tenantId: string;
  productoId: string;
  buffer: Buffer;
  mimetype: string;
};

type EliminarImagenParams = {
  tenantId: string;
  productoId: string;
};

export const subirImagen = async ({ tenantId, productoId, buffer, mimetype }: SubirImagenParams) => {
  if (!MIME_TIPOS_PERMITIDOS.includes(mimetype)) {
    throw { status: 400, mensaje: 'Formato de imagen no permitido. Solo JPEG, PNG y WebP.' };
  }

  if (buffer.length > MAX_TAMANO_BYTES) {
    throw { status: 400, mensaje: 'La imagen no puede superar los 2MB.' };
  }

  const webpBuffer = await sharp(buffer)
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  if (usarR2 && clienteR2) {
    const key = keyProducto(tenantId, productoId);
    await clienteR2.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        Body: webpBuffer,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
    logger.info('Imagen subida a R2', { tenant_id: tenantId, producto_id: productoId });
  } else {
    const ruta = rutaLocal(tenantId, productoId);
    await fs.mkdir(path.dirname(ruta), { recursive: true });
    await fs.writeFile(ruta, webpBuffer);
    logger.info('Imagen guardada en local', { tenant_id: tenantId, producto_id: productoId, ruta });
  }

  const url = urlPublica(tenantId, productoId);
  return url;
};

export const eliminarImagen = async ({ tenantId, productoId }: EliminarImagenParams) => {
  if (usarR2 && clienteR2) {
    const key = keyProducto(tenantId, productoId);
    try {
      await clienteR2.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }));
      logger.info('Imagen eliminada de R2', { tenant_id: tenantId, producto_id: productoId });
    } catch (err) {
      if ((err as { name?: string }).name !== 'NoSuchKey') throw err;
    }
  } else {
    const ruta = rutaLocal(tenantId, productoId);
    try {
      await fs.unlink(ruta);
      logger.info('Imagen eliminada de local', { tenant_id: tenantId, producto_id: productoId });
    } catch (err) {
      if ((err as { code?: string }).code !== 'ENOENT') throw err;
    }
  }
};
