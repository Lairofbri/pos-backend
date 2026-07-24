import { test, expect } from '@playwright/test'
import { getAuthContext } from '../helpers/api'

test.describe('Caja API', () => {
  test('GET /api/caja/activa — debe devolver estado de caja', async () => {
    const ctx = await getAuthContext()
    const res = await ctx.get('/api/caja/activa')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('ok')
  })
})
