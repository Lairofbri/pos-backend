const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const {
  R2_ENDPOINT,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
} = require('./env');
const logger = require('../utils/logger');

const MIME_TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_TAMANO_BYTES = 2 * 1024 * 1024;

// ── Detectar si R2 está configurado ──
const usarR2 = Boolean(R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);

let clienteR2, PutObjectCommand, DeleteObjectCommand;
if (usarR2) {
  const s3 = require('@aws-sdk/client-s3');
  PutObjectCommand = s3.PutObjectCommand;
  DeleteObjectCommand = s3.DeleteObjectCommand;
  clienteR2 = new s3.S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

const keyProducto = (tenantId, productoId) =>
  `tenants/${tenantId}/productos/${productoId}.webp`;

const urlPublica = (tenantId, productoId) => {
  if (usarR2) {
    const base = R2_PUBLIC_URL.replace(/\/+$/, '');
    return `${base}/${keyProducto(tenantId, productoId)}`;
  }
  return `/uploads/${keyProducto(tenantId, productoId)}`;
};

const rutaLocal = (tenantId, productoId) =>
  path.join(__dirname, '..', '..', 'uploads', keyProducto(tenantId, productoId));

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

  if (usarR2) {
    const key = keyProducto(tenantId, productoId);
    await clienteR2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
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

const eliminarImagen = async ({ tenantId, productoId }) => {
  if (usarR2) {
    const key = keyProducto(tenantId, productoId);
    try {
      await clienteR2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
      logger.info('Imagen eliminada de R2', { tenant_id: tenantId, producto_id: productoId });
    } catch (err) {
      if (err.name !== 'NoSuchKey') throw err;
    }
  } else {
    const ruta = rutaLocal(tenantId, productoId);
    try {
      await fs.unlink(ruta);
      logger.info('Imagen eliminada de local', { tenant_id: tenantId, producto_id: productoId });
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
};

module.exports = { subirImagen, eliminarImagen };