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
import workdayRoutes from './routes/workdayRoutes';
import agentWorkflowRoutes from './routes/agentWorkflowRoutes';
import departmentRoutes from './routes/departmentRoutes';
import workSessionRoutes from './routes/workSessionRoutes';
import todayRoutes from './routes/todayRoutes';
import taskActionRoutes from './routes/taskActionRoutes';
import dailyPlanRoutes from './routes/dailyPlanRoutes';
import { deliverableRouter, milestoneRouter } from './routes/hierarchyRoutes';
import teamRoutes from './routes/teamRoutes';
import { agentProposalsRouter, agentRunsRouter, agentsRouter } from './routes/agentProposalRoutes';
import documentRoutes from './routes/documentRoutes';
import caseStudyRoutes from './routes/caseStudyRoutes';
import reportRoutes from './routes/reportRoutes';
import { getAgentDraftProviderStatus } from './services/openAIAgentDraftProvider';

const app = express();

const configuredFrontendOrigins = env.frontendUrl
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const isAllowedFrontendOrigin = (origin: string): boolean => {
  const normalizedOrigin = origin.replace(/\/+$/, '');

  if (configuredFrontendOrigins.includes(normalizedOrigin)) return true;

  // Vite can move to the next available port during local development, and
  // localhost and 127.0.0.1 are the same machine but different browser
  // origins. Accept either loopback form locally so an innocent URL/port
  // change does not make every API call look like a server failure.
  return !env.isProduction && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin);
};

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
app.use(cors({
  origin(origin, callback) {
    // Requests without an Origin header are server-to-server, CLI, health
    // checks, or same-origin traffic and are safe to pass through here.
    if (!origin || isAllowedFrontendOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
}));
app.use(express.json());
app.use(apiRateLimiter);

app.get('/', (_req, res) => res.json({ status: 'ok', message: 'API is running' }));
app.get('/api/health', (_req, res) => res.json({
  status: 'ok',
  agents: getAgentDraftProviderStatus(),
}));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/ideas', ideaRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/my-assigned-tasks', myTasksRoutes);
app.use('/api/workdays', workdayRoutes);
app.use('/api/agent-workflow', agentWorkflowRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/work-sessions', workSessionRoutes);
app.use('/api/today', todayRoutes);
app.use('/api/tasks', taskActionRoutes);
app.use('/api/daily-plans', dailyPlanRoutes);
app.use('/api/milestones', milestoneRouter);
app.use('/api/deliverables', deliverableRouter);
app.use('/api/team', teamRoutes);
app.use('/api/agents', agentsRouter);
app.use('/api/agent-runs', agentRunsRouter);
app.use('/api/agent-proposals', agentProposalsRouter);
app.use('/api/documents', documentRoutes);
app.use('/api/case-studies', caseStudyRoutes);
app.use('/api/reports', reportRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

logger.info('Express app initialized');

export default app;
