// server/scripts/createAdmin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

async function createAdmin() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Define User model inline
    const userSchema = new mongoose.Schema({
      name: { type: String, required: true },
      email: { type: String, required: true, unique: true, lowercase: true },
      password: { type: String, required: true },
      role: { type: String, enum: ['admin', 'manager', 'cashier', 'kitchen'], default: 'admin' },
      isActive: { type: Boolean, default: true },
      phone: String,
      avatar: String
    }, { timestamps: true });

    const User = mongoose.model('User', userSchema);

    console.log('╔═══════════════════════════════════════╗');
    console.log('║     Creating Admin User               ║');
    console.log('╚═══════════════════════════════════════╝\n');

    // Admin credentials
    const adminData = {
      name: 'Admin',
      email: 'admin123@gmail.com',
      password: 'admin@123',
      role: 'admin',
      isActive: true
    };

    // Delete existing admin if any
    await User.deleteOne({ email: adminData.email });
    console.log('🗑️  Cleared existing admin (if any)\n');

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminData.password, salt);

    // Create admin directly in collection (bypass pre-save hooks)
    await User.collection.insertOne({
      name: adminData.name,
      email: adminData.email,
      password: hashedPassword,
      role: adminData.role,
      isActive: adminData.isActive,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ Admin created successfully!\n');

    // Verify
    const savedUser = await User.findOne({ email: adminData.email });
    const testMatch = await bcrypt.compare(adminData.password, savedUser.password);
    
    console.log('🧪 Verification:');
    console.log('   Name:', savedUser.name);
    console.log('   Email:', savedUser.email);
    console.log('   Role:', savedUser.role);
    console.log('   Active:', savedUser.isActive);
    console.log('   Password hash:', savedUser.password.substring(0, 30) + '...');
    console.log('   Password test:', testMatch ? '✅ PASS' : '❌ FAIL');

    console.log('\n╔═══════════════════════════════════════╗');
    console.log('║         LOGIN CREDENTIALS             ║');
    console.log('╠═══════════════════════════════════════╣');
    console.log('║  Email:    admin123@gmail.com         ║');
    console.log('║  Password: admin@123                  ║');
    console.log('╚═══════════════════════════════════════╝\n');

    await mongoose.disconnect();
    console.log('✅ Done! You can now login.\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createAdmin();