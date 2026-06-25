import 'dotenv/config';
import { razorpayService, formatRazorpayContact } from '../src/services/razorpay.service';

async function main() {
  try {
    const customer = await razorpayService.findOrCreateCustomer({
      name: 'Super Admin',
      email: 'admin@library.com',
      contact: formatRazorpayContact('9000000000'),
    });
    console.log('Customer OK:', customer);

    const sub = await razorpayService.createSubscription({
      planId: 'plan_T2i2oeESMcGAN5',
      intervalMonths: 1,
      customerId: (customer as { id: string }).id,
      notifyEmail: 'admin@library.com',
      notifyPhone: formatRazorpayContact('9000000000'),
      notes: { test: '1' },
    });
    console.log('Subscription OK:', sub);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: unknown; message?: string };
    console.error('Razorpay error:', JSON.stringify(e, null, 2));
    console.error('message:', e.message);
    console.error('error field:', e.error);
  }
}

main();
