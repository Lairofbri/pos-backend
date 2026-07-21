-- Admin sin sucursal fija — puede seleccionar desde Topbar
UPDATE usuarios SET sucursal_id = NULL
WHERE email = 'admin@demo.pos' AND tenant_id = 'a0000000-0000-0000-0000-000000000001';
