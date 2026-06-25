/**
 * Seeds 40% / 50% / 60% promo codes (backend-managed, no Razorpay offers).
 * Usage: npx ts-node scripts/seed-promo-codes.ts
 */
import 'dotenv/config';
import { connectDB } from '../src/config/db';
import { PromoCode } from '../src/models/promoCode.model';
import { PromoDiscountType } from '../src/constants/enums';

const PROMOS = [
  {
    code: 'PROMO40',
    discountType: PromoDiscountType.PERCENTAGE,
    discountValue: 40,
    discountLabel: '40% off first month',
    billingCycles: 1,
  },
  {
    code: 'PROMO50',
    discountType: PromoDiscountType.PERCENTAGE,
    discountValue: 50,
    discountLabel: '50% off first month',
    billingCycles: 1,
  },
  {
    code: 'PROMO60',
    discountType: PromoDiscountType.PERCENTAGE,
    discountValue: 60,
    discountLabel: '60% off first month',
    billingCycles: 1,
  },
] as const;

const run = async () => {
  await connectDB();

  const validUntil = new Date('2026-12-31T23:59:59.000Z');

  for (const promo of PROMOS) {
    const doc = await PromoCode.findOneAndUpdate(
      { code: promo.code },
      {
        $set: {
          ...promo,
          applicablePlanIds: [],
          maxUses: 10000,
          usedCount: 0,
          validFrom: new Date(),
          validUntil,
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );

    console.log(`✅ ${doc.code} — ${doc.discountValue}% (billingCycles: ${doc.billingCycles})`);
  }

  console.log('\nPromo codes ready. Users can enter: PROMO40, PROMO50, PROMO60\n');
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
