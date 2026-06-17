/**
 * Creates / updates the ₹1 Razorpay test subscription plan.
 * Usage: npx ts-node scripts/seed-test-plan.ts
 */
import 'dotenv/config';
import { connectDB } from '../src/config/db';
import { SubscriptionPlan } from '../src/models/subscriptionPlan.model';
import { PlanCategory, PlanDurationType } from '../src/constants/enums';
import { razorpayService } from '../src/services/razorpay.service';
import { toRupeesPaise } from '../src/utils/subscription.util';

const TEST_PLAN = {
  name: 'Test Plan — ₹1 / month',
  category: PlanCategory.TEST,
  seatsMin: 1,
  seatsMax: 999999,
  durationType: PlanDurationType.MONTHLY,
  durationMonths: 1,
  baseAmount: 1,
  amount: 1,
  savingPercent: 0,
  perMonthAmount: 1,
  currency: 'INR',
  isActive: true,
};

const run = async () => {
  await connectDB();

  let plan = await SubscriptionPlan.findOneAndUpdate(
    { category: PlanCategory.TEST, durationType: PlanDurationType.MONTHLY },
    { $set: TEST_PLAN },
    { upsert: true, new: true }
  );

  const needsRazorpayPlan =
    !plan.razorpayPlanId ||
    (await razorpayService
      .fetchPlan(plan.razorpayPlanId)
      .then((p) => Number((p as { item?: { amount?: number } }).item?.amount) !== toRupeesPaise(1))
      .catch(() => true));

  if (needsRazorpayPlan) {
    const rzPlan = await razorpayService.createPlan({
      name: TEST_PLAN.name,
      amountInRupees: 1,
      currency: 'INR',
      intervalMonths: 1,
      notes: { mongoPlanId: String(plan._id), purpose: 'payment_test' },
    });
    plan.razorpayPlanId = rzPlan.id;
    await plan.save();
  }

  console.log('\n✅ Test plan ready for payment testing:\n');
  console.log({
    planId: plan._id.toString(),
    name: plan.name,
    amount: `₹${plan.amount}`,
    razorpayPlanId: plan.razorpayPlanId,
  });
  console.log('\nUse planId in POST /api/v1/subscription/create-order\n');

  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
