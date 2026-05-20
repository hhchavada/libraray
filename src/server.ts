import 'dotenv/config';
import app from './app';
import { connectDB } from './config/db';
import { ENV } from './config/env';
import { logEmailConfiguration } from './services/email.service';

const startServer = async (): Promise<void> => {
  try {
    await connectDB();
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
