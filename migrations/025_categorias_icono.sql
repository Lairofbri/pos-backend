-- 025: Agregar columna icono a categorias
-- Permite asignar un emoji/icono a cada categoría para la navegación visual

ALTER TABLE categorias
  ADD COLUMN IF NOT EXISTS icono VARCHAR(10) DEFAULT NULL;

-- Asignar iconos por defecto basados en el nombre de la categoría
UPDATE categorias SET icono = '🧃' WHERE LOWER(nombre) LIKE '%bebida%' AND icono IS NULL;
UPDATE categorias SET icono = '🥤' WHERE LOWER(nombre) LIKE '%refresco%' AND icono IS NULL;
UPDATE categorias SET icono = '☕'  WHERE LOWER(nombre) LIKE '%café%' OR LOWER(nombre) LIKE '%cafe%' AND icono IS NULL;
UPDATE categorias SET icono = '💧'  WHERE LOWER(nombre) LIKE '%agua%' AND icono IS NULL;
UPDATE categorias SET icono = '🍕'  WHERE LOWER(nombre) LIKE '%pizza%' AND icono IS NULL;
UPDATE categorias SET icono = '🍔'  WHERE LOWER(nombre) LIKE '%hamburguesa%' AND icono IS NULL;
UPDATE categorias SET icono = '🍟'  WHERE LOWER(nombre) LIKE '%papa%' AND icono IS NULL;
UPDATE categorias SET icono = '🥗'  WHERE LOWER(nombre) LIKE '%ensalada%' AND icono IS NULL;
UPDATE categorias SET icono = '🥬'  WHERE LOWER(nombre) LIKE '%verde%' AND icono IS NULL;
UPDATE categorias SET icono = '🍰'  WHERE LOWER(nombre) LIKE '%pastel%' OR LOWER(nombre) LIKE '%torta%' AND icono IS NULL;
UPDATE categorias SET icono = '🍦'  WHERE LOWER(nombre) LIKE '%helado%' AND icono IS NULL;
UPDATE categorias SET icono = '🌮'  WHERE LOWER(nombre) LIKE '%extra%' AND icono IS NULL;
UPDATE categorias SET icono = '🌯'  WHERE LOWER(nombre) LIKE '%salsa%' AND icono IS NULL;
UPDATE categorias SET icono = '🧋'  WHERE LOWER(nombre) LIKE '%té%' OR LOWER(nombre) LIKE '%te%' AND icono IS NULL;
UPDATE categorias SET icono = '🥩'  WHERE LOWER(nombre) LIKE '%carne%' AND icono IS NULL;
UPDATE categorias SET icono = '🧀'  WHERE LOWER(nombre) LIKE '%queso%' AND icono IS NULL;
UPDATE categorias SET icono = '🥟'  WHERE LOWER(nombre) LIKE '%empanada%' AND icono IS NULL;
UPDATE categorias SET icono = '🥪'  WHERE LOWER(nombre) LIKE '%sandwich%' AND icono IS NULL;
UPDATE categorias SET icono = '🥨'  WHERE LOWER(nombre) LIKE '%pan%' AND icono IS NULL;
UPDATE categorias SET icono = '🥂'  WHERE LOWER(nombre) LIKE '%vino%' OR LOWER(nombre) LIKE '%cerveza%' AND icono IS NULL;
