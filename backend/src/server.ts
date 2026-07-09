import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { ensureSuperAdminSeeded } from './services/bootstrapService';

ensureSuperAdminSeeded()
  .catch((error) => logger.error('Failed to seed Super Admin account', { error }))
  .finally(() => {
    app.listen(env.port, () => logger.info(`Server started on port ${env.port}`));
  });
