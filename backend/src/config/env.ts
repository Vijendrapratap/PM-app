import dotenv from 'dotenv';

dotenv.config();

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

// The `cors` package echoes this value back verbatim as the
// Access-Control-Allow-Origin header. Browsers compare that header
// byte-for-byte against the request's Origin header, which never has a
// trailing slash - so a stray trailing slash here (an easy copy-paste
// mistake when setting the env var on a host) silently breaks CORS for
// every real cross-origin request, even though the value "looks" correct.
const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

export const env = {
  port: Number(process.env.PORT) || 5000,
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  jwtSecret: required('JWT_SECRET'),
  frontendUrl: stripTrailingSlash(process.env.FRONTEND_URL || 'http://localhost:5173'),
  isProduction: process.env.NODE_ENV === 'production',
  // Optional: used once at boot to seed the first Super Admin account (see
  // services/bootstrapService.ts). Registration is public/self-service for
  // everyone else, so this is the only way the very first admin gets created.
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
};
