import { test, expect } from '@playwright/test';
import { mockClerkAuth } from './auth.setup';

test.describe('Payment Collection Flow', () => {
  test('renders payments journal and STK push button', async ({ page }) => {
    await mockClerkAuth(page, 'admin');
    await page.goto('/payments');
    const stkButton = page.getByRole('button', { name: /Trigger STK Push/i });
    await expect(stkButton).toBeVisible();
  });
});
