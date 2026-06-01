import 'dotenv/config';
import app from './app';
import { connectDB } from './config/db';
import { ENV } from './config/env';
import { logEmailConfiguration } from './services/email.service';
import { subscriptionService } from './services/subscription.service';

const startServer = async (): Promise<void> => {
  try {
    await connectDB();

    // Upsert all 16 plans (4 categories × 4 durations) on every boot
    const result = await subscriptionService.seedPlans();
    console.log(
      `Subscription plans synced — ${result.created} new, ${result.updated} updated`
    );

    logEmailConfiguration();
    app.listen(ENV.PORT, () => {
      console.log(`Server is running on port ${ENV.PORT} in ${ENV.NODE_ENV} mode`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
