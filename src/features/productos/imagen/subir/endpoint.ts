import { Router } from 'express';
import { requierePermiso } from '../../../../shared/middlewares/permisos.middleware.js';
import { validarUuidParam } from '../../../../shared/middlewares/uuid.middleware.js';
import multer from 'multer';
import { subirImagen } from './handler.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const permitidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (!permitidos.includes(file.mimetype)) {
      cb(new Error('Formato de imagen no permitido. Solo JPEG, PNG y WebP.'));
      return;
    }
    cb(null, true);
  },
});

const router = Router({ mergeParams: true });

router.post('/productos/:id/imagen', validarUuidParam('id', 'producto'), requierePermiso('productos.editar'), upload.single('imagen'), subirImagen);

export default router;
