import { supabase } from '../config/supabase';

export const taskUpdateRepository = {
  async create(input: { task_id: string; author_user_id: string; update_text: string; progress_percent?: number | null; remaining_estimate_minutes?: number | null; attachment_json?: unknown[] }) {
    const { data, error } = await supabase.from('task_updates').insert(input).select('*, author:author_user_id(id, name, photo)').single();
    if (error) throw error;
    return data;
  },
  async list(taskId: string) {
    const { data, error } = await supabase.from('task_updates').select('*, author:author_user_id(id, name, photo)').eq('task_id', taskId).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
};
