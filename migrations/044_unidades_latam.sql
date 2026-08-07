-- Migración 044: Unidades de medida LATAM / cocina
-- Agrega unidades comunes en cocina centroamericana (taza, cucharada, cucharadita, pizca, porción)

INSERT INTO unidades_medida (id, tenant_id, nombre, abreviatura, categoria, factor)
SELECT
    gen_random_uuid(), t.id, v.nombre, v.abreviatura, v.categoria, v.factor
FROM tenants t
CROSS JOIN (VALUES
    ('Taza',          'taza',  'volumen',  240),
    ('Cucharada',     'cda',   'volumen',  15),
    ('Cucharadita',   'cdta',  'volumen',  5),
    ('Pizca',         'pizca', 'masa',     0.36),
    ('Porción',       'porc',  'unidad',   1)
) AS v(nombre, abreviatura, categoria, factor)
ON CONFLICT (tenant_id, abreviatura) DO NOTHING;
