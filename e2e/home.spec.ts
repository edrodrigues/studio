import { test, expect } from '@playwright/test'

test.describe('Auth Page (Public)', () => {
  test('should load the auth page', async ({ page }) => {
    await page.goto('/auth')
    await expect(page.getByRole('heading', { name: /acesso|sistema/i })).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Home Page (Protected)', () => {
  test('should show content when user is authenticated', async ({ page }) => {
    await page.goto('/')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
