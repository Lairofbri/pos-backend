const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const {
  R2_ENDPOINT,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
} = require('./env');
const logger = require('../utils/logger');

const cliente = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const keyProducto = (tenantId, productoId) =>
  `tenants/${tenantId}/productos/${productoId}.webp`;

const urlPublica = (tenantId, productoId) => {
  const base = R2_PUBLIC_URL.replace(/\/+$/, '');
  return `${base}/${keyProducto(tenantId, productoId)}`;
};

const MIME_TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];

const MAX_TAMANO_BYTES = 2 * 1024 * 1024;

const subirImagen = async ({ tenantId, productoId, buffer, mimetype }) => {
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

  const key = keyProducto(tenantId, productoId);

  await cliente.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: webpBuffer,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  const url = urlPublica(tenantId, productoId);
  logger.info('Imagen subida a R2', { tenant_id: tenantId, producto_id: productoId, key });

  return url;
};

const eliminarImagen = async ({ tenantId, productoId }) => {
  const key = keyProducto(tenantId, productoId);

  try {
    await cliente.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );
    logger.info('Imagen eliminada de R2', { tenant_id: tenantId, producto_id: productoId, key });
  } catch (err) {
    if (err.name === 'NoSuchKey') {
      return;
    }
    throw err;
  }
};

module.exports = { subirImagen, eliminarImagen };
