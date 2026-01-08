import { test, expect } from '@playwright/test'

test('home page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Talk-To-My-Lawyer').first()).toBeVisible()
  await expect(page).toHaveTitle(/Talk-To-My-Lawyer/)
})
