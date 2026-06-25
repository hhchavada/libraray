import 'dotenv/config';
import { razorpayService } from '../src/services/razorpay.service';

const subId = process.argv[2] || 'sub_T5oG2tbEgSU16q';

async function main() {
  const sub = await razorpayService.fetchSubscription(subId);
  console.log(JSON.stringify(sub, null, 2));
  console.log('\n--- Summary ---');
  console.log('status:', sub.status);
  console.log('short_url:', sub.short_url);
  console.log('paid_count:', sub.paid_count);
  console.log('charge_at:', sub.charge_at ? new Date(sub.charge_at * 1000).toISOString() : null);
  const expireBy = (sub as { expire_by?: number }).expire_by;
  console.log('expire_by:', expireBy ? new Date(expireBy * 1000).toISOString() : null);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
