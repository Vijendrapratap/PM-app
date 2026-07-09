import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { logger } from './config/logger';
import { apiRateLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import projectRoutes from './routes/projectRoutes';
import messageRoutes from './routes/messageRoutes';
import todoRoutes from './routes/todoRoutes';
import ideaRoutes from './routes/ideaRoutes';
import notificationRoutes from './routes/notificationRoutes';
import activityLogRoutes from './routes/activityLogRoutes';
import myTasksRoutes from './routes/myTasksRoutes';

const app = express();

// This runs on Railway, which puts its own edge proxy in front of the app -
// that proxy is a real network hop, not on loopback. Express ignores
// X-Forwarded-For by default, and express-rate-limit refuses to key off it
// until `trust proxy` is set (otherwise a client could spoof X-Forwarded-For
// to dodge rate limits). Trusting exactly 1 hop matches Railway's topology:
// requests arrive via Railway's edge and nothing else forwards them further.
// `req.ip` (and therefore every IP-keyed rate limiter) is broken - every
// visitor collapses onto one shared bucket - if this doesn't match the real
// number of proxy hops. Must be set before any middleware reads req.ip.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: env.frontendUrl }));
app.use(express.json());
app.use(apiRateLimiter);

app.get('/', (_req, res) => res.json({ status: 'ok', message: 'API is running' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/ideas', ideaRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/my-assigned-tasks', myTasksRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

logger.info('Express app initialized');

export default app;
