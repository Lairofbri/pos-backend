import { test, expect } from '@playwright/test'
import { getApiContext, getAuthContext } from '../helpers/api'

const TENANT_ID = process.env.PLAYWRIGHT_TENANT_ID || 'a0000000-0000-4000-8000-000000000001'

test.describe('Auth API', () => {
  test('POST /api/auth/login — debe devolver token con credenciales válidas', async () => {
    const ctx = await getApiContext()
    const res = await ctx.post('/api/auth/login', {
      data: { tenant_id: TENANT_ID, email: 'admin@demo.pos', password: 'Admin123!' },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveProperty('access_token')
  })

  test('POST /api/auth/login — debe devolver 401 con credenciales inválidas', async () => {
    const ctx = await getApiContext()
    const res = await ctx.post('/api/auth/login', {
      data: { tenant_id: TENANT_ID, email: 'admin@demo.pos', password: 'wrong-password' },
    })
    expect(res.status()).toBe(401)
  })

  test('GET /api/auth/me — debe devolver usuario autenticado', async () => {
    const ctx = await getAuthContext()
    const res = await ctx.get('/api/auth/me')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveProperty('usuario')
  })

  test('GET /api/auth/me — debe devolver 401 sin token', async () => {
    const ctx = await getApiContext()
    const res = await ctx.get('/api/auth/me')
    expect(res.status()).toBe(401)
  })
})
