---
tags: [pos-backend, mejora, decision, estado/actualizado]
fecha: 2026-07-01
---

# 2026-07-01 — Límite de profundidad en categorías (3 niveles)

## ¿Qué se cambió?

Se estableció un límite máximo de **3 niveles** en la jerarquía de categorías:

- Nivel 0: Raíz (ej: Bebidas, Comida)
- Nivel 1: Categoría (ej: Alcohólicas, Entradas)
- Nivel 2: Subcategoría (ej: Cervezas, Sodas) ← máximo
- Productos solo en nivel 2

### Backend
1. **CTE limitado**: `WHERE a.nivel < 3` en el `WITH RECURSIVE` de `listarArbolCategorias` para eficiencia y seguridad
2. **Validación al crear**: `calcularNivelCategoria()` calcula profundidad del padre y rechaza si ≥ 2
3. **Validación al editar**: Misma validación si se cambia `parent_id`

### Frontend
4. **Validación visual**: En el modal de categoría, antes de guardar se calcula el nivel del padre y se muestra toast de error si excede el límite

## ¿Por qué?

Para un restaurante, 3 niveles es el balance ideal entre organización y usabilidad. Más niveles degradan la UX del árbol en el sidebar y complican la navegación del menú. El spec visual del nuevo diseño de gestión de menú asume 3 niveles.

## Impacto
- ✅ Árbol limitado a 3 niveles en backend y frontend
- ✅ CTE más rápido (no recorre profundidades innecesarias)
- ✅ Validación dual (cliente + servidor) previene datos inválidos

## Archivos afectados
- `src/modules/productos/productos.service.js` (nuevas funciones + validaciones)
- `src/routes/admin/productos/index.tsx` (validación visual en guardarCat)

## Enlaces
- [[01 - Proyectos/POS Backend/03 - Dominios/POS/POS - Resumen|POS — Resumen]]
- [[01 - Proyectos/POS Backend/03 - Dominios/POS/POS - Mesa - Entidad|POS — Entidades]]
- [[01 - Proyectos/POS Frontend/05 - Operación y evolución/Cambios importantes/2026-07-01 - Redisenio gestion menu categorias|Rediseño gestión menú]]

## Estado
- #estado/actualizado
