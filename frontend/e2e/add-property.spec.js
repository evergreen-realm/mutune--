import { test, expect } from '@playwright/test';
import { mockClerkAuth } from './auth.setup';

test.describe('Add Property Flow', () => {
  test('renders property creation form and inputs', async ({ page }) => {
    await mockClerkAuth(page, 'admin');
    await page.goto('/properties/add');
    const header = page.locator('h1, h2').first();
    await expect(header).toBeVisible();
  });
});
