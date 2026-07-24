# Módulo 1: Autenticación — POS Backend

## Setup inicial

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Edita .env con tu DATABASE_URL de Docker y los secrets JWT

# 3. Ejecutar migraciones (crea las tablas)
npm run migrate

# 4. Crear datos de demostración
node src/migrations/seed.js

# 5. Arrancar en desarrollo
npm run dev
```

---

## Endpoints

### Públicos (sin token)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Login email+password (panel admin web) |
| `POST` | `/api/auth/login-pin` | Login PIN (estaciones POS) |
| `POST` | `/api/auth/refresh` | Renovar access token |
| `GET`  | `/api/usuarios/pin-list` | Lista de usuarios para pantalla de PIN |

### Protegidos (requieren `Authorization: Bearer <token>`)

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| `POST` | `/api/auth/logout` | Todos | Cerrar sesión |
| `GET`  | `/api/auth/me` | Todos | Datos del usuario actual |
| `PUT`  | `/api/auth/cambiar-pin` | Todos | Cambiar propio PIN |
| `PUT`  | `/api/auth/cambiar-password` | Admin | Cambiar propio password |
| `GET`  | `/api/usuarios` | Admin | Listar usuarios del restaurante |
| `GET`  | `/api/usuarios/:id` | Admin | Obtener usuario por ID |
| `POST` | `/api/usuarios` | Admin | Crear nuevo usuario |
| `PATCH`| `/api/usuarios/:id` | Admin | Actualizar usuario |
| `POST` | `/api/usuarios/:id/resetear-pin` | Admin | Resetear PIN de un usuario |

---

## Headers requeridos

- `Authorization: Bearer <access_token>` — en rutas protegidas
- `X-Tenant-Id: <uuid>` — en `POST /api/auth/login-pin` y `GET /api/usuarios/pin-list`

---

## Flujo de autenticación

### Panel admin web
```
POST /api/auth/login
Body: { email, password, dispositivo? }
→ Devuelve: { usuario, access_token, refresh_token, expires_in }
```

### Estación POS (login por PIN)
```
1. GET /api/usuarios/pin-list  [X-Tenant-Id: xxx]
   → Lista de usuarios para mostrar en pantalla de selección

2. POST /api/auth/login-pin  [X-Tenant-Id: xxx]
   Body: { usuario_id, pin, dispositivo? }
   → Devuelve: { usuario, access_token, refresh_token, expires_in }
```

### Refresh token (renovación automática)
```
POST /api/auth/refresh
Body: { refresh_token }
→ Devuelve: { access_token, expires_in }
```

---

## Variables de entorno requeridas

```env
DATABASE_URL=           # PostgreSQL URL (Docker: postgresql://postgres:postgres@localhost:5432/pos_backend)
JWT_SECRET=             # String aleatorio largo (mín. 64 chars)
JWT_REFRESH_SECRET=     # String diferente al JWT_SECRET
JWT_EXPIRES_IN=8h       # Duración del access token
JWT_REFRESH_EXPIRES_IN=7d
PORT=3000
NODE_ENV=production
```

---

## Deploy local con Docker Compose

```bash
# 1. Construir y arrancar
docker compose up -d

# 2. Ejecutar migraciones
docker compose exec pos-backend node dist/migrations/run.js

# 3. Sembrar datos demo
docker compose exec pos-backend node dist/migrations/seed.js
```

Ver `docker-compose.yml` en la raíz del monorepo para configuración completa.
