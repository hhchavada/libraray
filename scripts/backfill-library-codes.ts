/**
 * One-time backfill for libraries missing BRD-XXXX codes.
 * Usage: npx ts-node scripts/backfill-library-codes.ts
 */
import { connectDB } from '../src/config/db';
import mongoose from 'mongoose';

async function main() {
  await connectDB();
  console.log('Backfill complete (also runs automatically on server start).');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
