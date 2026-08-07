-- Migración 050: Categoría 'cocina' + unidades de medida completas para recetas
-- Agrega ~18 unidades nuevas, migra taza/cda/cdta/pizca a categoría 'cocina', y relaja el CHECK

-- 1. Relajar CHECK constraint para aceptar categoría 'cocina'
ALTER TABLE unidades_medida DROP CONSTRAINT IF EXISTS unidades_medida_categoria_check;
ALTER TABLE unidades_medida ADD CONSTRAINT unidades_medida_categoria_check
  CHECK (categoria IN ('masa', 'volumen', 'unidad', 'cocina'));

-- 2. Migrar unidades híbridas a la nueva categoría 'cocina'
UPDATE unidades_medida SET categoria = 'cocina'
WHERE abreviatura IN ('taza', 'cda', 'cdta', 'pizca');

-- 3. Nuevas unidades de masa
INSERT INTO unidades_medida (id, tenant_id, nombre, abreviatura, categoria, factor)
SELECT gen_random_uuid(), t.id, v.nombre, v.abreviatura, v.categoria, v.factor
FROM tenants t
CROSS JOIN (VALUES
    ('Onza',          'ozm',  'masa',     28.3495)
) AS v(nombre, abreviatura, categoria, factor)
ON CONFLICT (tenant_id, abreviatura) DO NOTHING;

-- 4. Nuevas unidades de volumen
INSERT INTO unidades_medida (id, tenant_id, nombre, abreviatura, categoria, factor)
SELECT gen_random_uuid(), t.id, v.nombre, v.abreviatura, v.categoria, v.factor
FROM tenants t
CROSS JOIN (VALUES
    ('Galón',         'gal',  'volumen',  3785.41)
) AS v(nombre, abreviatura, categoria, factor)
ON CONFLICT (tenant_id, abreviatura) DO NOTHING;

-- 5. Nuevas unidades de tipo 'unidad' (jerga de cocina)
INSERT INTO unidades_medida (id, tenant_id, nombre, abreviatura, categoria, factor)
SELECT gen_random_uuid(), t.id, v.nombre, v.abreviatura, v.categoria, v.factor
FROM tenants t
CROSS JOIN (VALUES
    ('Pieza',         'pza',   'unidad',   1),
    ('Diente',        'diente','unidad',   1),
    ('Manojo',        'manojo','unidad',   1),
    ('Rama',          'rama',  'unidad',   1),
    ('Hoja',          'hoja',  'unidad',   1),
    ('Lata',          'lata',  'unidad',   1),
    ('Sobre',         'sobre', 'unidad',   1),
    ('Rodaja',        'rodaja','unidad',   1),
    ('Paquete',       'paq',   'unidad',   1),
    ('Bolsa',         'bolsa', 'unidad',   1),
    ('Caja',          'caja',  'unidad',   1),
    ('Ración',        'racion','unidad',   1)
) AS v(nombre, abreviatura, categoria, factor)
ON CONFLICT (tenant_id, abreviatura) DO NOTHING;

-- 6. Nuevas unidades de cocina (híbridas masa/volumen)
INSERT INTO unidades_medida (id, tenant_id, nombre, abreviatura, categoria, factor)
SELECT gen_random_uuid(), t.id, v.nombre, v.abreviatura, v.categoria, v.factor
FROM tenants t
CROSS JOIN (VALUES
    ('Vaso',          'vaso',  'cocina',   250),
    ('Copa',          'copa',  'cocina',   200),
    ('Chorro',        'chorro','cocina',   15),
    ('Puñado',        'punado','cocina',   30)
) AS v(nombre, abreviatura, categoria, factor)
ON CONFLICT (tenant_id, abreviatura) DO NOTHING;
