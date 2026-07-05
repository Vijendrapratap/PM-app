import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { env } from './env';

// Server-side only: uses the service role key, which bypasses row-level security.
// Never import this module or expose this key in frontend code.
export const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { persistSession: false },
  // We never use Supabase Realtime, but the client still initializes a
  // RealtimeClient that requires a WebSocket implementation on Node < 22.
  realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
});
