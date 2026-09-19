const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const express = require('express')
const proxyquire = require('proxyquire').noPreserveCache()

process.env.NODE_ENV = 'test'

const CONFIG_VALIDA = { tendencia_caida_pct: 15, silencio_desde: '22:00', silencio_hasta: '06:00', cooldown_minutos: 60 }

function buildApp(overrides = {}) {
  const state = { evaluarLlamado: 0 }

  const service = {
    '@noCallThru': true,
    obtenerAlertas: async () => [{ id: 'stock-bajo', severity: 'critical', titulo: 'Stock bajo', descripcion: 'x', desde: '2026-08-24T10:00:00.000Z' }],
    obtenerConfigAlertas: async () => ({ ...CONFIG_VALIDA }),
    guardarConfigAlertas: async ({ datos }) => ({ ...CONFIG_VALIDA, ...datos }),
    resolverAlerta: async () => ({ alerta_id: 'stock-bajo', silenciada_hasta: '2026-08-24T12:00:00.000Z' }),
    listarHistorialAlertas: async () => [],
    ...overrides.service,
  }

  const notificar = {
    '@noCallThru': true,
    evaluarYNotificar: async () => { state.evaluarLlamado++; return true },
  }

  const { handler, resolverHandler, historialHandler, configGetHandler, configPutHandler } = proxyquire(
    '../../dist/features/alertas/handler.js',
    {
      './service.js': service,
      './notificar.js': notificar,
    }
  )

  const app = express()
  app.use(express.json({ limit: '2mb' }))
  app.use((req, _res, next) => {
    req.usuario = { id: 'u1', tenant_id: 'a0000000-0000-4000-8000-000000000001', rol: 'administrador' }
    next()
  })
  app.get('/api/alertas', handler)
  app.post('/api/alertas/:alertaId/resolver', resolverHandler)
  app.get('/api/alertas/historial', historialHandler)
  app.get('/api/alertas/config', configGetHandler)
  app.put('/api/alertas/config', configPutHandler)
  app.use((err, _req, res, _next) => res.status(500).json({ ok: false, mensaje: err?.message || 'Error interno.' }))

  return { app, state }
}

describe('Alertas API - Integration Tests', () => {
  it('GET /api/alertas devuelve la lista con la forma esperada', async () => {
    const { app } = buildApp()
    const res = await request(app).get('/api/alertas')
    assert.equal(res.status, 200)
    assert.equal(res.body.ok, true)
    assert.equal(res.body.data.alertas.length, 1)
    assert.equal(res.body.data.alertas[0].id, 'stock-bajo')
  })

  it('POST /api/alertas/:id/resolver devuelve 200 y propaga via socket', async () => {
    const { app, state } = buildApp()
    const res = await request(app).post('/api/alertas/stock-bajo/resolver')
    assert.equal(res.status, 200)
    assert.equal(res.body.data.alerta_id, 'stock-bajo')
    assert.equal(state.evaluarLlamado, 1)
  })

  it('POST resolver devuelve 404 cuando la alerta no esta activa', async () => {
    const { app } = buildApp({
      service: { resolverAlerta: async () => { throw { status: 404, mensaje: 'La alerta no está activa o no existe.' } } },
    })
    const res = await request(app).post('/api/alertas/stock-bajo/resolver')
    assert.equal(res.status, 404)
    assert.equal(res.body.ok, false)
  })

  it('GET /api/alertas/historial devuelve el historial', async () => {
    const { app } = buildApp({
      service: { listarHistorialAlertas: async () => [{ alerta_id: 'stock-bajo', estado: 'resuelta' }] },
    })
    const res = await request(app).get('/api/alertas/historial')
    assert.equal(res.status, 200)
    assert.equal(res.body.data.historial.length, 1)
  })

  it('GET /api/alertas/config devuelve la configuracion', async () => {
    const { app } = buildApp()
    const res = await request(app).get('/api/alertas/config')
    assert.equal(res.status, 200)
    assert.equal(res.body.data.config.tendencia_caida_pct, 15)
  })

  it('PUT /api/alertas/config guarda y propaga via socket', async () => {
    const { app, state } = buildApp()
    const res = await request(app).put('/api/alertas/config').send({ tendencia_caida_pct: 20 })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.config.tendencia_caida_pct, 20)
    assert.equal(state.evaluarLlamado, 1)
  })

  it('PUT /api/alertas/config rechaza valores fuera de rango (400)', async () => {
    const { app } = buildApp()
    const res = await request(app).put('/api/alertas/config').send({ tendencia_caida_pct: 500 })
    assert.equal(res.status, 400)
    assert.equal(res.body.ok, false)
  })

  it('PUT /api/alertas/config rechaza formato de hora invalido (400)', async () => {
    const { app } = buildApp()
    const res = await request(app).put('/api/alertas/config').send({ silencio_desde: '25:99' })
    assert.equal(res.status, 400)
    assert.equal(res.body.ok, false)
  })
})