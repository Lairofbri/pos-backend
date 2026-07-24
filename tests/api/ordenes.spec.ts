import { test, expect } from '@playwright/test'
import { getAuthContext } from '../helpers/api'

test.describe('Órdenes API', () => {
  test('GET /api/ordenes — debe devolver lista de órdenes', async () => {
    const ctx = await getAuthContext()
    const res = await ctx.get('/api/ordenes')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('ok')
  })
})
