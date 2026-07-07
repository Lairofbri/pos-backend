// src/middlewares/caja.middleware.js
// Middleware que verifica que haya una caja abierta antes de operaciones de POS/caja
// Sin excepci\u00f3n para administrador — todos necesitan caja abierta

const { query } = require('../config/database');
const { error } = require('../utils/response');

const requiereCajaAbierta = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id FROM cajas
       WHERE tenant_id = $1 AND estado = 'abierta'
       ORDER BY fecha_apertura DESC LIMIT 1`,
      [req.usuario.tenant_id]
    );

    if (rows.length === 0) {
      return error(res, 'No hay una caja abierta. Abre la caja antes de realizar esta operaci\u00f3n.', 403);
    }

    req.caja_id = rows[0].id;
    next();
  } catch {
    return error(res, 'Error al verificar caja abierta.', 500);
  }
};

module.exports = { requiereCajaAbierta };
