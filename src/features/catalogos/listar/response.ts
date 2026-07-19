export type CatalogoItem = {
  valor: string;
  label: string;
};

export type CatalogosData = {
  roles: CatalogoItem[];
  tipos_documento: CatalogoItem[];
  metodos_pago: CatalogoItem[];
  movimientos_tipo: CatalogoItem[];
  origenes_orden: CatalogoItem[];
};
