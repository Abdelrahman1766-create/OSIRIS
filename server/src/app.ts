import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { adminRouter } from './admin.js';
import { aiRouter } from './ai.js';
import { authRouter } from './auth.js';
import { catalogRouter } from './catalog.js';
import { commerceRouter } from './commerce.js';
import { allowedOrigins } from './config.js';
import { customerRouter } from './customer.js';
import { errorHandler, HttpError, notFound } from './http.js';
import { supplierRouter, uploadsDir } from './supplier.js';

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    },
  },
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new HttpError(403, 'Origin not allowed', 'FORBIDDEN'));
  },
}));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d', immutable: true }));
app.use('/api/v1', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/api/v1/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }), authRouter);
app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/v1', catalogRouter);
app.use('/api/v1', commerceRouter);
app.use('/api/v1', customerRouter);
app.use('/api/v1/supplier', supplierRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/ai', aiRouter);

// Production deployments expose the built storefront and API from one origin.
// The directory resolves correctly from server/dist/app.js after compilation.
const storefrontDir = fileURLToPath(new URL('../../dist/', import.meta.url));
if (existsSync(storefrontDir)) {
  app.use(express.static(storefrontDir, { maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      next();
      return;
    }
    res.sendFile('index.html', { root: storefrontDir });
  });
}

app.use(notFound);
app.use(errorHandler);
