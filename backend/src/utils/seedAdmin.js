// Lives at: backend/src/utils/seedAdmin.js
// Run once: node src/utils/seedAdmin.js  (from the backend/ folder)

// .env is at backend/.env — go up two levels (utils → src → backend)
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const mongoose = require('mongoose');

// config/ is at backend/config/ — go up two levels then into config/
const connectDB = require('../../config/db');

// src/models/ is a sibling of src/utils/ — go up one level then into models/
const User = require('../models/User');

const seedAdmin = async () => {
  await connectDB();

  const existingAdmin = await User.findOne({ role: 'admin' });

  if (existingAdmin) {
    console.log('✅  Admin already exists:', existingAdmin.email);
    process.exit(0);
  }

  const admin = await User.create({
    name: 'School Admin',
    email: 'admin@smartschool.com',
    password: 'Admin1234!',
    role: 'admin',
  });

  console.log('✅  Admin created successfully');
  console.log('   Email:   ', admin.email);
  console.log('   Password: Admin1234!');
  console.log('   Role:    ', admin.role);
  console.log('\n⚠️  Change this password immediately after first login!\n');

  process.exit(0);
};

seedAdmin().catch((err) => {
  console.error('❌  Seeder failed:', err.message);
  process.exit(1);
});