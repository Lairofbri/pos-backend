# Permisos 100% en PostgreSQL

Mover toda la lógica de permisos, catálogo y defaults desde JavaScript hardcodeado a funciones y tablas en PostgreSQL.

## Problema

El sistema actual tiene **4 fuentes de verdad** para los mismos datos:

| Ubicación | Qué tiene | Líneas |
|-----------|-----------|--------|
| `migrations/007_permisos.sql` | 43 INSERTs del catálogo | ~90 |
| `permisos.service.js` | `CATALOGO` (43 ítems) + `ROLES_VALIDOS` | ~45 |
| `migrations/seed.js` | `PERMISOS_DEFAULT` (215 valores) | ~72 |
| `permisos.schema.js` | `ROLES_VALIDOS` duplicado | ~3 |

Agregar un permiso nuevo requiere editar **4 archivos**. Los defaults por rol están hardcodeados en JS y no se pueden modificar sin deploy.

## Solución

Todo el conocimiento de permisos vive en PostgreSQL. JavaScript solo llama funciones.

### Nuevo objeto: tabla `permisos_default`

```sql
CREATE TABLE permisos_default (
  rol       VARCHAR(50) NOT NULL,
  permiso_id UUID NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
  activo    BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (rol, permiso_id)
);
```

Contiene los permisos que vienen activos por defecto para cada rol cuando se crea un tenant. Se inserta una vez desde el seed y no se toca más.

### Nuevas funciones PostgreSQL

#### 1. `fn_tiene_permiso` — middleware

```sql
CREATE FUNCTION fn_tiene_permiso(
  p_rol VARCHAR, p_codigo VARCHAR, p_tenant_id UUID
) RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT COALESCE((
    SELECT rp.activo FROM rol_permisos rp
    JOIN permisos p ON p.id = rp.permiso_id
    WHERE rp.rol = p_rol AND p.codigo = p_codigo AND rp.tenant_id = p_tenant_id
  ), false);
$$;
```

Reemplaza la query inline en `permisos.middleware.js`.

#### 2. `fn_permisos_rol` — endpoint GET /api/permisos/rol/:rol

```sql
CREATE FUNCTION fn_permisos_rol(
  p_rol VARCHAR, p_tenant_id UUID
) RETURNS TABLE(modulo VARCHAR, codigo VARCHAR, nombre VARCHAR, activo BOOLEAN)
LANGUAGE SQL STABLE
AS $$
  SELECT p.modulo, p.codigo, p.nombre,
    COALESCE(rp.activo, false) AS activo
  FROM permisos p
  LEFT JOIN rol_permisos rp ON rp.permiso_id = p.id
    AND rp.rol = p_rol AND rp.tenant_id = p_tenant_id
  ORDER BY p.modulo, p.codigo;
$$;
```

#### 3. `fn_roles_validos` — endpoint GET /api/permisos/roles

```sql
CREATE FUNCTION fn_roles_validos() RETURNS VARCHAR[]
LANGUAGE SQL STABLE
AS $$
  SELECT ARRAY_AGG(DISTINCT rol ORDER BY rol) FROM permisos_default;
$$;
```

#### 4. `fn_sembrar_permisos_tenant` — al crear tenant

```sql
CREATE PROCEDURE sp_sembrar_permisos_tenant(p_tenant_id UUID)
LANGUAGE SQL
AS $$
  INSERT INTO rol_permisos (rol, permiso_id, tenant_id, activo)
  SELECT d.rol, d.permiso_id, p_tenant_id, d.activo
  FROM permisos_default d
  ON CONFLICT (rol, permiso_id, tenant_id) DO NOTHING;
$$;
```

### Lo que cambia en JS

#### `src/modules/permisos/permisos.service.js`

Antes: 169 líneas con CATALOGO hardcodeado + lógica.
Después: ~30 líneas, solo llama funciones.

```js
const { query } = require('../../config/database');

const listarCatalogo = async () => {
  const { rows } = await query('SELECT id, codigo, nombre, descripcion, modulo AS grupo FROM permisos ORDER BY modulo, codigo');
  return rows;
};

const obtenerPermisosRol = async ({ tenantId, rol }) => {
  const { rows } = await query('SELECT * FROM fn_permisos_rol($1, $2)', [rol, tenantId]);
  // Agrupar por modulo
  const modulos = {};
  for (const p of rows) {
    if (!modulos[p.modulo]) modulos[p.modulo] = [];
    modulos[p.modulo].push(p);
  }
  return Object.entries(modulos).map(([modulo, permisos]) => ({ modulo, permisos }));
};

const actualizarPermisosRol = async ({ tenantId, rol, permisos }) => {
  for (const { codigo, activo } of permisos) {
    await query(
      `INSERT INTO rol_permisos (rol, permiso_id, tenant_id, activo)
       SELECT $1, p.id, $2, $3 FROM permisos p WHERE p.codigo = $4
       ON CONFLICT (rol, permiso_id, tenant_id) DO UPDATE SET activo = $3`,
      [rol, tenantId, activo, codigo]
    );
  }
  return obtenerPermisosRol({ tenantId, rol });
};

const listarRoles = async () => {
  const { rows } = await query('SELECT unnest(fn_roles_validos()) AS rol');
  return rows.map(r => r.rol);
};

const resetearPermisosRol = async ({ tenantId, rol }) => {
  await query('CALL sp_resetear_permisos_rol($1, $2, $3)', [rol, tenantId]);
  return obtenerPermisosRol({ tenantId, rol });
};
```

#### `permisos.schema.js`

Eliminar `ROLES_VALIDOS`. Validar roles contra `fn_roles_validos()` en runtime.

```js
const rolParamSchema = Joi.object({
  rol: Joi.string().required()
});
```

#### `permisos.middleware.js`

Reemplazar query inline por `SELECT fn_tiene_permiso($1, $2, $3)`.

#### `menus.service.js`

Eliminar lógica de filtrado JS. Llamar `fn_obtener_menus(rol, tenant_id, es_admin)` que retorna JSON del árbol filtrado.

#### `seed.js`

Eliminar `PERMISOS_DEFAULT`. Insertar datos en `permisos_default`.

### Migración SQL

Archivo nuevo: `migrations/015_permisos_funciones.sql`

Contiene:
1. `CREATE TABLE permisos_default`
2. Insert de defaults para los 5 roles
3. `CREATE FUNCTION fn_tiene_permiso`
4. `CREATE FUNCTION fn_permisos_rol`
5. `CREATE FUNCTION fn_roles_validos`
6. `CREATE PROCEDURE sp_sembrar_permisos_rol`
7. `CREATE PROCEDURE sp_sembrar_permisos_tenant`
8. `CREATE PROCEDURE sp_resetear_permisos_rol(p_rol, p_tenant_id)` — elimina y reinserta los defaults
9. `CREATE FUNCTION fn_obtener_menus` (retorna JSON del árbol usando recursive CTE)

### Eliminar duplicación post-migración

- `permisos.service.js`: eliminar `CATALOGO`, `ROLES_VALIDOS`, `agruparPorModulo()`
- `permisos.schema.js`: eliminar `ROLES_VALIDOS`
- `seed.js`: eliminar `PERMISOS_DEFAULT`, `sembrarPermisosRol()`, `sembrarPermisosTenant()`
- `permisos.middleware.js`: simplificar a `SELECT fn_tiene_permiso()`
- `menus.controller.js`: simplificar (la lógica pasa a la función DB)
- `menus.service.js`: simplificar a llamar `fn_obtener_menus()`

### Seguridad

- Parámetros siempre tipados en las funciones SQL
- El tenant_id siempre se pasa desde el JWT, nunca desde el cliente
- Admin bypass: si `p_es_admin = true`, `fn_obtener_menus` retorna todo sin filtrar
- Funciones marcadas como `STABLE` (no modifican datos)
- Solo `sp_sembrar_permisos_*` modifican datos y son `PROCEDURE`

### Railway

Railway corre PostgreSQL 15+ estándar. `CREATE FUNCTION`, `CREATE PROCEDURE`, PL/pgSQL, funciones `STABLE` — todo compatible. No hay extensiones ni dependencias externas.
