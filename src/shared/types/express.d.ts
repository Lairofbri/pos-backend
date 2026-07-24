import 'express';

declare module 'express' {
  interface Request {
    usuario?: {
      id: string;
      tenant_id: string;
      nombre: string;
      email: string;
      rol: string;
      sucursal_id: string;
      establecimiento_id?: string | null;
      iat?: number;
      exp?: number;
    };
    requestId?: string;
    sucursalId?: string;
    authMode?: string;
  }
}
