# Sidebar filtrado por permisos — Fase 1

Backend POS multi-tenant. Filtrar items del menú lateral (sidebar) según los permisos activos del rol del usuario autenticado.

## Problema

El sidebar mostraba items de administración a roles que no tenían permisos para acceder a ellos. El frontend solo bloqueaba la navegación via RoleGuard, pero el usuario veía opciones inaccesibles.

## Solución

El endpoint `GET /api/menus` ya filtra el árbol de menús según los permisos del rol del usuario autenticado. Esta fase consiste en verificar que los datos estén correctos y que el filtrado funcione como se espera.

## Arquitectura

```
Request → autenticar (JWT) → listarMenus (controller)
  → query permisos activos del rol desde rol_permisos
  → obtenerMenus (service) recibe array de permisos
    → filtra: items sin permiso_codigo OR con código que el rol tenga activo
    → construye árbol
    → elimina grupos padres sin hijos visibles
  → responde { menus: [...] }
```

## Reglas de filtrado

1. Admin (`rol === 'administrador'`) → ve todos los menús. No consulta permisos.
2. Items sin `permiso_codigo` (null) → visibles para todos los roles.
3. Items con `permiso_codigo` → solo si el rol tiene ese permiso `activo = true` en `rol_permisos`.
4. Grupos padres (items con `ruta = null` y con hijos) → si después del filtrado se quedan sin hijos visibles, se ocultan también.

## Modelo de datos

### Tabla `menus` (existente, sin cambios)

| Campo | Tipo | Uso |
|-------|------|-----|
| `id` | UUID PK | |
| `parent_id` | UUID nullable | null = raíz del sidebar |
| `titulo` | VARCHAR(100) | Texto mostrado en el sidebar |
| `icono` | VARCHAR(50) nullable | Icono de Lucide/Feather |
| `ruta` | VARCHAR(200) nullable | null = contenedor de submenús |
| `orden` | INTEGER | Orden de visualización |
| `permiso_codigo` | VARCHAR(100) nullable | **Único permiso requerido para ver este item** |
| `activo` | BOOLEAN | Soft delete |

### Tabla `rol_permisos` (existente, sin cambios)

Define qué permisos tiene cada rol por tenant.

### Catálogo de permisos (existente, sin cambios)

34 permisos granulares en 6 módulos: `pos`, `caja`, `productos`, `clientes`, `usuarios`, `reportes`.

## Mapeo menú → permiso

| Menú | permiso_codigo |
|------|----------------|
| POS | `ordenes.ver` |
| Cocina | `items.estado` |
| Administración (contenedor) | null |
| ├─ Productos | `productos.ver` |
| ├─ Categorías | `productos.ver` |
| ├─ Combos | (ninguno — visible a todos) |
| ├─ Mesas | `mesas.administrar` |
| ├─ Usuarios | `usuarios.ver` |
| ├─ Roles y Permisos | `roles.configurar` |
| ├─ Caja | `caja.historial` |
| └─ Clientes | `clientes.ver` |
| Configuraciones (contenedor) | null |
| ├─ Menú | `roles.configurar` |
| └─ ... | |

## Código actual (ya implementado)

**Controller** (`src/modules/menus/menus.controller.js`):
- Si rol !== 'administrador', consulta permisos activos en BD
- Pasa array de códigos al service

**Service** (`src/modules/menus/menus.service.js`):
- `obtenerMenus({ tenantId, permisosUsuario })`
- `permisosUsuario = null` → admin, ve todo
- Filtra: `!m.permiso_codigo || setPermisos.has(m.permiso_codigo)`
- Construye árbol y elimina padres sin hijos

## Lo que se hizo

1. Asignados `permiso_codigo` faltantes en BD:
   - `Categorías` → `productos.ver`
   - `Mesas` → `mesas.administrar`
   - `Menú` → `roles.configurar`
2. Verificado que el seed de menús tenga los permisos correctos (requiere re-ejecutar seed para nuevos tenants)
3. Confirmado que el filtrado funciona: mesero solo ve POS y Cocina; cajero ve POS + los módulos admin que tenga habilitados

## Próxima fase (separada)

Permisos granulares por acción dentro de cada vista (CRUD, exportar, imprimir, cerrar caja, etc.). El frontend recibirá `GET /api/permisos/rol/:rol` y usará esos permisos para mostrar/ocultar botones y acciones dentro de cada pantalla. Diseño y alcance se definen en una spec aparte.

## Seguridad

- Multi-tenancy: `WHERE rp.tenant_id = $1` en cada consulta
- JWT requerido en todas las rutas de menús
- Admin bypass explícito (no consulta permisos)
- Queries parametrizadas
