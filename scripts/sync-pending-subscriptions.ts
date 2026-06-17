/**
 * Activates all pending subscriptions that are already paid on Razorpay.
 * Usage: npx ts-node scripts/sync-pending-subscriptions.ts
 */
import 'dotenv/config';
import { connectDB } from '../src/config/db';
import { Subscription } from '../src/models/subscription.model';
import { subscriptionService } from '../src/services/subscription.service';
import { SubscriptionPaymentStatus } from '../src/constants/enums';

(async () => {
  await connectDB();

  const pending = await Subscription.find({
    paymentStatus: SubscriptionPaymentStatus.PENDING,
    razorpaySubscriptionId: { $exists: true, $ne: '' },
  }).sort({ createdAt: -1 });

  console.log(`Found ${pending.length} pending subscription(s)\n`);

  for (const sub of pending) {
    const userId = String(sub.userId);
    console.log('Syncing', {
      mongoId: sub._id,
      userId,
      razorpaySubscriptionId: sub.razorpaySubscriptionId,
    });

    await subscriptionService.syncPendingSubscriptionFromRazorpay(userId);

    const updated = await Subscription.findById(sub._id);
    console.log('  ->', updated?.paymentStatus, updated?.status, '\n');
  }

  process.exit(0);
})();
