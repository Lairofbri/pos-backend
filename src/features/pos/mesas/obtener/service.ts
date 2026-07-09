import { obtenerMesaShared, adjuntarOrdenActiva } from '../../shared.js';

export const obtenerMesa = async ({ tenantId, mesaId }: { tenantId: string; mesaId: string }) => {
  const mesa = await obtenerMesaShared({ tenantId, mesaId });
  await adjuntarOrdenActiva(mesa, tenantId);
  return mesa;
};
