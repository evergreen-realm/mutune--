/**
 * Mock the Clerk auth layer and backend API by intercepting routes and injecting window.Clerk.
 */

export async function setupApiRoutes(page, userRole = 'admin') {
  const role = userRole === '' ? null : userRole;
  const roleName =
    role === 'landlord' ? 'Test Landlord' :
    role === 'agent' ? 'Test Agent' :
    role === 'tenant' ? 'Test Tenant' :
    role === 'caretaker' ? 'Test Caretaker' :
    role === 'accountant' ? 'Test Accountant' :
    role === 'admin' ? 'Test Admin User' :
    'New User';

  const mockUser = {
    _id: role ? 'mock_user_123' : 'mock_new_user_123',
    clerk_id: role ? 'mock_user_123' : 'mock_new_user_123',
    role: role,
    full_name: roleName,
    email: role ? `${role}@mutune.co.ke` : 'newuser@mutune.co.ke',
    phone: '254712345678',
    landlord_id: 'LL-123456',
    user_code: 'AGT-MOM-001',
    tenant_code: 'TEN-MOM-001',
    agent_approval_status: 'approved',
    landlord_approval_status: 'approved'
  };

  const mockProperty = {
    _id: 'prop_mock_1',
    property_id: 'prop_mock_1',
    name: 'Nyali Ocean Breeze',
    property_code: 'PROP-NYALI-01',
    type: 'apartment',
    location: { type: 'Point', coordinates: [39.7118, -4.0298] },
    address: { area: 'Nyali', city: 'Mombasa', street: 'Links Road' },
    vacant_units_count: 1,
    price_range_kes: { min: 35000, max: 35000 },
    units: [
      { _id: 'u_101', unit_id: 'u_101', unit_number: '1A', rent_kes: 35000, bedrooms: 2, bathrooms: 2, status: 'vacant' }
    ],
    photos: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600']
  };

  const mockTenant = {
    _id: 'ten_mock_1',
    user_id: 'mock_user_123',
    full_name: 'Grace Mwangi',
    phone: '254712345678',
    id_number: '12345678',
    email: 'grace@example.com',
    tenant_code: 'TEN-MOM-001',
    tenancy_status: 'active',
    rent_amount_kes: 35000,
    deposit_kes: 35000,
    arrears_kes: 0,
    current_property_id: mockProperty,
    current_unit_id: 'u_101',
    unit_number: '1A',
    lease_start: '2026-01-01',
    lease_end: '2026-12-31'
  };

  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();

    if (url.includes('/users/sync') || url.includes('/users/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockUser })
      });
    }

    if (url.includes('/users')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [mockUser], pagination: { total: 1 } })
      });
    }

    if (url.includes('/listings')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              ...mockProperty,
              units: [
                { _id: 'u_101', unit_number: '1A', rent_kes: 35000, bedrooms: 2, bathrooms: 2, status: 'vacant' }
              ]
            }
          ]
        })
      });
    }

    if (url.includes('/tenants/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockTenant })
      });
    }

    if (url.includes('/tenants')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [mockTenant], pagination: { total: 1 } })
      });
    }

    if (url.includes('/payments/my-payments') || url.includes('/payments')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              _id: 'pay_mock_1',
              transaction_id: 'MPESA-QWE999',
              amount_kes: 35000,
              channel: 'mpesa',
              status: 'confirmed',
              mpesa_receipt: 'QWE999123',
              created_at: new Date().toISOString()
            }
          ]
        })
      });
    }

    if (url.includes('/properties')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [mockProperty],
          pagination: { total: 1 }
        })
      });
    }

    if (url.includes('/maintenance/my-tickets') || url.includes('/maintenance')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              _id: 'maint_mock_1',
              ticket_code: 'MT-001',
              title: 'Kitchen Sink Leaking',
              category: 'plumbing',
              urgency: 'medium',
              priority: 'medium',
              status: 'pending',
              created_at: new Date().toISOString()
            }
          ]
        })
      });
    }

    if (url.includes('/notices/my-notices') || url.includes('/notices')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              _id: 'not_mock_1',
              title: 'Scheduled Water Maintenance',
              message: 'Municipal water supply service maintenance on Friday.',
              priority: 'medium',
              notice_type: 'general',
              created_at: new Date().toISOString()
            }
          ]
        })
      });
    }

    if (url.includes('/notifications')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] })
      });
    }

    if (url.includes('/customer-care')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, number: '254700000000' })
      });
    }

    if (url.includes('/tasks')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              _id: 'tsk_mock_1',
              title: 'Move-out inspection for Unit 1A',
              status: 'pending',
              priority: 'high'
            }
          ]
        })
      });
    }

    if (url.includes('/late-fee-rules')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              _id: 'rule_1',
              name: 'Standard Commercial Late Fee',
              grace_days: 5,
              penalty_type: 'fixed',
              penalty_value: 500
            }
          ]
        })
      });
    }

    if (url.includes('/financials')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            confirmedRevenue: 450000,
            totalArrears: 25000,
            mriTaxKes: 33750,
            activeTenants: 12,
            occupancyRate: 92,
            monthlyTrend: [{ month: 'Oct', confirmedRevenue: 450000 }]
          }
        })
      });
    }

    if (url.includes('/agents')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            activeInquiries: 3,
            assignedPropertiesCount: 2,
            commissionKes: 36000
          }
        })
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} })
    });
  });
}

export async function mockClerkAuth(page, userRole = 'admin') {
  await setupApiRoutes(page, userRole);

  await page.addInitScript((role) => {
    try {
      window.sessionStorage.setItem('mutunet_admin_verified', 'true');
      window.sessionStorage.setItem('mutune_admin_unlocked', 'true');
      window.sessionStorage.setItem('admin_verified', 'true');
      window.sessionStorage.setItem('role_verified_mock_user_123', 'true');
      window.localStorage.setItem('mutunerent_verified_id_mock_user_123', 'true');
    } catch (e) {}

    window.__E2E_AUTH__ = true;

    if (!role) {
      window.Clerk = {
        loaded: true,
        user: null,
        session: null
      };
      return;
    }

    const roleName =
      role === 'landlord' ? 'Test Landlord' :
      role === 'agent' ? 'Test Agent' :
      role === 'tenant' ? 'Test Tenant' :
      role === 'caretaker' ? 'Test Caretaker' :
      role === 'accountant' ? 'Test Accountant' :
      'Test Admin User';

    window.Clerk = {
      loaded: true,
      user: {
        id: 'mock_user_123',
        fullName: roleName,
        primaryEmailAddress: { emailAddress: `${role}@mutune.co.ke` },
        publicMetadata: { role: role }
      },
      session: {
        getToken: async () => 'MOCK_TEST_SESSION_TOKEN_12345'
      }
    };
  }, userRole);
}

export async function mockNewUserAuth(page) {
  await setupApiRoutes(page, '');

  await page.addInitScript(() => {
    try {
      window.sessionStorage.clear();
      window.localStorage.clear();
    } catch (e) {}

    window.__E2E_AUTH__ = true;
    window.Clerk = {
      loaded: true,
      user: {
        id: 'mock_new_user_123',
        fullName: 'New User',
        primaryEmailAddress: { emailAddress: 'newuser@mutune.co.ke' },
        publicMetadata: {}
      },
      session: {
        getToken: async () => 'MOCK_TEST_SESSION_TOKEN_NEW'
      }
    };
  });
}
