import { test, expect } from '@playwright/test'

test.describe('Gerar-exportar Page', () => {
  test('should redirect to /auth when not authenticated', async ({ page }) => {
    // Warmup: visit an unauthenticated page first to trigger dev server compilation
    await page.goto('/auth', { waitUntil: 'networkidle', timeout: 60000 })
    await expect(page.getByRole('heading', { name: /acesso|sistema|entrar/i })).toBeVisible({ timeout: 15000 })

    // Now navigate to the protected page — should redirect to /auth
    await page.goto('/gerar-exportar', { timeout: 60000 })
    await page.waitForURL(/\/auth/, { timeout: 20000 })
  })

  test('should be accessible when unauthenticated test runs after warmup', async ({ page }) => {
    // Just validate /auth renders properly after warmup
    await page.goto('/auth', { waitUntil: 'networkidle', timeout: 30000 })
    await expect(page.locator('body')).toBeVisible()
  })
})
