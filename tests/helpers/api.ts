import { request } from '@playwright/test'

const API_URL = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3000'
const TENANT_ID = process.env.PLAYWRIGHT_TENANT_ID || 'a0000000-0000-4000-8000-000000000001'

export async function getApiContext() {
  return await request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: {
      'X-Tenant-Id': TENANT_ID,
      'Content-Type': 'application/json',
    },
  })
}

export async function loginComoAdmin() {
  const context = await getApiContext()
  const res = await context.post('/api/auth/login', {
    data: { tenant_id: TENANT_ID, email: 'admin@demo.pos', password: 'Admin123!' },
  })
  const body = await res.json()
  if (!body.data?.access_token) throw new Error(`Login failed: ${JSON.stringify(body)}`)
  return body.data.access_token
}

export async function getAuthContext() {
  const token = await loginComoAdmin()
  return await request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: {
      'X-Tenant-Id': TENANT_ID,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
}
