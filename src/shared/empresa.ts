/**
 * Límite EMPRESA vs POS (spec «DTE única fuente de verdad de empresa y
 * sucursal», F2, 2026-10-16).
 *
 * El DTE Service es la única fuente de verdad de la empresa (identidad fiscal
 * + configuración) y de las sucursales/establecimientos. El POS conserva lo
 * operativo (mesas, órdenes, cajas, usuarios, permisos, inventario, etc.).
 *
 * Este módulo centraliza los campos y mensajes que usan los handlers/servicios
 * para BLOQUEAR escrituras de empresa/sucursal con un error explícito.
 */

/** Columnas de `tenants` que son datos de EMPRESA (no editables desde el POS). */
export const CAMPOS_EMPRESA: readonly string[] = [
  'nombre',
  'nit',
  'nrc',
  'direccion',
  'telefono',
  'email',
  'logo_url',
];

export const MENSAJE_EMPRESA_SOLO_DTE =
  'La identidad de la empresa se administra en el DTE Service. Editá la empresa desde el DTE.';

export const MENSAJE_SUCURSAL_ALTA_SOLO_DTE =
  'El alta de sucursales se administra en el DTE Service. Creá el establecimiento desde el DTE.';

export const MENSAJE_SUCURSAL_EDICION_SOLO_DTE =
  'La edición de sucursales se administra en el DTE Service. Editá el establecimiento desde el DTE.';

/** Campos de empresa presentes en el body (solo nombres; nunca valores). */
export const camposEmpresaEnviados = (datos: Record<string, unknown> | undefined): string[] =>
  Object.keys(datos ?? {}).filter((campo) => CAMPOS_EMPRESA.includes(campo));
