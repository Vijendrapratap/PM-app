import { supabase } from '../config/supabase';
import { Idea } from '../types/models';

const TABLE = 'ideas';
const SELECT = '*, creator:created_by(id, name, photo), department:department_id(id, name, type), converted_project:converted_project_id(id, name)';

export const ideaRepository = {
  async list(organizationId?: string): Promise<any[]> {
    let query = supabase.from(TABLE).select(SELECT).is('archived_at', null).order('created_at', { ascending: false });
    if (organizationId) query = query.eq('organization_id', organizationId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async findById(id: string): Promise<Idea | null> {
    const { data, error } = await supabase.from(TABLE).select(SELECT).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(input: Record<string, unknown>): Promise<Idea> {
    const { data, error } = await supabase.from(TABLE).insert(input).select('*').single();
    if (error) throw error;
    return data;
  },

  async update(id: string, input: Record<string, unknown>): Promise<Idea> {
    const { data, error } = await supabase.from(TABLE).update({ ...input, updated_at: new Date().toISOString() }).eq('id', id).select(SELECT).single();
    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).update({ status: 'ARCHIVED', archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
};
