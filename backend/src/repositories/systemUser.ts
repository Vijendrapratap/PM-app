import { supabase } from '../config/supabase';

const SYSTEM_USER_EMAIL = 'system@internal.local';

let cachedId: string | null = null;

// Postgres enforces the owner/created_by foreign keys that Mongo never did. The
// original app let unauthenticated requests fall back to a made-up ObjectId
// (auth isn't wired up on any route today - see plan). This preserves that same
// "works without login" behavior by pointing the fallback at one real row instead.
export const getSystemUserId = async (): Promise<string> => {
  if (cachedId) return cachedId;

  const { data: existing, error: findError } = await supabase
    .from('users')
    .select('id')
    .eq('email', SYSTEM_USER_EMAIL)
    .maybeSingle();
  if (findError) throw findError;

  if (existing) {
    cachedId = existing.id;
    return existing.id;
  }

  const { data: created, error: createError } = await supabase
    .from('users')
    .insert({ name: 'System', email: SYSTEM_USER_EMAIL, role: 'system', status: 'Inactive' })
    .select('id')
    .single();
  if (createError) throw createError;

  cachedId = created.id;
  return created.id;
};
