# Fase 8: ejecución controlada

No ejecutar las migraciones desde este entorno. El orden recomendado es:

1. Respaldar esquema y datos de las bases POS y DTE en almacenamiento protegido.
2. Restaurar cada respaldo en una base de pruebas aislada.
3. Ejecutar las migraciones existentes en orden alfabético.
4. Ejecutar `063_fase8_integridad_fiscal.sql` en POS.
5. Ejecutar `018_fase8_integridad_fiscal.sql` en DTE Service.
6. Verificar restricciones, índices, `dtes_items`, `codigo_lote` y `_migraciones`.
7. Probar una base limpia y una base con datos existentes.
8. Promover únicamente después de aprobar los prechecks y el rollback.

Los prechecks de las migraciones abortan ante duplicados, secretos persistidos o relaciones tenant/establecimiento inconsistentes. Esos casos deben sanearse mediante una migración independiente y revisada; no deben corregirse manualmente en producción.
