import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { subscriptionController } from './controllers/subscription.controller';
import { scanController } from './controllers/scan.controller';
import { adminController } from './controllers/admin.controller';
import routes from './routes';
import { notFound } from './middlewares/notFound';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

// Razorpay webhook must be registered BEFORE express.json() so the raw body
// is available for HMAC signature verification (express.json() consumes/parses the body).
app.post(
  '/api/v1/subscriptions/webhook',
  express.raw({ type: 'application/json' }),
  subscriptionController.webhook
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/scan', scanController.renderScanPage);
app.get('/admin', adminController.renderAdminPage);
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/v1', routes);

app.use(notFound);

app.use(errorHandler);

export default app;
