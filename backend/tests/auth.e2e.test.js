const request = require('supertest');
const app = require('../server');
const User = require('../models/User');

jest.setTimeout(30000);

let mockClerkId = 'clerk_admin_002';
let mockClerkUser = {
  id: 'clerk_admin_002',
  publicMetadata: { role: 'admin' }
};

jest.mock('@clerk/clerk-sdk-node', () => ({
  ClerkExpressRequireAuth: () => (req, res, next) => {
    req.auth = { userId: mockClerkId };
    next();
  },
  clerkClient: {
    users: {
      updateUserMetadata: jest.fn().mockImplementation((clerkId, data) => {
        if (mockClerkUser && mockClerkUser.id === clerkId) {
          mockClerkUser.publicMetadata = {
            ...mockClerkUser.publicMetadata,
            ...data.publicMetadata
          };
        }
        return Promise.resolve(mockClerkUser);
      }),
      getUser: jest.fn().mockImplementation((id) => {
        if (id === mockClerkUser.id) {
          return Promise.resolve(mockClerkUser);
        }
        return Promise.resolve({ id, publicMetadata: {} });
      })
    }
  }
}));

describe('Authentication & Gatekeeper E2E Tests', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    mockClerkId = 'clerk_admin_002';
    mockClerkUser = {
      id: 'clerk_admin_002',
      publicMetadata: { role: 'admin' }
    };
  });

  it('should create admin user and hash password', async () => {
    mockClerkId = 'clerk_new_admin';
    mockClerkUser = {
      id: 'clerk_new_admin',
      publicMetadata: { role: 'admin' }
    };

    const res = await request(app)
      .post('/api/v1/users/sync-clerk')
      .send({
        email: 'newadmin@mutune.test',
        full_name: 'New Admin',
        phone: '254700000099'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const dbUser = await User.findOne({ clerk_id: 'clerk_new_admin' });
    expect(dbUser).toBeDefined();
    expect(dbUser.role).toBe('admin');
    expect(dbUser.admin_hardcoded_hash).toBeDefined();

    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare('MutuneAdmin2026!', dbUser.admin_hardcoded_hash);
    expect(isMatch).toBe(true);
  });

  it('should verify admin password correctly', async () => {
    await request(app)
      .post('/api/v1/users/sync-clerk')
      .send({
        email: 'admin@mutune.test',
        full_name: 'Admin',
        phone: '254700000099'
      });

    const res = await request(app)
      .post('/api/v1/admin/verify-password')
      .send({ password: 'MutuneAdmin2026!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Password verified successfully');
  });

  it('should reject wrong admin password', async () => {
    await request(app)
      .post('/api/v1/users/sync-clerk')
      .send({
        email: 'admin@mutune.test',
        full_name: 'Admin',
        phone: '254700000099'
      });

    const res = await request(app)
      .post('/api/v1/admin/verify-password')
      .send({ password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should sync Clerk metadata on login', async () => {
    const user = await User.create({
      user_code: 'ADM-999',
      role: 'admin',
      full_name: 'Existing Admin',
      email: 'existingadmin@mutune.test',
      phone: '254700000099',
      clerk_id: 'clerk_admin_002',
      is_active: true
    });

    mockClerkId = 'clerk_admin_002';
    mockClerkUser = {
      id: 'clerk_admin_002',
      publicMetadata: {}
    };

    const res = await request(app)
      .post('/api/v1/users/sync-clerk')
      .send({
        email: 'existingadmin@mutune.test',
        full_name: 'Existing Admin',
        phone: '254700000099'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { clerkClient } = require('@clerk/clerk-sdk-node');
    expect(clerkClient.users.updateUserMetadata).toHaveBeenCalledWith('clerk_admin_002', {
      publicMetadata: { role: 'admin' }
    });
    expect(mockClerkUser.publicMetadata.role).toBe('admin');
  });

  it('should derive role from dbUser when Clerk metadata missing', async () => {
    const user = await User.create({
      user_code: 'ADM-999',
      role: 'admin',
      full_name: 'Existing Admin',
      email: 'existingadmin@mutune.test',
      phone: '254700000099',
      clerk_id: 'clerk_admin_002',
      is_active: true
    });

    mockClerkId = 'clerk_admin_002';
    mockClerkUser = {
      id: 'clerk_admin_002',
      publicMetadata: {}
    };

    const res = await request(app)
      .post('/api/v1/users/sync-clerk')
      .send({
        email: 'existingadmin@mutune.test',
        full_name: 'Existing Admin',
        phone: '254700000099'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('admin');
  });
});
