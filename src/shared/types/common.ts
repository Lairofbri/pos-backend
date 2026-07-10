export type Paginacion = {
  total: number;
  pagina: number;
  limite: number;
  paginas: number;
};

export type RespuestaExito<T = unknown> = {
  ok: true;
  mensaje: string;
  data: T;
};

export type RespuestaError = {
  ok: false;
  mensaje: string;
  errores?: unknown;
};

export type RespuestaPaginada<T> = RespuestaExito<{
  datos: T[];
  paginacion: Paginacion;
}>;

export type Usuario = {
  id: string;
  tenant_id: string;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
};
