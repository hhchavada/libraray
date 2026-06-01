import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { scanController } from './controllers/scan.controller';
import { adminController } from './controllers/admin.controller';
import routes from './routes';
import { notFound } from './middlewares/notFound';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

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
