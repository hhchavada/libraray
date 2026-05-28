/**
 * Create super admin user (run once).
 * Usage: npx ts-node scripts/create-admin.ts
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { connectDB } from '../src/config/db';
import { ENV } from '../src/config/env';
import { User } from '../src/models/user.model';
import { UserRole } from '../src/constants/enums';

const email = process.argv[2] || 'admin@library.com';
const password = process.argv[3] || 'Admin@12345';
const fullName = process.argv[4] || 'Super Admin';
const mobile = process.argv[5] || '9000000000';

const run = async () => {
  await connectDB();

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    existing.role = UserRole.SUPER_ADMIN;
    existing.isEmailVerified = true;
    existing.password = await bcrypt.hash(password, ENV.BCRYPT_SALT_ROUNDS);
    await existing.save();
    console.log(`Updated existing user to super_admin: ${email}`);
  } else {
    await User.create({
      fullName,
      email,
      mobileNumber: mobile,
      password: await bcrypt.hash(password, ENV.BCRYPT_SALT_ROUNDS),
      role: UserRole.SUPER_ADMIN,
      isEmailVerified: true,
      isActive: true,
    });
    console.log(`Super admin created: ${email}`);
  }

  console.log(`Password: ${password}`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
