const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const express = require('express')
const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const proxyquire = require('proxyquire').noPreserveCache()

const V4_UUID = () => crypto.randomUUID()

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-' + crypto.randomBytes(48).toString('hex')
process.env.JWT_REFRESH_SECRET = 'test-refresh-' + crypto.randomBytes(48).toString('hex')

function buildMockService(overrides = {}) {
  const defaults = {
    loginEmail: () => Promise.resolve({ access_token: 'test-token', refresh_token: 'refresh-token', usuario: { id: 'u1', email: 'admin@test.com', nombre: 'Admin' } }),
    loginPin: () => Promise.resolve({ access_token: 'pin-token', refresh_token: 'refresh-token', usuario: { id: 'u2', nombre: 'Cashier' } }),
    refreshAccessToken: () => Promise.resolve({ access_token: 'refreshed-token', refresh_token: 'new-refresh-token' }),
    logout: () => Promise.resolve(),
    obtenerMe: () => Promise.resolve({ id: 'u1', nombre: 'Admin', email: 'admin@test.com' }),
    listarTenants: () => Promise.resolve({ tenants: [{ id: 'a1', nombre: 'Test' }], sucursales: [] }),
    listarUsuariosParaPin: () => Promise.resolve([]),
  }
  return { ...defaults, ...overrides }
}

function loadHandler(relPath, mockService) {
  return proxyquire(`../../dist/features/auth/${relPath}`, {
    '../shared.js': mockService,
  })
}

function buildAuthApp(mockOverrides) {
  const mockService = buildMockService(mockOverrides)
  const emailHandler = loadHandler('email/handler.js', mockService)
  const pinHandler = loadHandler('pin/handler.js', mockService)
  const refreshHandler = loadHandler('refresh/handler.js', mockService)
  const logoutHandler = loadHandler('logout/handler.js', mockService)
  const meHandler = loadHandler('me/handler.js', mockService)
  const empresasHandler = loadHandler('empresas/listar/handler.js', mockService)
  const pinListHandler = loadHandler('pin-list/handler.js', mockService)

  const { autenticar } = require('../../dist/shared/middlewares/auth.middleware.js')

  const router = express.Router()
  router.get('/empresas', empresasHandler.handler)
  router.post('/auth/login', emailHandler.handler)
  router.post('/auth/login-pin', pinHandler.handler)
  router.post('/auth/refresh', refreshHandler.handler)
  router.get('/usuarios/pin-list', pinListHandler.handler)
  router.post('/auth/logout', autenticar, logoutHandler.handler)
  router.get('/auth/me', autenticar, meHandler.handler)

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
      const token = jwt.sign({ sub: 'u1', tenant_id: 't1', rol: 'admin', nombre: 'Admin', email: 'admin@test.com' }, process.env.JWT_SECRET, { expiresIn: '1h' })
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
      const token = jwt.sign({ sub: 'u1', tenant_id: 't1', rol: 'admin', nombre: 'Admin', email: 'admin@test.com' }, process.env.JWT_SECRET, { expiresIn: '1h' })
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', 'refresh_token=test-refresh')
      assert.equal(res.status, 200)
    })
  })
})
