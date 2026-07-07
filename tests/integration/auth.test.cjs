const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const express = require('express')
const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const proxyquire = require('proxyquire').noPreserveCache()

const V4_UUID = () => crypto.randomUUID()

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-1234567890'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0987654321'

function buildMockService(overrides = {}) {
  const defaults = {
    loginEmail: () => Promise.resolve({ access_token: 'test-token', usuario: { id: 'u1', email: 'admin@test.com', nombre: 'Admin' } }),
    loginPin: () => Promise.resolve({ access_token: 'pin-token', usuario: { id: 'u2', nombre: 'Cashier' } }),
    refreshAccessToken: () => Promise.resolve({ access_token: 'refreshed-token' }),
    logout: () => Promise.resolve(),
    obtenerMe: () => Promise.resolve({ id: 'u1', nombre: 'Admin', email: 'admin@test.com' }),
    listarTenants: () => Promise.resolve([{ id: 'a1', nombre: 'Test' }]),
    listarUsuariosParaPin: () => Promise.resolve([]),
    listarUsuarios: () => Promise.resolve([]),
    obtenerUsuario: () => { throw { status: 404, mensaje: 'No encontrado' } },
    crearUsuario: () => Promise.resolve({}),
    actualizarUsuario: () => Promise.resolve({}),
    resetearPin: () => Promise.resolve(),
    cambiarPin: () => Promise.resolve(),
    cambiarPassword: () => Promise.resolve(),
  }
  return { ...defaults, ...overrides }
}

function buildAuthApp(mockOverrides) {
  const mockService = buildMockService(mockOverrides)
  const authController = proxyquire('../../src/modules/auth/auth.controller', {
    './auth.service': mockService,
  })
  const { autenticar } = require('../../src/middlewares/auth.middleware')
  const router = express.Router()
  router.get('/empresas', authController.listarTenants)
  router.post('/auth/login', authController.loginEmail)
  router.post('/auth/login-pin', authController.loginPin)
  router.post('/auth/refresh', authController.refresh)
  router.get('/usuarios/pin-list', authController.listarUsuariosParaPin)
  router.post('/auth/logout', autenticar, authController.logout)
  router.get('/auth/me', autenticar, authController.me)

  const app = express()
  app.use(express.json({ limit: '2mb' }))
  app.use(cookieParser())
  app.use('/api', router)
  app.use((_req, res) => res.status(404).json({ ok: false, mensaje: 'No encontrada.' }))
  app.use((err, _req, res, _next) => res.status(500).json({ ok: false, mensaje: err?.message || 'Error interno.' }))
  return app
}

describe('Auth API - Integration Tests', () => {
  describe('POST /api/auth/login', () => {
    it('returns 200 with token for valid credentials', async () => {
      const app = buildAuthApp()
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'Admin123!', tenant_id: '00000000-0000-0000-0000-000000000001' })
      assert.equal(res.status, 200)
      assert.equal(res.body.data.access_token, 'test-token')
    })

    it('returns 401 when service rejects', async () => {
      const app = buildAuthApp({
        loginEmail: () => Promise.reject({ status: 401, mensaje: 'Credenciales incorrectas.' }),
      })
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrong@test.com', password: 'BadPass!', tenant_id: '00000000-0000-0000-0000-000000000001' })
      assert.equal(res.status, 401)
    })

    it('returns 400 when email is missing', async () => {
      const app = buildAuthApp()
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'Admin123!', tenant_id: '00000000-0000-0000-0000-000000000001' })
      assert.equal(res.status, 400)
    })

    it('returns 400 when tenant_id is missing', async () => {
      const app = buildAuthApp()
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'Admin123!' })
      assert.equal(res.status, 400)
    })
  })

  describe('POST /api/auth/login-pin', () => {
    it('returns 200 with token for valid PIN', async () => {
      const app = buildAuthApp()
      const res = await request(app)
        .post('/api/auth/login-pin')
        .set('X-Tenant-Id', V4_UUID())
        .send({ usuario_id: V4_UUID(), pin: '123456' })
      assert.equal(res.status, 200)
      assert.equal(res.status, 200)
      assert.equal(res.body.data.access_token, 'pin-token')
    })

    it('returns 400 when X-Tenant-Id is missing', async () => {
      const app = buildAuthApp()
      const res = await request(app)
        .post('/api/auth/login-pin')
        .send({ usuario_id: '00000000-0000-0000-0000-000000000001', pin: '123456' })
      assert.equal(res.status, 400)
    })
  })

  describe('GET /api/auth/me', () => {
    it('returns user data with valid token', async () => {
      const app = buildAuthApp()
      const token = jwt.sign({ sub: 'u1', tenant_id: 't1', rol: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' })
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
      assert.equal(res.status, 200)
      assert.equal(res.body.data.usuario.nombre, 'Admin')
    })

    it('returns 401 without token', async () => {
      const app = buildAuthApp()
      const res = await request(app).get('/api/auth/me')
      assert.equal(res.status, 401)
    })

    it('returns 401 with invalid token', async () => {
      const app = buildAuthApp()
      const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer bad-token')
      assert.equal(res.status, 401)
    })
  })

  describe('POST /api/auth/refresh', () => {
    it('returns 200 with new token', async () => {
      const app = buildAuthApp()
      const res = await request(app).post('/api/auth/refresh').set('Cookie', 'refresh_token=test-refresh')
      assert.equal(res.status, 200)
      assert.equal(res.body.data.access_token, 'refreshed-token')
    })
  })

  describe('POST /api/auth/logout', () => {
    it('returns 200', async () => {
      const app = buildAuthApp()
      const token = jwt.sign({ sub: 'u1' }, process.env.JWT_SECRET, { expiresIn: '1h' })
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', 'refresh_token=test-refresh')
      assert.equal(res.status, 200)
    })
  })
})
