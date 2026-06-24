import 'dotenv/config';
import { connectDB } from '../src/config/db';
import { User } from '../src/models/user.model';
import { Subscription } from '../src/models/subscription.model';

async function main() {
  await connectDB();
  const user = await User.findOne({ email: 'admin@library.com' });
  if (!user) {
    console.log('User not found');
    process.exit(1);
  }
  const subs = await Subscription.find({ userId: user._id }).sort({ createdAt: -1 }).limit(10).lean();
  console.log('Recent subscriptions for admin@library.com:');
  for (const s of subs) {
    console.log({
      id: s._id,
      status: s.status,
      paymentStatus: s.paymentStatus,
      razorpaySubscriptionId: s.razorpaySubscriptionId,
      planId: s.planId,
      createdAt: s.createdAt,
    });
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
