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
      iat?: number;
      exp?: number;
    };
    requestId?: string;
  }
}
