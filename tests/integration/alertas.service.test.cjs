const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const proxyquire = require('proxyquire').noPreserveCache()

process.env.NODE_ENV = 'test'

const TENANT = 'a0000000-0000-4000-8000-000000000001'

function loadService({ db, caja, rentabilidad, evolucion }) {
  return proxyquire('../../dist/features/alertas/service.js', {
    '../../shared/config/database.js': { query: db.query, getClient: db.getClient },
    '../caja/shared.js': { obtenerCajaAbierta: caja },
    '../productos/rentabilidad/service.js': { listarRentabilidad: rentabilidad },
    '../productos/rentabilidad/evolucion.service.js': { obtenerEvolucion: evolucion },
  })
}

function buildDb({ configRow = null, stockBajo = 0, activas = [], onQuery = null, onClientQuery = null } = {}) {
  const query = async (sql, params = []) => {
    if (onQuery) onQuery(sql, params)
    if (sql.includes('alertas_config') && sql.includes('WHERE tenant_id = $1')) {
      return configRow ? { rows: [configRow] } : { rows: [] }
    }
    if (sql.includes('INSERT INTO alertas_config')) return { rows: [] }
    if (sql.includes('COUNT(*)') && sql.includes('stock_minimo')) {
      return { rows: [{ cantidad: stockBajo }] }
    }
    if (sql.includes("UPDATE alertas_estado") && sql.includes("estado = 'resuelta'")) {
      return { rows: [] }
    }
    return { rows: [] }
  }
  const client = {
    query: async (sql, params = []) => {
      if (onClientQuery) onClientQuery(sql, params)
      if (sql.includes('INSERT INTO alertas_estado')) return { rows: [] }
      if (sql.includes('UPDATE alertas_estado')) return { rows: [] }
      if (sql.includes('SELECT alerta_id, primera_deteccion')) return { rows: activas }
      return { rows: [] }
    },
    release: () => {},
  }
  const getClient = async () => client
  return { query, getClient }
}

const SIN_PERDIDA = { productos: [{ id: 'p1', alerta: 'ganancia' }] }
const CON_PERDIDA = { productos: [{ id: 'p1', alerta: 'perdida' }, { id: 'p2', alerta: 'ganancia' }] }
const TENDENCIA_ESTABLE = [
  { fecha: '2026-08-21', ingresos: 100 },
  { fecha: '2026-08-22', ingresos: 110 },
  { fecha: '2026-08-23', ingresos: 105 },
]
const TENDENCIA_CAIDA_20 = [
  { fecha: '2026-08-21', ingresos: 100 },
  { fecha: '2026-08-22', ingresos: 90 },
  { fecha: '2026-08-23', ingresos: 80 },
]

describe('Alertas service - enHorarioSilencioso', () => {
  const service = loadService({ db: buildDb(), caja: async () => null, rentabilidad: async () => SIN_PERDIDA, evolucion: async () => TENDENCIA_ESTABLE })

  it('retorna false sin horario configurado', () => {
    assert.equal(service.enHorarioSilencioso({ silencio_desde: null, silencio_hasta: null }), false)
  })

  it('true dentro del rango diurno', () => {
    const config = { silencio_desde: '09:00', silencio_hasta: '13:00' }
    assert.equal(service.enHorarioSilencioso(config, new Date('2026-08-24T10:30:00')), true)
  })

  it('false fuera del rango', () => {
    const config = { silencio_desde: '09:00', silencio_hasta: '13:00' }
    assert.equal(service.enHorarioSilencioso(config, new Date('2026-08-24T15:00:00')), false)
  })

  it('true en rango que cruza medianoche (23:00)', () => {
    const config = { silencio_desde: '22:00', silencio_hasta: '06:00' }
    assert.equal(service.enHorarioSilencioso(config, new Date('2026-08-24T23:00:00')), true)
  })

  it('true en rango que cruza medianoche (03:00)', () => {
    const config = { silencio_desde: '22:00', silencio_hasta: '06:00' }
    assert.equal(service.enHorarioSilencioso(config, new Date('2026-08-24T03:00:00')), true)
  })

  it('false fuera del rango que cruza medianoche (12:00)', () => {
    const config = { silencio_desde: '22:00', silencio_hasta: '06:00' }
    assert.equal(service.enHorarioSilencioso(config, new Date('2026-08-24T12:00:00')), false)
  })
})

describe('Alertas service - obtenerConfigAlertas', () => {
  it('devuelve defaults y siembra la fila cuando no existe', async () => {
    const db = buildDb({ configRow: null })
    const service = loadService({ db, caja: async () => null, rentabilidad: async () => SIN_PERDIDA, evolucion: async () => TENDENCIA_ESTABLE })
    const config = await service.obtenerConfigAlertas({ tenantId: TENANT })
    assert.deepEqual(config, { tendencia_caida_pct: 10, silencio_desde: null, silencio_hasta: null, cooldown_minutos: 120 })
  })

  it('parsea la fila existente', async () => {
    const db = buildDb({ configRow: { tendencia_caida_pct: '5', silencio_desde: '22:00:00', silencio_hasta: '06:00:00', cooldown_minutos: 30 } })
    const service = loadService({ db, caja: async () => null, rentabilidad: async () => SIN_PERDIDA, evolucion: async () => TENDENCIA_ESTABLE })
    const config = await service.obtenerConfigAlertas({ tenantId: TENANT })
    assert.deepEqual(config, { tendencia_caida_pct: 5, silencio_desde: '22:00', silencio_hasta: '06:00', cooldown_minutos: 30 })
  })
})

describe('Alertas service - obtenerAlertas', () => {
  it('sin alertas activas devuelve [] y auto-resuelve', async () => {
    const db = buildDb({ stockBajo: 0, activas: [] })
    const service = loadService({ db, caja: async () => ({ id: 'c1' }), rentabilidad: async () => SIN_PERDIDA, evolucion: async () => TENDENCIA_ESTABLE })
    const alertas = await service.obtenerAlertas({ tenantId: TENANT })
    assert.deepEqual(alertas, [])
  })

  it('stock bajo genera alerta critical con accion', async () => {
    const activa = {
      alerta_id: 'stock-bajo',
      primera_deteccion: '2026-08-24T10:00:00.000Z',
      ultimo_titulo: 'Stock bajo de ingredientes',
      ultima_descripcion: '2 productos tienen stock por debajo del mínimo.',
      ultima_severidad: 'critical',
      ultima_accion: JSON.stringify({ label: 'Ver inventario', ruta: '/admin/inventario' }),
    }
    const db = buildDb({ stockBajo: 2, activas: [activa] })
    const service = loadService({ db, caja: async () => ({ id: 'c1' }), rentabilidad: async () => SIN_PERDIDA, evolucion: async () => TENDENCIA_ESTABLE })
    const alertas = await service.obtenerAlertas({ tenantId: TENANT })
    assert.equal(alertas.length, 1)
    assert.equal(alertas[0].id, 'stock-bajo')
    assert.equal(alertas[0].severity, 'critical')
    assert.deepEqual(alertas[0].accion, { label: 'Ver inventario', ruta: '/admin/inventario' })
    assert.equal(alertas[0].desde, '2026-08-24T10:00:00.000Z')
  })

  it('soporta ultima_accion ya parseada por pg (objeto)', async () => {
    const activa = {
      alerta_id: 'caja-cerrada',
      primera_deteccion: '2026-08-24T10:00:00.000Z',
      ultimo_titulo: 'Caja cerrada',
      ultima_descripcion: 'No hay caja abierta.',
      ultima_severidad: 'info',
      ultima_accion: { label: 'Ir a caja', ruta: '/admin/caja' },
    }
    const db = buildDb({ stockBajo: 0, activas: [activa] })
    const service = loadService({ db, caja: async () => null, rentabilidad: async () => SIN_PERDIDA, evolucion: async () => TENDENCIA_ESTABLE })
    const alertas = await service.obtenerAlertas({ tenantId: TENANT })
    assert.equal(alertas[0].id, 'caja-cerrada')
    assert.deepEqual(alertas[0].accion, { label: 'Ir a caja', ruta: '/admin/caja' })
  })

  it('orden de severidad: critical antes que info', async () => {
    const activas = [
      {
        alerta_id: 'caja-cerrada', primera_deteccion: '2026-08-24T10:00:00.000Z',
        ultimo_titulo: 'Caja cerrada', ultima_descripcion: 'x', ultima_severidad: 'info', ultima_accion: null,
      },
      {
        alerta_id: 'stock-bajo', primera_deteccion: '2026-08-24T10:00:00.000Z',
        ultimo_titulo: 'Stock bajo', ultima_descripcion: 'x', ultima_severidad: 'critical', ultima_accion: null,
      },
    ]
    const db = buildDb({ stockBajo: 1, activas })
    const service = loadService({ db, caja: async () => null, rentabilidad: async () => SIN_PERDIDA, evolucion: async () => TENDENCIA_ESTABLE })
    const alertas = await service.obtenerAlertas({ tenantId: TENANT })
    assert.deepEqual(alertas.map(a => a.id), ['stock-bajo', 'caja-cerrada'])
  })

  it('tendencia: alerta cuando la caida supera el umbral configurado', async () => {
    const activa = {
      alerta_id: 'tendencia-bajando',
      primera_deteccion: '2026-08-24T10:00:00.000Z',
      ultimo_titulo: 'Ventas en descenso',
      ultima_descripcion: 'Los ingresos cayeron un 20% en los últimos 3 días.',
      ultima_severidad: 'warning',
      ultima_accion: null,
    }
    const db = buildDb({ configRow: { tendencia_caida_pct: '5', silencio_desde: null, silencio_hasta: null, cooldown_minutos: 120 }, activas: [activa] })
    const service = loadService({ db, caja: async () => ({ id: 'c1' }), rentabilidad: async () => SIN_PERDIDA, evolucion: async () => TENDENCIA_CAIDA_20 })
    const alertas = await service.obtenerAlertas({ tenantId: TENANT })
    assert.equal(alertas.length, 1)
    assert.equal(alertas[0].id, 'tendencia-bajando')
    assert.equal(alertas[0].severity, 'warning')
  })

  it('tendencia: sin alerta cuando la caida esta por debajo del umbral', async () => {
    const db = buildDb({ configRow: { tendencia_caida_pct: '25', silencio_desde: null, silencio_hasta: null, cooldown_minutos: 120 } })
    const service = loadService({ db, caja: async () => ({ id: 'c1' }), rentabilidad: async () => SIN_PERDIDA, evolucion: async () => TENDENCIA_CAIDA_20 })
    const alertas = await service.obtenerAlertas({ tenantId: TENANT })
    assert.deepEqual(alertas, [])
  })
})

describe('Alertas service - resolverAlerta', () => {
  it('aplica el cooldown configurado en silenciada_hasta', async () => {
    let cooldownParam = null
    const db = buildDb()
    db.query = async (sql, params = []) => {
      if (sql.includes('alertas_config') && sql.includes('WHERE tenant_id = $1')) {
        return { rows: [{ tendencia_caida_pct: '10', silencio_desde: null, silencio_hasta: null, cooldown_minutos: 30 }] }
      }
      if (sql.includes('UPDATE alertas_estado') && sql.includes('silenciada_hasta = NOW()')) {
        cooldownParam = params[2]
        return { rows: [{ alerta_id: 'stock-bajo', silenciada_hasta: '2026-08-24T12:00:00.000Z' }] }
      }
      return { rows: [] }
    }
    const service = loadService({ db, caja: async () => null, rentabilidad: async () => SIN_PERDIDA, evolucion: async () => TENDENCIA_ESTABLE })
    const resultado = await service.resolverAlerta({ tenantId: TENANT, alertaId: 'stock-bajo' })
    assert.equal(cooldownParam, '30 minutes')
    assert.equal(resultado.alerta_id, 'stock-bajo')
  })

  it('lanza 404 si la alerta no esta activa', async () => {
    const db = buildDb()
    db.query = async (sql) => {
      if (sql.includes('alertas_config') && sql.includes('WHERE tenant_id = $1')) {
        return { rows: [{ tendencia_caida_pct: '10', silencio_desde: null, silencio_hasta: null, cooldown_minutos: 120 }] }
      }
      return { rows: [] }
    }
    const service = loadService({ db, caja: async () => null, rentabilidad: async () => SIN_PERDIDA, evolucion: async () => TENDENCIA_ESTABLE })
    await assert.rejects(
      () => service.resolverAlerta({ tenantId: TENANT, alertaId: 'stock-bajo' }),
      (err) => err.status === 404,
    )
  })
})