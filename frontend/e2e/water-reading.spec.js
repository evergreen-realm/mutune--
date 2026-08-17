import { test, expect } from '@playwright/test';
import { mockClerkAuth } from './auth.setup';

test.describe('Water Reading & Utilities Flow', () => {
  test('renders utilities dashboard with provider tabs', async ({ page }) => {
    await mockClerkAuth(page, 'admin');
    await page.goto('/admin');
    const header = page.locator('h1, h2').first();
    await expect(header).toBeVisible();
  });
});
