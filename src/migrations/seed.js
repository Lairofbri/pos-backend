// src/migrations/seed.js
// Crea los datos iniciales de demostración:
//   - Tenant "Restaurante Demo"
//   - Sucursal Principal
//   - Usuario administrador con email y PIN
//   - Permisos default por rol para el tenant demo
//
// Uso: node src/migrations/seed.js
// SOLO ejecutar una vez al inicio. Es idempotente (no duplica si ya existe).

const bcrypt = require('bcryptjs');
const { query, verificarConexion } = require('../shared/config/database.js');
const { env } = require('../shared/config/env.js');
const { logger } = require('../shared/utils/logger.js');

const TENANT_ID    = 'a0000000-0000-4000-8000-000000000001';
const SUCURSAL_ID  = 'b0000000-0000-4000-8000-000000000001';
const ADMIN_EMAIL  = 'admin@demo.pos';
const ADMIN_PIN    = '123456';        // PIN rápido para estación
const ADMIN_PASS   = 'Admin123!';    // Password para panel web

if (env.ES_PRODUCCION) {
  logger.error('Seed bloqueado: no puede ejecutarse en producción.');
  process.exit(1);
}

/**
 * Inserta los permisos default para un tenant (delegado a sp_sembrar_permisos_tenant)
 */
const sembrarPermisosTenant = async (tenantId) => {
  await query('CALL sp_sembrar_permisos_tenant($1)', [tenantId]);
  logger.info('Permisos default sembrados para tenant', { tenant_id: tenantId });
};

// ─────────────────────────────────────────────
// Menú dinámico del sidebar
// ─────────────────────────────────────────────

/**
 * Inserta los menús default para un tenant
 * Usa IDs fijos para que el seed sea idempotente
 */
const sembrarMenusTenant = async (tenantId) => {
  const menus = [
    // Raíces
    { id: '00000000-0000-4000-8000-000000000001', parent_id: null, titulo: 'POS',             icono: 'shopping-cart', ruta: '/pos',                orden: 1, permiso_codigo: 'ordenes.ver' },
    { id: '00000000-0000-4000-8000-000000000002', parent_id: null, titulo: 'Cocina',          icono: 'chef-hat',      ruta: '/cocina',             orden: 2, permiso_codigo: 'items.estado' },
    { id: '00000000-0000-4000-8000-000000000003', parent_id: null, titulo: 'Administración',  icono: 'user-cog',      ruta: null,                   orden: 3, permiso_codigo: null },
    { id: 'cc306641-6ab2-4bfa-814f-528c4cbe2a65', parent_id: null, titulo: 'Principal',      icono: 'utensils',      ruta: null,                   orden: 1, permiso_codigo: null },
    { id: '00000000-0000-4000-8000-000000000010', parent_id: null, titulo: 'Configuraciones', icono: 'settings',      ruta: null,                   orden: 4, permiso_codigo: null },

    // Hijos de Administración
    { id: '9f3f836b-82f0-452f-b524-5e3bc54e4318', parent_id: '00000000-0000-4000-8000-000000000003', titulo: 'Mesas',      icono: 'table',       ruta: '/admin/mesas',      orden: 1, permiso_codigo: 'mesas.administrar' },
    { id: '00000000-0000-4000-8000-000000000005', parent_id: '00000000-0000-4000-8000-000000000003', titulo: 'Combos',     icono: 'gift',        ruta: '/admin/combos',     orden: 2, permiso_codigo: null },
    { id: '00000000-0000-4000-8000-000000000004', parent_id: '00000000-0000-4000-8000-000000000003', titulo: 'Productos',  icono: 'package',     ruta: '/admin/productos',  orden: 3, permiso_codigo: 'productos.ver' },
    { id: '00000000-0000-4000-8000-000000000013', parent_id: '00000000-0000-4000-8000-000000000003', titulo: 'Reportes',   icono: 'file-text',   ruta: '/admin/reportes',   orden: 4, permiso_codigo: null },
    { id: '00000000-0000-4000-8000-000000000008', parent_id: '00000000-0000-4000-8000-000000000003', titulo: 'Caja',       icono: 'dollar-sign', ruta: '/admin/caja',       orden: 5, permiso_codigo: 'caja.historial' },
      { id: '00000000-0000-4000-8000-000000000009', parent_id: '00000000-0000-4000-8000-000000000003', titulo: 'Clientes',   icono: 'users',       ruta: '/admin/clientes',   orden: 6, permiso_codigo: 'clientes.ver' },
      { id: '00000000-0000-4000-8000-000000000012', parent_id: '00000000-0000-4000-8000-000000000003', titulo: 'Impresoras', icono: 'printer',     ruta: '/admin/impresoras', orden: 7, permiso_codigo: 'impresion.configurar' },

    // Hijos de Configuraciones
    { id: '00000000-0000-4000-8000-000000000011', parent_id: '00000000-0000-4000-8000-000000000010', titulo: 'Menú',           icono: 'menu',   ruta: '/configuraciones/menus', orden: 1, permiso_codigo: 'roles.configurar' },
    { id: '00000000-0000-4000-8000-000000000007', parent_id: '00000000-0000-4000-8000-000000000010', titulo: 'Roles y Permisos', icono: 'shield', ruta: '/configuraciones/roles', orden: 2, permiso_codigo: 'roles.configurar' },
    { id: '00000000-0000-4000-8000-000000000006', parent_id: '00000000-0000-4000-8000-000000000010', titulo: 'Usuarios',        icono: 'users',  ruta: '/configuraciones/usuarios', orden: 4, permiso_codigo: 'usuarios.ver' },
  ];

  for (const m of menus) {
    await query(
      `INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         titulo = EXCLUDED.titulo,
         icono = EXCLUDED.icono,
         ruta = EXCLUDED.ruta,
         orden = EXCLUDED.orden,
         permiso_codigo = EXCLUDED.permiso_codigo`,
      [m.id, tenantId, m.parent_id, m.titulo, m.icono, m.ruta, m.orden, m.permiso_codigo]
    );
  }

  logger.info('Menús default sembrados para tenant', { tenant_id: tenantId, menus: menus.length });
};

const sembrarCategorias = async (tenantId) => {
  const categorias = [
    { id: 'c0000000-0000-4000-8000-000000000001', nombre: 'Entradas',       orden: 1, color: '#FF6B6B' },
    { id: 'c0000000-0000-4000-8000-000000000002', nombre: 'Platos fuertes', orden: 2, color: '#4ECDC4' },
    { id: 'c0000000-0000-4000-8000-000000000003', nombre: 'Bebidas',        orden: 3, color: '#45B7D1' },
    { id: 'c0000000-0000-4000-8000-000000000004', nombre: 'Postres',        orden: 4, color: '#96CEB4' },
    { id: 'c0000000-0000-4000-8000-000000000005', nombre: 'Combos',         orden: 5, color: '#F9CA24' },
  ];

  for (const c of categorias) {
    await query(
      `INSERT INTO categorias (id, tenant_id, nombre, orden, color)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         nombre = EXCLUDED.nombre,
         orden = EXCLUDED.orden,
         color = EXCLUDED.color`,
      [c.id, tenantId, c.nombre, c.orden, c.color]
    );
  }
  logger.info('Categorías sembradas', { tenant_id: tenantId, categorias: categorias.length });
};

const sembrarProductos = async (tenantId) => {
  const productos = [
    { nombre: 'Sopa del día',       precio: 3.50,  categoria_id: 'c0000000-0000-4000-8000-000000000001', orden: 1 },
    { nombre: 'Ensalada mixta',     precio: 4.00,  categoria_id: 'c0000000-0000-4000-8000-000000000001', orden: 2 },
    { nombre: 'Ceviche de camarón', precio: 5.50,  categoria_id: 'c0000000-0000-4000-8000-000000000001', orden: 3 },
    { nombre: 'Pollo a la plancha', precio: 8.50,  categoria_id: 'c0000000-0000-4000-8000-000000000002', orden: 1 },
    { nombre: 'Carne asada',        precio: 12.00, categoria_id: 'c0000000-0000-4000-8000-000000000002', orden: 2 },
    { nombre: 'Pasta al pesto',     precio: 7.50,  categoria_id: 'c0000000-0000-4000-8000-000000000002', orden: 3 },
    { nombre: 'Pupusas revueltas',  precio: 2.50,  categoria_id: 'c0000000-0000-4000-8000-000000000002', orden: 4 },
    { nombre: 'Agua natural',       precio: 1.00,  categoria_id: 'c0000000-0000-4000-8000-000000000003', orden: 1 },
    { nombre: 'Refresco',           precio: 1.50,  categoria_id: 'c0000000-0000-4000-8000-000000000003', orden: 2 },
    { nombre: 'Jugo natural',       precio: 2.50,  categoria_id: 'c0000000-0000-4000-8000-000000000003', orden: 3 },
    { nombre: 'Café',               precio: 1.75,  categoria_id: 'c0000000-0000-4000-8000-000000000003', orden: 4 },
    { nombre: 'Flan',               precio: 2.50,  categoria_id: 'c0000000-0000-4000-8000-000000000004', orden: 1 },
    { nombre: 'Pastel del día',     precio: 3.00,  categoria_id: 'c0000000-0000-4000-8000-000000000004', orden: 2 },
    { nombre: 'Helado',             precio: 2.00,  categoria_id: 'c0000000-0000-4000-8000-000000000004', orden: 3 },
  ];

  for (const p of productos) {
    await query(
      `INSERT INTO productos (tenant_id, categoria_id, nombre, precio, orden)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [tenantId, p.categoria_id, p.nombre, p.precio, p.orden]
    );
  }
  logger.info('Productos sembrados', { tenant_id: tenantId, productos: productos.length });
};

const sembrarMesas = async (tenantId, sucursalId) => {
  const mesas = [
    { numero: '1',  nombre: 'Mesa 1',  capacidad: 4 },
    { numero: '2',  nombre: 'Mesa 2',  capacidad: 4 },
    { numero: '3',  nombre: 'Mesa 3',  capacidad: 6 },
    { numero: '4',  nombre: 'Mesa 4',  capacidad: 2 },
    { numero: '5',  nombre: 'Mesa 5',  capacidad: 8 },
    { numero: 'B1', nombre: 'Barra 1', capacidad: 1 },
    { numero: 'B2', nombre: 'Barra 2', capacidad: 1 },
    { numero: 'T1', nombre: 'Terraza 1', capacidad: 4 },
    { numero: 'T2', nombre: 'Terraza 2', capacidad: 4 },
    { numero: 'V1', nombre: 'VIP 1',   capacidad: 6 },
  ];

  for (const m of mesas) {
    await query(
      `INSERT INTO mesas (tenant_id, sucursal_id, numero, nombre, capacidad, estado)
       VALUES ($1, $2, $3, $4, $5, 'disponible')
       ON CONFLICT (tenant_id, numero) DO UPDATE SET
         nombre = EXCLUDED.nombre,
         capacidad = EXCLUDED.capacidad`,
      [tenantId, sucursalId, m.numero, m.nombre, m.capacidad]
    );
  }
  logger.info('Mesas sembradas', { tenant_id: tenantId, mesas: mesas.length });
};

const sembrarCombos = async (tenantId) => {
  const combos = [
    { id: 'd0000000-0000-4000-8000-000000000001', nombre: 'Combo Familiar',  precio: 7.00 },
    { id: 'd0000000-0000-4000-8000-000000000002', nombre: 'Combo Ejecutivo', precio: 10.00 },
    { id: 'd0000000-0000-4000-8000-000000000003', nombre: 'Combo Infantil',  precio: 5.50 },
  ];

  for (const c of combos) {
    await query(
      `INSERT INTO combos (id, tenant_id, nombre, precio, activo)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (id) DO UPDATE SET
         nombre = EXCLUDED.nombre,
         precio = EXCLUDED.precio`,
      [c.id, tenantId, c.nombre, c.precio]
    );
  }

  const { rows: productos } = await query(
    'SELECT id, nombre FROM productos WHERE tenant_id = $1',
    [tenantId]
  );
  const prodMap = Object.fromEntries(productos.map((p) => [p.nombre, p.id]));

  const comboProductos = [
    { combo_id: 'd0000000-0000-4000-8000-000000000001', nombre: 'Pupusas revueltas', cantidad: 2 },
    { combo_id: 'd0000000-0000-4000-8000-000000000001', nombre: 'Refresco',           cantidad: 2 },
    { combo_id: 'd0000000-0000-4000-8000-000000000002', nombre: 'Pollo a la plancha', cantidad: 1 },
    { combo_id: 'd0000000-0000-4000-8000-000000000002', nombre: 'Ensalada mixta',     cantidad: 1 },
    { combo_id: 'd0000000-0000-4000-8000-000000000002', nombre: 'Jugo natural',       cantidad: 1 },
    { combo_id: 'd0000000-0000-4000-8000-000000000003', nombre: 'Pasta al pesto',     cantidad: 1 },
    { combo_id: 'd0000000-0000-4000-8000-000000000003', nombre: 'Refresco',           cantidad: 1 },
    { combo_id: 'd0000000-0000-4000-8000-000000000003', nombre: 'Helado',             cantidad: 1 },
  ];

  for (const cp of comboProductos) {
    const productoId = prodMap[cp.nombre];
    if (!productoId) {
      logger.warn(`Producto no encontrado para combo: ${cp.nombre}`);
      continue;
    }
    await query(
      `INSERT INTO combo_productos (combo_id, producto_id, cantidad, tenant_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [cp.combo_id, productoId, cp.cantidad, tenantId]
    );
  }
  logger.info('Combos sembrados', { tenant_id: tenantId, combos: combos.length });
};

// ═══════════════════════════════════════════════
// 11. Usuarios extra (meseros, cajero, cocina, gerente)
// ═══════════════════════════════════════════════
const sembrarUsuariosExtra = async (tenantId, sucursalId) => {
  const SALT_ROUNDS = 12;
  const usuarios = [
    { id: 'e0000000-0000-4000-8000-000000000001', nombre: 'Carlos',     apellido: 'Martínez',  email: 'mesero1@demo.pos', pin: '111111', rol: 'mesero' },
    { id: 'e0000000-0000-4000-8000-000000000002', nombre: 'María',      apellido: 'López',      email: 'mesero2@demo.pos', pin: '222222', rol: 'mesero' },
    { id: 'e0000000-0000-4000-8000-000000000003', nombre: 'Pedro',      apellido: 'Ramírez',    email: 'cajero1@demo.pos',  pin: '333333', rol: 'cajero' },
    { id: 'e0000000-0000-4000-8000-000000000004', nombre: 'Ana',        apellido: 'Hernández',  email: 'cocina1@demo.pos',  pin: '444444', rol: 'cocinero' },
    { id: 'e0000000-0000-4000-8000-000000000005', nombre: 'Roberto',    apellido: 'García',     email: 'gerente@demo.pos',  pin: '555555', rol: 'gerente' },
  ];

  for (const u of usuarios) {
    const pinHash = await bcrypt.hash(u.pin, SALT_ROUNDS);
    await query(
      `INSERT INTO usuarios (id, tenant_id, sucursal_id, nombre, apellido, email, pin_hash, rol)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, apellido = EXCLUDED.apellido, rol = EXCLUDED.rol`,
      [u.id, tenantId, sucursalId, u.nombre, u.apellido, u.email, pinHash, u.rol]
    );
  }
  logger.info('Usuarios extra sembrados', { tenant_id: tenantId, usuarios: usuarios.length });
};

// ═══════════════════════════════════════════════
// 12. Clientes demo
// ═══════════════════════════════════════════════
const sembrarClientes = async (tenantId) => {
  const clientes = [
    { id: 'f0000000-0000-4000-8000-000000000001', nombre: 'Juan',        apellido: 'Pérez',      email: 'juan@email.com',     telefono: '7000-0001' },
    { id: 'f0000000-0000-4000-8000-000000000002', nombre: 'Elena',       apellido: 'Rodríguez',  email: 'elena@email.com',    telefono: '7000-0002' },
    { id: 'f0000000-0000-4000-8000-000000000003', nombre: 'Luis',        apellido: 'Mendoza',    email: 'luis@email.com',     telefono: '7000-0003' },
    { id: 'f0000000-0000-4000-8000-000000000004', nombre: 'Sofía',       apellido: 'Cruz',       email: 'sofia@email.com',    telefono: '7000-0004' },
    { id: 'f0000000-0000-4000-8000-000000000005', nombre: 'Andrés',      apellido: 'Vásquez',    email: 'andres@email.com',   telefono: '7000-0005' },
    { id: 'f0000000-0000-4000-8000-000000000006', nombre: 'Carmen',      apellido: 'Flores',     email: 'carmen@email.com',   telefono: '7000-0006' },
    { id: 'f0000000-0000-4000-8000-000000000007', nombre: 'Ricardo',     apellido: 'Torres',     email: 'ricardo@email.com',  telefono: '7000-0007' },
    { id: 'f0000000-0000-4000-8000-000000000008', nombre: 'Gabriela',    apellido: 'Rivas',      email: 'gabriela@email.com', telefono: '7000-0008' },
    { id: 'f0000000-0000-4000-8000-000000000009', nombre: 'Francisco',   apellido: 'Díaz',       email: 'francisco@email.com', telefono: '7000-0009' },
    { id: 'f0000000-0000-4000-8000-000000000010', nombre: 'Mónica',      apellido: 'Guerrero',   email: 'monica@email.com',   telefono: '7000-0010' },
  ];

  for (const c of clientes) {
    await query(
      `INSERT INTO clientes (id, tenant_id, nombre, apellido, email, telefono)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, apellido = EXCLUDED.apellido`,
      [c.id, tenantId, c.nombre, c.apellido, c.email, c.telefono]
    );
  }
  logger.info('Clientes sembrados', { tenant_id: tenantId, clientes: clientes.length });
};

// ═══════════════════════════════════════════════
// 13. Órdenes, items, pagos, cajas y propinas demo
// ═══════════════════════════════════════════════
const sembrarOrdenesYMovimientos = async (tenantId, sucursalPrincipal, sucursalCentro) => {
  // Obtener IDs existentes
  const [{ rows: usuarios }, { rows: productos }, { rows: mesas }, { rows: ordenesExistentes }] = await Promise.all([
    query('SELECT id, rol FROM usuarios WHERE tenant_id = $1', [tenantId]),
    query('SELECT id, nombre, precio, categoria_id FROM productos WHERE tenant_id = $1', [tenantId]),
    query('SELECT id, numero FROM mesas WHERE tenant_id = $1', [tenantId]),
    query('SELECT id FROM ordenes WHERE tenant_id = $1', [tenantId]),
  ]);

  if (ordenesExistentes.length > 30) {
    logger.info('Ya existen suficientes órdenes demo, saltando generación.', { tenant_id: tenantId, ordenes: ordenesExistentes.length });
    return;
  }

  const admin = usuarios.find(u => u.rol === 'administrador');
  const meseros = usuarios.filter(u => u.rol === 'mesero');
  const adminId = admin?.id || usuarios[0]?.id;
  const meseroIds = meseros.map(m => m.id);
  const prodMap = productos.reduce((acc, p) => { acc[p.nombre] = p; return acc; }, {});
  const mesaNums = mesas.map(m => m.numero);

  const sucursales = [sucursalPrincipal, sucursalCentro];
  const origenes = ['pos', 'pos', 'pos', 'pos', 'pos', 'hugo', 'pedidosya', 'ubereats', 'whatsapp', 'telefono'];
  const tipos = ['rapido', 'rapido', 'rapido', 'rapido', 'mesa', 'mesa', 'delivery'];
  const estadosPagada = ['pagada', 'pagada', 'pagada', 'pagada', 'pagada', 'pagada', 'pagada', 'cancelada', 'abierta', 'en_proceso'];

  // Combinaciones de items por momento del día
  const combosItems = {
    desayuno: [
      [{ nombre: 'Café', cantidad: 1 }, { nombre: 'Pupusas revueltas', cantidad: 2 }],
      [{ nombre: 'Jugo natural', cantidad: 1 }, { nombre: 'Pupusas revueltas', cantidad: 3 }],
      [{ nombre: 'Café', cantidad: 1 }, { nombre: 'Pasta al pesto', cantidad: 1 }],
    ],
    almuerzo: [
      [{ nombre: 'Sopa del día', cantidad: 1 }, { nombre: 'Pollo a la plancha', cantidad: 1 }, { nombre: 'Agua natural', cantidad: 1 }],
      [{ nombre: 'Ensalada mixta', cantidad: 1 }, { nombre: 'Carne asada', cantidad: 1 }, { nombre: 'Refresco', cantidad: 1 }],
      [{ nombre: 'Ceviche de camarón', cantidad: 1 }, { nombre: 'Pasta al pesto', cantidad: 1 }, { nombre: 'Jugo natural', cantidad: 1 }],
      [{ nombre: 'Sopa del día', cantidad: 1 }, { nombre: 'Pollo a la plancha', cantidad: 1 }, { nombre: 'Refresco', cantidad: 1 }, { nombre: 'Flan', cantidad: 1 }],
      [{ nombre: 'Pupusas revueltas', cantidad: 4 }, { nombre: 'Refresco', cantidad: 2 }],
      [{ nombre: 'Ensalada mixta', cantidad: 1 }, { nombre: 'Pasta al pesto', cantidad: 1 }, { nombre: 'Agua natural', cantidad: 1 }],
    ],
    cena: [
      [{ nombre: 'Carne asada', cantidad: 1 }, { nombre: 'Sopa del día', cantidad: 1 }, { nombre: 'Café', cantidad: 1 }, { nombre: 'Pastel del día', cantidad: 1 }],
      [{ nombre: 'Pollo a la plancha', cantidad: 1 }, { nombre: 'Ceviche de camarón', cantidad: 1 }, { nombre: 'Refresco', cantidad: 2 }, { nombre: 'Helado', cantidad: 1 }],
      [{ nombre: 'Carne asada', cantidad: 2 }, { nombre: 'Refresco', cantidad: 2 }, { nombre: 'Flan', cantidad: 1 }],
      [{ nombre: 'Pasta al pesto', cantidad: 1 }, { nombre: 'Pollo a la plancha', cantidad: 1 }, { nombre: 'Vino', cantidad: 1, skip: true }, { nombre: 'Café', cantidad: 1 }, { nombre: 'Pastel del día', cantidad: 1 }],
      [{ nombre: 'Ceviche de camarón', cantidad: 2 }, { nombre: 'Jugo natural', cantidad: 2 }],
    ],
    madrugada: [
      [{ nombre: 'Pupusas revueltas', cantidad: 3 }, { nombre: 'Refresco', cantidad: 1 }],
      [{ nombre: 'Pasta al pesto', cantidad: 1 }, { nombre: 'Café', cantidad: 1 }],
    ],
  };

  // Métodos de pago con pesos de probabilidad
  const metodosPago = [
    { metodo: 'efectivo', peso: 40 },
    { metodo: 'tarjeta_debito', peso: 25 },
    { metodo: 'tarjeta_credito', peso: 15 },
    { metodo: 'transferencia', peso: 8 },
    { metodo: 'mixto', peso: 5 },
    { metodo: 'bitcoin', peso: 3 },
    { metodo: 'monedero_electronico', peso: 2 },
    { metodo: 'cheque', peso: 1 },
    { metodo: 'otro', peso: 1 },
  ];

  const elegirPonderado = (arr, pesoKey = 'peso') => {
    const total = arr.reduce((s, x) => s + x[pesoKey], 0);
    let r = Math.random() * total;
    for (const x of arr) {
      r -= x[pesoKey];
      if (r <= 0) return x;
    }
    return arr[0];
  };

  const elegir = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Generar ~50 órdenes
  const hoy = new Date();
  const ordenesAGenerar = 50;
  const CREADAS = []; // { id, fecha, sucursalId, usuarioId, estado, tipo, origen, items, mesaNum, clienteId }

  for (let i = 0; i < ordenesAGenerar; i++) {
    const id = crypto.randomUUID();
    const diasAtras = Math.floor(Math.random() * 30);
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() - diasAtras);
    fecha.setSeconds(0, 0);

    const diaSem = fecha.getDay(); // 0=domingo
    const esFinde = diaSem === 5 || diaSem === 6 || diaSem === 0;

    // Horario según momento del día
    const randHora = Math.random();
    let horaBase, momento;
    if (randHora < 0.08) {
      horaBase = 7 + Math.random() * 2;
      momento = 'desayuno';
    } else if (randHora < 0.45) {
      horaBase = 11.5 + Math.random() * 2.5;
      momento = 'almuerzo';
    } else if (randHora < 0.85) {
      horaBase = 18 + Math.random() * 3;
      momento = 'cena';
    } else {
      horaBase = 21.5 + Math.random() * 1.5;
      momento = 'madrugada';
    }
    fecha.setHours(Math.floor(horaBase), Math.floor((horaBase % 1) * 60), Math.floor(Math.random() * 60));

    // Más órdenes en finde
    const factorFinde = esFinde ? 1.5 : 1;
    if (Math.random() > factorFinde * 0.6) continue; // Skip aleatorio para distribución realista

    // Mezcla de tipos y origenes
    const tipo = elegir(tipos);
    const origen = elegir(origenes);
    const estado = elegir(estadosPagada);
    const sucursalId = esFinde ? elegir(sucursales) : (Math.random() < 0.6 ? sucursalPrincipal : sucursalCentro);

    // Items según momento
    const opcionesItems = combosItems[momento] || combosItems.almuerzo;
    const itemsSeleccion = elegir(opcionesItems).filter(it => !it.skip);

    // Usuario (cocina/gerente solo para estados específicos)
    const usuarioId = estado === 'en_proceso' && meseroIds.length > 0
      ? elegir(meseroIds)
      : estado === 'pagada'
        ? elegir([...meseroIds, adminId])
        : elegir([adminId, ...meseroIds]);

    // Mesa si aplica
    const mesaNum = tipo === 'mesa' ? elegir(mesaNums) : null;

    // Cliente para delivery
    let clienteId = null;
    if (origen === 'hugo' || origen === 'pedidosya' || origen === 'ubereats' || origen === 'whatsapp' || origen === 'telefono') {
      clienteId = `f0000000-0000-4000-8000-00000000000${Math.floor(Math.random() * 9) + 1}`;
    } else if (Math.random() < 0.2) {
      clienteId = `f0000000-0000-4000-8000-00000000000${Math.floor(Math.random() * 9) + 1}`;
    }

    CREADAS.push({ id, fecha, sucursalId, usuarioId, estado, tipo, origen, items: itemsSeleccion, mesaNum, clienteId, momento });
  }

  // Ordenar por fecha ascendente
  CREADAS.sort((a, b) => a.fecha - b.fecha);

  // Variable para correlativo (lo genera un trigger, así que no lo seteamos)
  // Variable para caja: crearemos cajas semanales
  const cajasPorSucursal = {};
  const cajasIds = [];
  const fechaHoy = new Date(hoy);

  // Crear cajas semanales para cada sucursal con UUIDs deterministas
  for (const sucId of sucursales) {
    for (let s = 4; s >= 0; s--) {
      const apertura = new Date(fechaHoy);
      apertura.setDate(apertura.getDate() - s * 7);
      apertura.setHours(6, 30, 0, 0);

      // UUID determinista: c0000000-0000-4000-8{semana}-000000{sucursalIndex}
      // Donde sucursalIndex = 1 para Principal, 2 para Centro
      const sucIdx = sucId === sucursalPrincipal ? '01' : '02';
      const cajaId = `c0000000-0000-4000-800${s}-000000${sucIdx}0001`;
      const cerrada = s > 0;
      const cierre = new Date(apertura);
      cierre.setHours(cerrada ? 22 : 23, 0, 0, 0);

      await query(
        `INSERT INTO cajas (id, tenant_id, sucursal_id, usuario_apertura_id, usuario_cierre_id, estado,
           monto_inicial, total_esperado, monto_final, diferencia, total_ventas,
           total_efectivo, total_tarjeta, notas_cierre, fecha_apertura, fecha_cierre)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (id) DO NOTHING`,
        [
          cajaId, tenantId, sucId, adminId, cerrada ? adminId : null,
          cerrada ? 'cerrada' : 'abierta',
          200.00, 0, cerrada ? 1200 + Math.random() * 400 : null,
          0, 0, 0, 0, cerrada ? 'Cierre automático' : null,
          apertura, cerrada ? cierre : null,
        ]
      );

      if (!cajasPorSucursal[sucId]) cajasPorSucursal[sucId] = [];
      cajasPorSucursal[sucId].push({ id: cajaId, apertura, cierre: cerrada ? cierre : null });
      cajasIds.push({ id: cajaId, sucursalId: sucId, apertura });
    }
  }

  logger.info('Cajas demo sembradas', { cajas: cajasIds.length });

  // Insertar órdenes e items
  let totalOrdenesInsertadas = 0;
  let totalItemsInsertados = 0;
  let totalPagosInsertados = 0;
  let totalMovimientosInsertados = 0;

  for (const orden of CREADAS) {
    // Calcular subtotales de items
    let subtotal = 0;
    const itemsInsertar = [];

    for (const item of orden.items) {
      const prod = prodMap[item.nombre];
      if (!prod) continue;
      const precioUnitario = prod.precio;
      const itemSubtotal = +(precioUnitario * item.cantidad).toFixed(2);
      subtotal += itemSubtotal;
      itemsInsertar.push({
        id: crypto.randomUUID(),
        productoId: prod.id,
        nombre_producto: item.nombre,
        precioUnitario,
        cantidad: item.cantidad,
        subtotal: itemSubtotal,
      });
    }

    if (itemsInsertar.length === 0) continue;

    // Descuento aleatorio (0-10% en algunas órdenes)
    const descuentoPorc = Math.random() < 0.15 ? elegir([5, 10, 15]) : 0;
    const descuento = +(subtotal * descuentoPorc / 100).toFixed(2);
    const total = +(subtotal - descuento).toFixed(2);

    // IVA
    const gravado = +(total * 0.87).toFixed(2);
    const iva = +(total * 0.13).toFixed(2);

    await query(
      `INSERT INTO ordenes (id, tenant_id, sucursal_id, tipo, estado, mesa_id, cliente_id, usuario_id,
         subtotal, porcentaje_descuento, descuento, total, gravado, iva, notas, creado_en, cerrado_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO NOTHING`,
      [
        orden.id, tenantId, orden.sucursalId, orden.tipo, orden.estado,
        orden.mesaNum ? (await query('SELECT id FROM mesas WHERE tenant_id=$1 AND numero=$2', [tenantId, orden.mesaNum])).rows[0]?.id || null : null,
        orden.clienteId, orden.usuarioId,
        subtotal, descuentoPorc, descuento, total, gravado, iva,
        orden.origen === 'delivery' || orden.origen === 'hugo' || orden.origen === 'pedidosya'
          ? `Orden #${orden.id.slice(0, 8)}` : null,
        orden.fecha,
        ['pagada', 'cancelada'].includes(orden.estado) ? orden.fecha : null,
      ]
    );
    totalOrdenesInsertadas++;

    // Insertar items
    for (const item of itemsInsertar) {
      const estadoItem = orden.estado === 'cancelada' ? 'cancelado'
        : orden.estado === 'pagada' ? 'listo'
        : orden.estado === 'abierta' ? 'pendiente'
        : elegir(['pendiente', 'en_proceso', 'listo']);

      await query(
        `INSERT INTO orden_items (id, orden_id, tenant_id, producto_id, nombre_producto, precio_unitario, cantidad, subtotal, estado, creado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,
        [item.id, orden.id, tenantId, item.productoId, item.nombre_producto, item.precioUnitario, item.cantidad, item.subtotal, estadoItem, orden.fecha]
      );
      totalItemsInsertados++;
    }

    // Propina en algunas órdenes pagadas (25%)
    if (orden.estado === 'pagada' && Math.random() < 0.3) {
      const propinaPorc = elegir([5, 10, 10, 10, 15]);
      const propinaMonto = +(total * propinaPorc / 100).toFixed(2);
      await query(
        'UPDATE ordenes SET propina_porcentaje = $1, propina_monto = $2 WHERE id = $3',
        [propinaPorc, propinaMonto, orden.id]
      );
    }

    // Pago para órdenes pagadas y canceladas (las órdenes pagadas tienen pago real)
    if (orden.estado === 'pagada' || orden.estado === 'cancelada') {
      const metodo = elegirPonderado(metodosPago);
      const pagoId = crypto.randomUUID();

      if (metodo.metodo === 'mixto') {
        const montoEfectivo = +(total * (0.3 + Math.random() * 0.4)).toFixed(2);
        const montoTarjeta = +(total - montoEfectivo).toFixed(2);
        await query(
          `INSERT INTO pagos (id, orden_id, tenant_id, metodo, monto_efectivo, monto_tarjeta, total_pagado, vuelto, usuario_id, creado_en)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,
          [pagoId, orden.id, tenantId, 'mixto', montoEfectivo, montoTarjeta, total, +(montoEfectivo - total + montoTarjeta).toFixed(2), orden.usuarioId, orden.fecha]
        );
      } else if (metodo.metodo === 'efectivo') {
        const vuelto = +(Math.ceil(total / 5) * 5 - total).toFixed(2);
        await query(
          `INSERT INTO pagos (id, orden_id, tenant_id, metodo, monto_efectivo, total_pagado, vuelto, usuario_id, creado_en)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
          [pagoId, orden.id, tenantId, 'efectivo', total, total, vuelto >= 0 ? vuelto : 0, orden.usuarioId, orden.fecha]
        );
      } else {
        await query(
          `INSERT INTO pagos (id, orden_id, tenant_id, metodo, monto_tarjeta, total_pagado, usuario_id, creado_en)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
          [pagoId, orden.id, tenantId, metodo.metodo, total, total, orden.usuarioId, orden.fecha]
        );
      }
      totalPagosInsertados++;

      // Movimiento de caja para la caja correspondiente
      const cajaSuc = cajasPorSucursal[orden.sucursalId];
      if (cajaSuc) {
        const cajaAsignada = cajaSuc.find(c => orden.fecha >= c.apertura && (!c.cierre || orden.fecha <= c.cierre))
          || cajaSuc[cajaSuc.length - 1];
        if (cajaAsignada) {
          await query(
            `INSERT INTO movimientos_caja (id, caja_id, tenant_id, tipo, monto, motivo, usuario_id, orden_id, metodo_pago, creado_en)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,
            [crypto.randomUUID(), cajaAsignada.id, tenantId, 'ingreso', total, `Pago orden`, orden.usuarioId, orden.id, metodo.metodo, orden.fecha]
          );
          totalMovimientosInsertados++;
        }
      }
    }

    // Marcar mesa como ocupada si es tipo mesa
    if (orden.mesaNum && orden.estado !== 'cancelada') {
      const mesaRow = (await query('SELECT id FROM mesas WHERE tenant_id=$1 AND numero=$2', [tenantId, orden.mesaNum])).rows[0];
      if (mesaRow) {
        await query(
          'UPDATE mesas SET estado = $1 WHERE id = $2 AND tenant_id = $3',
          [orden.estado === 'pagada' ? 'disponible' : 'ocupada', mesaRow.id, tenantId]
        );
      }
    }
  }

  logger.info('Órdenes demo sembradas', { ordenes: totalOrdenesInsertadas, items: totalItemsInsertados, pagos: totalPagosInsertados, movimientos: totalMovimientosInsertados });
};

const ejecutarSeed = async () => {
  logger.info('Iniciando seed de datos iniciales...');
  await verificarConexion();

  // 1. Verificar si ya existe el admin
  const { rows } = await query(
    'SELECT id FROM usuarios WHERE email = $1',
    [ADMIN_EMAIL]
  );

  const adminExistente = rows.length > 0;

  if (!adminExistente) {
    // 2. Generar hashes
    const SALT_ROUNDS = 12;
    const pinHash      = await bcrypt.hash(ADMIN_PIN, SALT_ROUNDS);
    const passwordHash = await bcrypt.hash(ADMIN_PASS, SALT_ROUNDS);

    // 3. Insertar usuario administrador
    await query(
      `INSERT INTO usuarios
         (tenant_id, sucursal_id, nombre, apellido, email, password_hash, pin_hash, rol)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'administrador')`,
      [
        TENANT_ID,
        SUCURSAL_ID,
        'Admin',
        'Demo',
        ADMIN_EMAIL,
        passwordHash,
        pinHash,
      ]
    );
  }

  // 4. Sembrar permisos default para los 5 roles del tenant demo (siempre, idempotente)
  await sembrarPermisosTenant(TENANT_ID);

  // 5. Sembrar menús default del sidebar (siempre, idempotente)
  await sembrarMenusTenant(TENANT_ID);

  // 6. Sembrar catálogos default (siempre, idempotente)
  await query('CALL sp_sembrar_catalogos_tenant($1)', [TENANT_ID]);

  // 7. Sembrar categorías de ejemplo
  await sembrarCategorias(TENANT_ID);

  // 8. Sembrar productos de ejemplo
  await sembrarProductos(TENANT_ID);

  // 9. Sembrar mesas de ejemplo
  await sembrarMesas(TENANT_ID, SUCURSAL_ID);

  // 10. Sembrar combos de ejemplo
  await sembrarCombos(TENANT_ID);

  // 11. Sembrar usuarios extra (meseros, cajero, cocina, gerente)
  await sembrarUsuariosExtra(TENANT_ID, SUCURSAL_ID);

  // 12. Sembrar clientes demo
  await sembrarClientes(TENANT_ID);

  // 13. Sembrar órdenes, items, pagos, cajas y movimientos demo
  await sembrarOrdenesYMovimientos(TENANT_ID, SUCURSAL_ID, 'b0000000-0000-4000-8000-000000000002');

  logger.info('Seed completado exitosamente.');
  logger.info('─────────────────────────────────────');
  logger.info('Credenciales del administrador demo:');
  logger.info(`  Email:    ${ADMIN_EMAIL}`);
  logger.info(`  Password: ${ADMIN_PASS}`);
  logger.info(`  PIN:      ${ADMIN_PIN}`);
  logger.info('─────────────────────────────────────');
  logger.warn('IMPORTANTE: Cambia estas credenciales antes de producción.');

  process.exit(0);
};

// Solo ejecutar cuando se corre directamente (node src/migrations/seed.js),
// no cuando es importado como módulo por otro archivo
if (require.main === module) {
  ejecutarSeed().catch((err) => {
    logger.error('Error en seed', { error: err.message });
    process.exit(1);
  });
}

module.exports = { sembrarPermisosTenant, sembrarMenusTenant, sembrarUsuariosExtra, sembrarClientes, sembrarOrdenesYMovimientos };
