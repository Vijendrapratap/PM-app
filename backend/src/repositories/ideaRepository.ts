import { supabase } from '../config/supabase';
import { Idea } from '../types/models';

const TABLE = 'ideas';
const SELECT = '*, creator:created_by(id, name, photo)';

export const ideaRepository = {
  async list(): Promise<any[]> {
    const { data, error } = await supabase.from(TABLE).select(SELECT).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async findById(id: string): Promise<Idea | null> {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(input: { title: string; description: string; created_by: string; category?: string; impact?: string; effort?: string }): Promise<Idea> {
    const { data, error } = await supabase.from(TABLE).insert(input).select('*').single();
    if (error) throw error;
    return data;
  },

  async update(id: string, input: Partial<Pick<Idea, 'status' | 'category' | 'impact' | 'effort'>>): Promise<Idea> {
    const { data, error } = await supabase.from(TABLE).update(input).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },
};
