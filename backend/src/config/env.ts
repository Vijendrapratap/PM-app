import dotenv from 'dotenv';
import { normalizeOpenRouterModelId } from '../utils/openRouterModel';

dotenv.config({ path: ['.env.local', '.env'] });

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
  // Optional. Without a key the agent workflow remains fully functional via
  // the deterministic local provider, which is useful for development and
  // guarantees that project creation never depends on an external model.
  openAIApiKey: process.env.OPENAI_API_KEY,
  openAIAgentModel: process.env.OPENAI_AGENT_MODEL || 'gpt-5.5',
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  openRouterAgentModel: normalizeOpenRouterModelId(process.env.OPENROUTER_AGENT_MODEL || 'deepseek/deepseek-v4-flash'),
};
