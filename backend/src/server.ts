import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';

app.listen(env.port, () => logger.info(`Server started on port ${env.port}`));
