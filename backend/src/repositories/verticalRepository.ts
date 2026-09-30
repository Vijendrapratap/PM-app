import { supabase } from '../config/supabase';

const SELECT = '*, head:owner_user_id(id, name, email, status)';

export const verticalRepository = {
  async list(organizationId: string) {
    const { data, error } = await supabase.from('verticals').select(SELECT).eq('organization_id', organizationId).order('name');
    if (error) throw error;
    return data || [];
  },
  async findById(id: string) {
    const { data, error } = await supabase.from('verticals').select(SELECT).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: { name?: string; owner_user_id?: string | null; active?: boolean }) {
    const { data, error } = await supabase.from('verticals').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select(SELECT).maybeSingle();
    if (error) throw error;
    return data;
  },
};
