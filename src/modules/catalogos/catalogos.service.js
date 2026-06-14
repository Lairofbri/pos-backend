// src/modules/catalogos/catalogos.service.js

const { query } = require('../../config/database');

const obtenerCatalogos = async ({ tenantId }) => {
  // Incluir roles desde la funci\u00f3n existente
  const { rows: roles } = await query(
    'SELECT unnest(fn_roles_validos()) AS valor'
  );

  const rolesArr = roles.map(r => ({
    valor: r.valor,
    label: r.valor.charAt(0).toUpperCase() + r.valor.slice(1),
  }));

  // Obtener dem\u00e1s cat\u00e1logos desde la tabla
  const { rows } = await query('SELECT fn_catalogos($1) AS data', [tenantId]);
  const catalogos = rows[0]?.data || {};

  return {
    zonas: catalogos.zonas || [],
    roles: rolesArr,
    tipos_documento: catalogos.tipos_documento || [],
    metodos_pago: catalogos.metodos_pago || [],
    movimientos_tipo: catalogos.movimientos_tipo || [],
    origenes_orden: catalogos.origenes_orden || [],
  };
};

module.exports = { obtenerCatalogos };
