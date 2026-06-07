# Sub-proyecto 1: Roles y Permisos Granulares

**Fecha:** 2026-06-07
**Branch:** `feat/modulo-7-dte`
**Dependencia:** Ninguna (fundación para los demás sub-proyectos)

---

## Objetivo

Reemplazar el sistema actual de roles fijos (`administrador`, `cajero`, `mesero`) por un sistema de permisos granulares donde cada tenant puede personalizar qué acciones puede ejecutar cada rol. El admin del tenant configura los permisos desde el panel, sin afectar a otros tenants.

---

## Roles del sistema

Cinco roles predefinidos (string fijo en `usuarios.rol`):

| Rol | Descripción |
|-----|-------------|
| `administrador` | Dueño / admin del tenant. Tiene todos los permisos por default. |
| `gerente` | Manager. Puede ver reportes, gestionar inventario, editar usuarios pero no crear usuarios ni configurar roles. |
| `cajero` | Caja y cobros. Opera el POS, abre caja, cobra órdenes, registra clientes. |
| `mesero` | Mesa. Toma órdenes, ve estado de items, no cobra ni abre caja. |
| `cocinero` | Cocina. Ve comandas, marca items como listos. Solo acceso a pantalla de cocina. |

Los permisos default por rol están en la tabla de la Sección 2 del spec (catálogo de permisos).

---

## 1. Esquema de Base de Datos

### Tablas nuevas

```sql
-- Catálogo fijo de permisos (global, compartido por todos los tenants)
CREATE TABLE IF NOT EXISTS permisos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo      VARCHAR(100) UNIQUE NOT NULL,
    nombre      VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    modulo      VARCHAR(50) NOT NULL,
    creado_en   TIMESTAMPTZ DEFAULT NOW()
);

-- Asignación de permisos por rol, por tenant (cada tenant tiene su copia)
CREATE TABLE IF NOT EXISTS rol_permisos (
    rol         VARCHAR(50) NOT NULL,
    permiso_id  UUID NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    activo      BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (rol, permiso_id, tenant_id)
);
```

**Sin NULL en `tenant_id`.** Cada tenant tiene su copia independiente de permisos por rol.

### Cambios en tablas existentes

Ninguno. El campo `usuarios.rol` se mantiene como string sin cambios. La asignación de permisos va en `rol_permisos`.

---

## 2. Catálogo de Permisos

28 permisos agrupados en 6 módulos. Los defaults por rol:

### Módulo: Pos (órdenes, mesas, items)

| Código | Acción | Admin | Gerente | Cajero | Mesero | Cocinero |
|--------|--------|:-----:|:-------:|:------:|:------:|:--------:|
| `ordenes.ver` | Ver órdenes | ✓ | ✓ | ✓ | ✓ | — |
| `ordenes.crear` | Crear orden | ✓ | ✓ | ✓ | — | — |
| `ordenes.actualizar` | Modificar orden (notas, descuento) | ✓ | ✓ | ✓ | — | — |
| `ordenes.anular` | Cancelar orden | ✓ | ✓ | — | — | — |
| `ordenes.descuento` | Aplicar descuento | ✓ | ✓ | — | — | — |
| `items.agregar` | Agregar items a orden | ✓ | ✓ | ✓ | — | — |
| `items.eliminar` | Quitar items | ✓ | ✓ | ✓ | — | — |
| `items.estado` | Cambiar estado de item (cocina) | ✓ | ✓ | — | — | ✓ |
| `mesas.administrar` | Crear/editar mesas | ✓ | ✓ | — | — | — |
| `pago.registrar` | Cobrar orden | ✓ | ✓ | ✓ | — | — |
| `pago.anular` | Anular pago | ✓ | — | — | — | — |

### Módulo: Caja

| Código | Acción | Admin | Gerente | Cajero | Mesero | Cocinero |
|--------|--------|:-----:|:-------:|:------:|:------:|:--------:|
| `caja.abrir` | Abrir turno de caja | ✓ | ✓ | ✓ | — | — |
| `caja.cerrar` | Cerrar turno de caja | ✓ | ✓ | — | — | — |
| `caja.movimientos` | Registrar retiros/depósitos | ✓ | ✓ | — | — | — |
| `caja.historial` | Ver historial de cajas | ✓ | ✓ | — | — | — |

### Módulo: Productos + Categorías

| Código | Acción | Admin | Gerente | Cajero | Mesero | Cocinero |
|--------|--------|:-----:|:-------:|:------:|:------:|:--------:|
| `productos.ver` | Ver productos | ✓ | ✓ | ✓ | ✓ | ✓ |
| `productos.crear` | Crear productos | ✓ | ✓ | — | — | — |
| `productos.editar` | Editar productos | ✓ | ✓ | — | — | — |
| `productos.desactivar` | Desactivar productos | ✓ | ✓ | — | — | — |
| `productos.stock` | Ajustar stock | ✓ | ✓ | ✓ | — | — |
| `categorias.crear` | Crear categorías | ✓ | ✓ | — | — | — |
| `categorias.editar` | Editar categorías | ✓ | ✓ | — | — | — |

### Módulo: Clientes

| Código | Acción | Admin | Gerente | Cajero | Mesero | Cocinero |
|--------|--------|:-----:|:-------:|:------:|:------:|:--------:|
| `clientes.ver` | Ver clientes | ✓ | ✓ | ✓ | — | — |
| `clientes.crear` | Crear clientes | ✓ | ✓ | ✓ | — | — |
| `clientes.editar` | Editar clientes | ✓ | ✓ | — | — | — |
| `clientes.desactivar` | Desactivar clientes | ✓ | ✓ | — | — | — |

### Módulo: Usuarios

| Código | Acción | Admin | Gerente | Cajero | Mesero | Cocinero |
|--------|--------|:-----:|:-------:|:------:|:------:|:--------:|
| `usuarios.ver` | Ver usuarios | ✓ | ✓ | — | — | — |
| `usuarios.crear` | Crear usuarios | ✓ | — | — | — | — |
| `usuarios.editar` | Editar usuarios | ✓ | ✓ | — | — | — |
| `usuarios.reset-pin` | Resetear PIN | ✓ | ✓ | — | — | — |
| `roles.configurar` | Configurar permisos de roles | ✓ | — | — | — | — |

### Módulo: Reportes

| Código | Acción | Admin | Gerente | Cajero | Mesero | Cocinero |
|--------|--------|:-----:|:-------:|:------:|:------:|:--------:|
| `reportes.ver` | Ver reportes | ✓ | ✓ | — | — | — |
| `reportes.exportar` | Exportar reportes | ✓ | ✓ | — | — | — |

---

## 3. Middleware de Permisos

### Flujo

1. **auth.middleware.js** — Sin cambios. El JWT incluye `rol`. Se inyecta `req.usuario = { id, tenant_id, rol, ... }`.
2. **Nuevo middleware `permisos.middleware.js`** — `requierePermiso(codigo)`. Por cada request, consulta `rol_permisos` para el `rol` del usuario y el `tenant_id`, y verifica que el permiso esté activo.
3. **Opcional: carga de permisos** — Se evalúa si hacer la query por request (opción A) o cachear en `req.usuario.permisos` al autenticar. Se decide en implementación según performance.

### Interfaz del middleware

```js
const { requierePermiso } = require('../middlewares/permisos.middleware');

// Uso en rutas:
router.post('/ordenes', autenticar, requierePermiso('ordenes.crear'), controller.crearOrden);
router.get('/reportes', autenticar, requierePermiso('reportes.ver'), controller.verReportes);
```

### Backward compatibilidad

Los shortcuts actuales (`soloAdmin`, `adminOCajero`, `todosLosRoles`) se mantienen como wrappers que internamente llaman a `requierePermiso`. Esto evita romper las rutas existentes durante la transición.

### Regla de safeguard

El rol `administrador` **siempre tiene todos los permisos**, independientemente de lo que diga `rol_permisos`. Esto evita que un admin se bloquee a sí mismo por error al desactivar `roles.configurar` u otro permiso crítico. El middleware hace bypass del lookup de BD para `rol === 'administrador'` y permite todo.

---

## 4. Endpoints de Configuración

Todos bajo `/api/permisos`, requieren autenticación + permiso `roles.configurar`.

### `GET /api/permisos`
Devuelve el catálogo completo de permisos disponibles (sin estado `activo`, solo metadatos). Es el "menú" de permisos que existe en el sistema, para que el admin sepa qué puede configurar.

**Respuesta:**
```json
[{
  "modulo": "pos",
  "permisos": [
    { "codigo": "ordenes.ver", "nombre": "Ver órdenes" },
    { "codigo": "ordenes.crear", "nombre": "Crear orden" }
  ]
}]
```

### `GET /api/permisos/rol/:rol`
Devuelve el catálogo con el estado `activo` para ese rol en el tenant actual. Hace merge entre el catálogo estático y `rol_permisos`.

**Respuesta:**
```json
[{
  "modulo": "pos",
  "permisos": [
    { "codigo": "ordenes.ver", "nombre": "Ver órdenes", "activo": true },
    { "codigo": "ordenes.crear", "nombre": "Crear orden", "activo": false }
  ]
}]
```
Si un permiso no existe en `rol_permisos` para ese rol y tenant, se muestra `activo: false`.

### `PUT /api/permisos/rol/:rol`
Body: `{ permisos: [{ codigo: "ordenes.ver", activo: true }, ...] }`. Solo se envían los permisos que cambiaron. Hace upsert en `rol_permisos`.

### `GET /api/permisos/roles`
Devuelve los roles del sistema: `['administrador', 'gerente', 'cajero', 'mesero', 'cocinero']`. Es estático (no toca BD).

### `POST /api/permisos/rol/:rol/reset`
Reinserta los defaults para ese rol en el tenant. Útil si el admin quiere restaurar la configuración original.

---

## 5. Migración y Seed

### Migración: `migrations/007_permisos.sql`

- `CREATE TABLE IF NOT EXISTS permisos` — catálogo fijo
- `CREATE TABLE IF NOT EXISTS rol_permisos` — asignación por tenant
- `INSERT INTO permisos ... ON CONFLICT (codigo) DO NOTHING` — 28 permisos

### Seed de defaults

Al crear un tenant nuevo (`seed.js`), se insertan filas en `rol_permisos` para cada rol con los permisos marcados como default según la tabla de la Sección 2.

Endpoint `POST /api/permisos/rol/:rol/reset` permite regenerar los defaults para un rol específico en un tenant existente.

---

## 6. Path de Migración (Backward-Compatible)

| Fase | Estado | Descripción |
|------|--------|-------------|
| **Fase 1** | Migración ejecutada, código viejo | Tablas nuevas existen. `rol_permisos` vacío para tenants existentes hasta correr seed. Los middlewares viejos por rol siguen funcionando. Sin downtime. |
| **Fase 2** | Seed + código nuevo | Se ejecuta seed para tenants existentes. Se despliega middleware `requierePermiso`. Los shortcuts viejos (`soloAdmin`, etc.) se mantienen como wrappers. Sin downtime. |
| **Fase 3** | Limpieza futura | Migrar rutas individuales a usar `requierePermiso` directamente. Marcar shortcuts viejos como deprecated. Gradual, sin urgencia. |

---

## 7. Testing

- **Sin framework de tests** en el proyecto. No se agrega en esta iteración.
- **Smoke test manual:** login de cada rol, verificar que endpoints existentes siguen funcionando.
- **Verificación de permisos:** modificar permisos vía API, verificar que el middleware bloquea/permite según corresponda.
- **Regresión:** el flujo completo de tomar orden → cobrar → cerrar caja debe funcionar igual que antes.

---

## 8. Decisiones de Diseño

| Decisión | Opción elegida | Justificación |
|----------|---------------|---------------|
| Alcance del lookup | Query por request (A) | Simple, siempre actualizado. ~1ms no afecta al POS. |
| Tenant isolation | Copia completa por tenant | Cada restaurante personaliza sus permisos sin afectar a otros. |
| Backward compat | Mantener shortcuts viejos | Sin downtime, migración gradual. |
| Catálogo de permisos | Array estático en código + tabla `permisos` | Fuente de verdad unificada, fácil de extender. |
| Roles predefinidos | 5 roles fijos | Suficiente para el dominio de restaurantes. Permisos configurables dan la flexibilidad. |
