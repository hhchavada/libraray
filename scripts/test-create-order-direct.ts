import 'dotenv/config';
import { connectDB } from '../src/config/db';
import { subscriptionService } from '../src/services/subscription.service';
import { User } from '../src/models/user.model';

async function main() {
  await connectDB();
  const user = await User.findOne({ email: 'admin@library.com' });
  if (!user) throw new Error('user not found');
  try {
    const result = await subscriptionService.createOrder(
      user._id.toString(),
      '6a329c44effd09b4a72cf638',
      true
    );
    console.log('SUCCESS:', JSON.stringify(result, null, 2));
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string; code?: number; keyPattern?: unknown };
    console.error('FAILED:', e.statusCode, e.message);
    console.error('mongo:', e.code, e.keyPattern);
  }
  process.exit(0);
}

main();
