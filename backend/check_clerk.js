const { clerkClient } = require('@clerk/clerk-sdk-node');
require('dotenv').config();

async function check() {
  console.log('Fetching users from Clerk...');
  const users = await clerkClient.users.getUserList();
  users.data.forEach(u => {
    console.log(`Name: ${u.firstName} ${u.lastName}, Email: ${u.emailAddresses[0]?.emailAddress}, ID: ${u.id}`);
    console.log(`Public Metadata:`, u.publicMetadata);
  });
}

check().catch(console.error);
