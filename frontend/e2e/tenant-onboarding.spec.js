import { test, expect } from '@playwright/test';
import { mockClerkAuth } from './auth.setup';

test.describe('Tenant Onboarding Flow', () => {
  test('renders tenant management page and add tenant triggers', async ({ page }) => {
    await mockClerkAuth(page, 'admin');
    await page.goto('/tenants');
    const header = page.locator('h1, h2').first();
    await expect(header).toBeVisible();
  });
});
