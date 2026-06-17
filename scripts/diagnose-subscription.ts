import 'dotenv/config';
import { connectDB } from '../src/config/db';
import { Subscription } from '../src/models/subscription.model';
import { razorpayService, getRazorpayClient } from '../src/services/razorpay.service';

(async () => {
  await connectDB();

  const subs = await Subscription.find().sort({ createdAt: -1 }).limit(5).lean();
  console.log('=== Recent DB subscriptions ===');
  for (const s of subs) {
    console.log({
      _id: s._id,
      userId: s.userId,
      status: s.status,
      paymentStatus: s.paymentStatus,
      razorpaySubscriptionId: s.razorpaySubscriptionId,
      razorpayPaymentId: s.razorpayPaymentId,
      createdAt: s.createdAt,
    });

    if (s.razorpaySubscriptionId) {
      try {
        const rz = await razorpayService.fetchSubscription(s.razorpaySubscriptionId);
        console.log('  Razorpay status:', rz);

        const invoices = await razorpayService.fetchLatestPaidPaymentForSubscription(
          s.razorpaySubscriptionId
        );
        console.log('  Invoice payment id:', invoices);

        const payments = (await getRazorpayClient().payments.all({
          subscription_id: s.razorpaySubscriptionId,
          count: 5,
        } as never)) as { items?: Array<{ id: string; status: string }> };
        console.log('  Payments:', payments.items?.map((p) => ({ id: p.id, status: p.status })));
      } catch (e) {
        console.log('  Razorpay error:', (e as Error).message);
      }
    }
  }

  process.exit(0);
})();
