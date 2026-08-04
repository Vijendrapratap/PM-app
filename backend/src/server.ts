import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { ensureSuperAdminSeeded } from './services/bootstrapService';

// Keep a module-level reference to the listener. Some development runtimes
// aggressively collect an otherwise unreferenced server returned from a
// promise callback, which makes the process report a clean exit immediately
// after logging that it started.
export let httpServer: ReturnType<typeof app.listen> | null = null;

ensureSuperAdminSeeded()
  .catch((error) => logger.error('Failed to seed Super Admin account', { error }))
  .finally(() => {
    httpServer = app.listen(env.port, () => logger.info(`Server started on port ${env.port}`));
  });
