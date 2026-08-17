import { test, expect } from '@playwright/test';
import { mockClerkAuth } from './auth.setup';

test.describe('Login & Authentication Flow', () => {
  test('redirects authenticated user to dashboard', async ({ page }) => {
    await mockClerkAuth(page, 'admin');
    await page.goto('/');
    await expect(page).toHaveTitle(/MutuneRent/i);
  });
});
