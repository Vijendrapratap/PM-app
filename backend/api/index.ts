import app from '../src/app';
import { ensureSuperAdminSeeded } from '../src/services/bootstrapService';
import { logger } from '../src/config/logger';

// Fire-and-forget: don't add cold-start latency to every request, but make
// sure a Super Admin gets seeded shortly after this function first spins up.
ensureSuperAdminSeeded().catch((error) => logger.error('Failed to seed Super Admin account', { error }));

// Vercel's Node runtime accepts an Express app as a request handler directly.
export default app;
