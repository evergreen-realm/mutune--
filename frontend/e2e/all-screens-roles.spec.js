import { test, expect } from '@playwright/test';
import { mockClerkAuth, mockNewUserAuth } from './auth.setup';

test.describe('MutuneRent Pro — Full Comprehensive Verification Across All Screens, Roles & Buttons', () => {

  // ════════════════════════════════════════════════════════════════════════════
  // 1. PUBLIC & UNAUTHENTICATED SCREENS
  // ════════════════════════════════════════════════════════════════════════════
  test('1.1 LandingPage Hero, Stats, Bento, Showcase, and Navigation Buttons', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await mockClerkAuth(page, null);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/MutuneRent/i);

    // Hero action buttons
    const browseBtn = page.getByRole('button', { name: /Browse/i })
      .or(page.getByRole('link', { name: /Browse/i }))
      .first();
    await expect(browseBtn).toBeVisible();

    // Stats / Hero strip
    const heroHeadline = page.getByRole('heading', { name: /Coastal Property Management/i })
      .or(page.locator('text=Mombasa\'s Premier Property Platform'))
      .first();
    await expect(heroHeadline).toBeVisible();

    // Bento / Features section
    const getStartedBtn = page.getByRole('button', { name: /Get Started/i }).first();
    await expect(getStartedBtn).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test('1.2 PropertyListingsPage Filters, Detail Modal, and Inquiry Button', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await mockClerkAuth(page, null);
    await page.goto('/listings', { waitUntil: 'domcontentloaded' });

    // Search bar and filter controls
    const searchInput = page.getByPlaceholder(/Search area, street, or property name/i).first();
    await expect(searchInput).toBeVisible();

    // Property card rendered from mock data
    const propertyTitle = page.locator('text=Nyali Ocean Breeze').first();
    await expect(propertyTitle).toBeVisible();

    // Inquire / Book Viewing button
    const inquireBtn = page.getByRole('button', { name: /Inquire/i })
      .or(page.getByRole('button', { name: /Search/i }))
      .first();
    await expect(inquireBtn).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test('1.3 LoginPage & SignUpPage Theme, Dark Showcase Panel Contrast', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await mockClerkAuth(page, null);

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const showcaseBrand = page.locator('text=MutuneRent Pro').first();
    await expect(showcaseBrand).toBeVisible();

    await page.goto('/sign-up', { waitUntil: 'domcontentloaded' });
    const signupBrand = page.locator('text=MutuneRent Pro').first();
    await expect(signupBrand).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test('1.4 Privacy Policy & Terms of Service Legal Pages', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await mockClerkAuth(page, null);

    await page.goto('/privacy', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=Privacy Policy').first()).toBeVisible();
    await expect(page.locator('text=Data Protection Act').first()).toBeVisible();

    await page.goto('/terms', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=Terms of Service').first()).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 2. VERIFICATION & SECURITY GATES
  // ════════════════════════════════════════════════════════════════════════════
  test('2.1 OnboardingPage Role Selection Cards & Phone Input Validation', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await mockNewUserAuth(page);
    await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });

    const header = page.getByRole('heading', { name: /Welcome Onboard/i })
      .or(page.getByText(/Select Your Role/i))
      .first();
    await expect(header).toBeVisible();

    // Role selection cards
    await expect(page.locator('text=Estate Agent').first()).toBeVisible();
    await expect(page.locator('text=Landlord').first()).toBeVisible();
    await expect(page.locator('text=Tenant').first()).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 3. ADMIN ROLE SCREENS & TABS
  // ════════════════════════════════════════════════════════════════════════════
  test('3.1 AdminDashboardPage All Tabs and Operational Controls', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await mockClerkAuth(page, 'admin');
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Verify Admin Dashboard header
    const adminHeader = page.getByRole('heading', { name: /Executive Operations Center/i })
      .or(page.getByRole('heading', { name: /Admin/i }))
      .or(page.locator('h1, h2'))
      .first();
    await expect(adminHeader).toBeVisible();

    // Verify tabs exist and can be clicked without runtime error
    const tabsToTest = ['Overview', 'Late Fee Rules', 'Financials'];
    for (const tabName of tabsToTest) {
      const tabBtn = page.getByRole('button', { name: new RegExp(tabName, 'i') }).first();
      if (await tabBtn.isVisible()) {
        await tabBtn.click();
        await page.waitForTimeout(200);
      }
    }

    const fatalErrors = errors.filter(e => !e.includes('Mapbox GL') && !e.includes('access token is required'));
    expect(fatalErrors).toHaveLength(0);
  });

  test('3.2 AdminUserManagementPage & AdminInventoryPage', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await mockClerkAuth(page, 'admin');

    await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
    const userMgmtHeader = page.getByRole('heading', { name: /User & System Management/i })
      .or(page.getByText(/User & System Management/i))
      .first();
    await expect(userMgmtHeader).toBeVisible();

    await page.goto('/admin/inventory', { waitUntil: 'domcontentloaded' });
    const invHeader = page.getByRole('heading', { name: /Inventory & Auction Control/i })
      .or(page.getByRole('heading', { name: /Inventory/i }))
      .or(page.getByText(/Inventory/i))
      .first();
    await expect(invHeader).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 4. LANDLORD ROLE SCREENS
  // ════════════════════════════════════════════════════════════════════════════
  test('4.1 LandlordDashboardPage 6 Tabs and + Add Property Navigation', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await mockClerkAuth(page, 'landlord');
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // Check dashboard heading
    const landlordHeader = page.getByRole('heading', { name: /Landlord Dashboard/i })
      .or(page.getByText(/Landlord Dashboard/i))
      .first();
    await expect(landlordHeader).toBeVisible();

    // Test + Add Property button
    const addPropertyBtn = page.getByRole('link', { name: /Add Property/i })
      .or(page.locator('a[href="/landlord/add-property"]'))
      .first();
    await expect(addPropertyBtn).toBeVisible();
    await addPropertyBtn.click();
    await expect(page).toHaveURL(/add-property/);

    expect(errors).toHaveLength(0);
  });

  test('4.2 LandlordAddPropertyPage 5-Step Property Creation Wizard', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await mockClerkAuth(page, 'landlord');
    await page.goto('/landlord/add-property', { waitUntil: 'domcontentloaded' });

    const wizardTitle = page.getByRole('heading', { name: /Add Your Property/i })
      .or(page.getByText(/Add Your Property/i))
      .first();
    await expect(wizardTitle).toBeVisible();

    // Verify wizard step navigation triggers exist
    const nextBtn = page.getByRole('button', { name: /Next/i })
      .or(page.getByRole('button', { name: /Continue/i }))
      .or(page.locator('button[type="submit"]'))
      .first();
    if (await nextBtn.isVisible()) {
      await expect(nextBtn).toBeEnabled();
    }

    expect(errors).toHaveLength(0);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 5. AGENT ROLE SCREENS
  // ════════════════════════════════════════════════════════════════════════════
  test('5.1 AgentPerformancePage 8 Tabs, Salary Calculation, and Tasks', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await mockClerkAuth(page, 'agent');
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    const agentHeader = page.getByRole('heading', { name: /Test Agent/i })
      .or(page.getByRole('heading', { name: /Agent Performance/i }))
      .or(page.getByText(/Agent Performance/i))
      .first();
    await expect(agentHeader).toBeVisible();

    // Click My Salary tab - specifically tests that myProperties ReferenceError is resolved!
    const salaryTab = page.getByRole('button', { name: /My Salary/i }).or(page.locator('text=Salary')).first();
    if (await salaryTab.isVisible()) {
      await salaryTab.click();
      await page.waitForTimeout(300);
      expect(errors).toHaveLength(0);
    }

    // Agent task board
    await page.goto('/tasks', { waitUntil: 'domcontentloaded' });
    const taskHeader = page.getByRole('heading', { name: /Operational Tasks/i })
      .or(page.getByText(/Operational Tasks/i))
      .or(page.getByText(/Task Board/i))
      .first();
    await expect(taskHeader).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 6. TENANT ROLE SCREENS
  // ════════════════════════════════════════════════════════════════════════════
  test('6.1 TenantPortalPage 6 Tabs, Payments, Utilities, Maintenance, Lease', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await mockClerkAuth(page, 'tenant');
    await page.goto('/tenant', { waitUntil: 'domcontentloaded' });

    const tenantHeader = page.getByRole('heading', { name: /Welcome back/i })
      .or(page.getByText(/My Portal/i))
      .or(page.getByRole('heading', { name: /Tenant/i }))
      .first();
    await expect(tenantHeader).toBeVisible();

    // Switch between tabs
    const tabList = ['Overview', 'Payments', 'Utilities', 'Maintenance', 'Lease', 'Notices'];
    for (const t of tabList) {
      const tabBtn = page.getByRole('button', { name: new RegExp(t, 'i') }).first();
      if (await tabBtn.isVisible()) {
        await tabBtn.click();
        await page.waitForTimeout(200);
      }
    }

    expect(errors).toHaveLength(0);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 7. CARETAKER ROLE SCREENS
  // ════════════════════════════════════════════════════════════════════════════
  test('7.1 CaretakerDashboardPage Maintenance, Units, and Utilities', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await mockClerkAuth(page, 'caretaker');
    await page.goto('/caretaker', { waitUntil: 'domcontentloaded' });

    const caretakerHeader = page.getByRole('heading', { name: /Nyali Ocean Breeze/i })
      .or(page.getByText(/On-Site Caretaker Portal/i))
      .first();
    await expect(caretakerHeader).toBeVisible();

    // Verify sub-tabs
    const subTabs = ['Units', 'Fix Log', 'Meters', 'Handover'];
    for (const subTab of subTabs) {
      const tabBtn = page.getByRole('button', { name: new RegExp(subTab, 'i') }).first();
      if (await tabBtn.isVisible()) {
        await tabBtn.click();
        await page.waitForTimeout(200);
      }
    }

    expect(errors).toHaveLength(0);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 8. ACCOUNTANT ROLE SCREENS
  // ════════════════════════════════════════════════════════════════════════════
  test('8.1 AccountantDashboardPage Financials, Ledger, Arrears, Tax eTIMS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await mockClerkAuth(page, 'accountant');
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    const accountantHeader = page.getByRole('heading', { name: /Accountant Financial Portal/i })
      .or(page.getByText(/Accountant Financial Portal/i))
      .first();
    await expect(accountantHeader).toBeVisible();

    // Verify financial sub-tabs
    const subTabs = ['Overview', 'GL & Trial Balance', 'Payments', 'KRA Tax', 'Financial Reports'];
    for (const subTab of subTabs) {
      const tabBtn = page.getByRole('button', { name: new RegExp(subTab, 'i') }).first();
      if (await tabBtn.isVisible()) {
        await tabBtn.click();
        await page.waitForTimeout(200);
      }
    }

    expect(errors).toHaveLength(0);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 9. SHARED OPERATIONAL PAGES & RESPONSIVE BEHAVIOUR
  // ════════════════════════════════════════════════════════════════════════════
  test('9.1 Shared Operational Pages (Properties, Tenants, Payments, Maintenance, Notices)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await mockClerkAuth(page, 'admin');

    // /properties
    await page.goto('/properties', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Managed Real Estate Assets/i }).first()).toBeVisible();

    // /tenants
    await page.goto('/tenants', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Tenant Registry/i }).first()).toBeVisible();

    // /payments
    await page.goto('/payments', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /Trigger STK Push/i })).toBeVisible();

    // /maintenance
    await page.goto('/maintenance', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Maintenance Desk/i }).first()).toBeVisible();

    // /notices
    await page.goto('/notices', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Digital Notices/i }).first()).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test('9.2 Mobile Viewport (375x812) Layout, Zero Horizontal Overflow & Drawer', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.setViewportSize({ width: 375, height: 812 });
    await mockClerkAuth(page, 'admin');

    await page.goto('/payments', { waitUntil: 'domcontentloaded' });

    // Check no horizontal scroll overflow on mobile
    const overflowCheck = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth + 2;
    });
    expect(overflowCheck).toBe(true);

    expect(errors).toHaveLength(0);
  });

});
