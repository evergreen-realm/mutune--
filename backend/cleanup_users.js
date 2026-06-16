const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Tenant = require('./models/Tenant');

const MONGO_URI = process.env.MONGO_URI || '***REDACTED_MONGO_URI_1***';

async function clean() {
  console.log('Connecting to database...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected!');

  // Deleting non-admin users and tenant profiles
  console.log('Cleaning up users...');
  const deletedUsers = await User.deleteMany({ role: { $nin: ['admin', 'super_admin'] } });
  console.log(`Deleted ${deletedUsers.deletedCount} non-admin users.`);

  console.log('Cleaning up tenants...');
  const deletedTenants = await Tenant.deleteMany({});
  console.log(`Deleted ${deletedTenants.deletedCount} tenants.`);

  await mongoose.disconnect();
  console.log('Disconnected!');
}

clean().catch(console.error);
