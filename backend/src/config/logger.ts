type Level = 'info' | 'warn' | 'error';

const write = (level: Level, message: string, meta?: Record<string, unknown>) => {
  const line = {
    level,
    time: new Date().toISOString(),
    message,
    ...(meta ? { meta } : {}),
  };
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  out(JSON.stringify(line));
};

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => write('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),
};
