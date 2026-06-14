// src/utils/constants.js
// Constantes compartidas del sistema

// Estados terminales de una orden — no pueden cambiar a otro estado
const ESTADOS_FINALES = ['pagada', 'cancelada'];

// Estados terminales de un item
const ESTADOS_ITEM_FINALES = ['cancelado'];

// Estados activos de cocina
const ESTADOS_COCINA = ['en_proceso', 'listo'];

// IVA El Salvador
const TASA_IVA = 0.13;

module.exports = {
  ESTADOS_FINALES,
  ESTADOS_ITEM_FINALES,
  ESTADOS_COCINA,
  TASA_IVA,
};
