/**
 * Mock the Clerk auth layer by injecting window.Clerk into the browser page context.
 */
export async function mockClerkAuth(page, userRole = 'admin') {
  await page.addInitScript((role) => {
    window.Clerk = {
      loaded: true,
      user: {
        id: 'mock_user_123',
        fullName: 'Test Admin User',
        primaryEmailAddress: { emailAddress: 'admin@mutune.co.ke' },
        publicMetadata: { role: role }
      },
      session: {
        getToken: async () => 'MOCK_TEST_SESSION_TOKEN_12345'
      }
    };
  }, userRole);
}
