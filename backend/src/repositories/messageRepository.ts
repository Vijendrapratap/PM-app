import { supabase } from '../config/supabase';
import { ImportantMessage } from '../types/models';

const TABLE = 'important_messages';

export const messageRepository = {
  async list(): Promise<ImportantMessage[]> {
    const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async findActive(today: string): Promise<ImportantMessage[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('active', true)
      .lte('start_date', today)
      .gte('expiry_date', today)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async findById(id: string): Promise<ImportantMessage | null> {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(input: Partial<ImportantMessage>): Promise<ImportantMessage> {
    const { data, error } = await supabase.from(TABLE).insert(input).select('*').single();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: Partial<ImportantMessage>): Promise<ImportantMessage | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },
};
