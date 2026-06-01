/**
 * Seeds all 16 library subscription plans into MongoDB.
 *
 * Usage: npx ts-node scripts/seed-subscription-plans.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { ENV } from '../src/config/env';
import { subscriptionService } from '../src/services/subscription.service';

const run = async () => {
  if (!ENV.MONGO_URI) {
    console.error('MONGO_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(ENV.MONGO_URI);
  console.log('Connected to MongoDB');

  const result = await subscriptionService.seedPlans();
  console.log(`Seed complete — created: ${result.created}, updated: ${result.updated}`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
