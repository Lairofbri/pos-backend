import { obtenerCajaAbierta } from '../shared.js';

export const verificarCuadre = async ({ tenantId, datos }: { tenantId: string; datos: Record<string, unknown> }) => {
  const { monto_final, sucursal_id } = datos as { monto_final: number; sucursal_id?: string };
  const caja = await obtenerCajaAbierta({ tenantId, sucursalId: sucursal_id });

  if (!caja) {
    throw { status: 404, mensaje: 'No hay ninguna caja abierta.' };
  }

  const diferencia = Number((monto_final - (caja.total_esperado as number)).toFixed(2));

  return {
    cuadra: diferencia === 0,
    mensaje: diferencia === 0
      ? 'El monto ingresado coincide con el esperado.'
      : 'El monto no coincide. Solicite revisión de un superior.',
  };
};
