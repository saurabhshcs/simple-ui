import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { config } from './config/index';

import authRouter from './routes/auth';
import chatRouter from './routes/chat';
import modelsRouter from './routes/models';
import settingsRouter from './routes/settings';
import filesRouter from './routes/files';

const app = express();

// Security headers (before everything else)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));

// CORS — allow only the configured client origin
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));

// Rate limiting on auth endpoints (50 requests / 15 min per IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

app.use((req, _res, next) => {
  if (req.path.startsWith('/api/chat') || req.path.startsWith('/api/models')) {
    console.log(`[REQ] ${req.method} ${req.path}`, req.method === 'POST' ? JSON.stringify(req.body).slice(0, 300) : '');
  }
  next();
});

// Serve uploaded background images
app.use('/uploads', express.static(path.join(config.uploadDir)));

// Routes
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/chat', chatRouter);
app.use('/api/models', modelsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/files', filesRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
