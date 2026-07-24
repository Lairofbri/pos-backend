import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/api',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_API_URL || 'http://localhost:3000',
    extraHTTPHeaders: {
      'X-Tenant-Id': process.env.PLAYWRIGHT_TENANT_ID || '550e8400-e29b-41d4-a716-446655440000',
      'Content-Type': 'application/json',
    },
  },
  projects: [
    { name: 'api' },
  ],
})
