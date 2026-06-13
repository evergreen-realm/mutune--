const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  const users = await User.find({}).lean();
  console.log('Total users:', users.length);
  users.forEach(u => {
    console.log(`User: ${u.full_name}, Email: ${u.email}, Role: ${u.role}, Clerk ID: ${u.clerk_id}`);
  });
  await mongoose.disconnect();
}

check().catch(console.error);
