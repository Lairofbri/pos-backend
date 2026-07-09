import { obtenerOrdenShared } from '../../shared.js';

export const obtenerOrden = async ({ tenantId, ordenId }: { tenantId: string; ordenId: string }) => {
  return obtenerOrdenShared({ tenantId, ordenId });
};
