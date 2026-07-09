export class AppError extends Error {
  public readonly status: number;
  public readonly mensaje: string;
  public readonly errores?: unknown;

  constructor(status: number, mensaje: string, errores?: unknown) {
    super(mensaje);
    this.status = status;
    this.mensaje = mensaje;
    this.errores = errores;
    this.name = 'AppError';
  }
}
