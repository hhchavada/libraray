import dns from 'dns';
import mongoose from 'mongoose';
import { ENV } from './env';
import { backfillMissingLibraryCodes } from '../utils/libraryCode.util';

// Some networks (mobile hotspot, corporate DNS) break Node's SRV lookup for mongodb+srv URIs.
if (ENV.MONGO_URI.startsWith('mongodb+srv://')) {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
}

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(ENV.MONGO_URI);
    console.log('MongoDB connected successfully');

    const backfilled = await backfillMissingLibraryCodes();
    if (backfilled > 0) {
      console.log(`Assigned library codes to ${backfilled} existing libraries`);
    }
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};
