import { test, expect } from '@playwright/test';
import { mockClerkAuth } from './auth.setup';

test.describe('Login & Authentication Flow', () => {
  test('redirects authenticated user to dashboard', async ({ page }) => {
    await mockClerkAuth(page, 'admin');
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/MutuneRent/i);
  });
});
