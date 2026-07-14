process.env.NODE_ENV = 'test';
process.env.ADMIN_HARDCODED_PASSWORD = 'MutuneAdmin2026!';
process.env.JWT_SECRET = 'test-secret-256-bit-key-for-jwt-signing-only';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';
process.env.MPESA_CONSUMER_KEY = 'test-consumer-key';
process.env.MPESA_CONSUMER_SECRET = 'test-consumer-secret';
process.env.MPESA_SHORTCODE = '174379';
process.env.MPESA_PASSKEY = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
process.env.MPESA_CALLBACK_URL = 'https://test.callback.url';
process.env.MPESA_ENV = 'sandbox';
process.env.AT_API_KEY = 'test-at-api-key';
process.env.AT_USERNAME = 'sandbox';
process.env.AT_FROM = 'MutuneRent';
process.env.CLERK_SECRET_KEY = 'sk_test_clerk_secret_for_testing_only';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.GROQ_API_KEY = 'gsk_test_api_key_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
process.env.RESEND_API_KEY = 're_test_api_key_xxxxxxxxxxxxxxxx';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({
    instance: {
      ip: '127.0.0.1',
      version: '6.0.14',
      launchTimeout: 120000 // 120 seconds timeout for slow Windows/VM startup
    }
  });
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  
  await mongoose.connect(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    retryWrites: true,
    w: 'majority'
  });
});

afterAll(async () => {
  const cron = require('node-cron');
  cron.getTasks().forEach(task => {
    task.stop();
  });
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  if (mongod) {
    await mongod.stop();
  }
});
