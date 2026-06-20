const request = require('supertest');
const app = require('../server');

describe('CORS E2E Tests', () => {
  it('should allow requests from local origins', async () => {
    const res = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('should allow requests from Vercel preview/deployment subdomains', async () => {
    const res = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://mutunerent-f79tyroi7-mishael-s-alpha.vercel.app');
    expect(res.headers['access-control-allow-origin']).toBe('https://mutunerent-f79tyroi7-mishael-s-alpha.vercel.app');
  });

  it('should allow requests from mutune subdomain', async () => {
    const res = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://mutune-alpha.vercel.app');
    expect(res.headers['access-control-allow-origin']).toBe('https://mutune-alpha.vercel.app');
  });

  it('should allow requests from mutune preview subdomains', async () => {
    const res = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://mutune-abc-xyz.vercel.app');
    expect(res.headers['access-control-allow-origin']).toBe('https://mutune-abc-xyz.vercel.app');
  });

  it('should deny requests from unauthorized domains', async () => {
    const res = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://unauthorized-domain.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
