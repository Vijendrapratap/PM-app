import { supabase } from '../config/supabase';

const SELECT_WITH_ACTOR = '*, actor:user_id(id, name, photo), project:project_id(id, name)';

export const activityLogRepository = {
  async create(input: { action: string; user_id: string; project_id?: string; details: string }): Promise<void> {
    const { error } = await supabase.from('activity_logs').insert(input);
    if (error) throw error;
  },

  async findRecent(limit = 15): Promise<any[]> {
    const { data, error } = await supabase
      .from('activity_logs')
      .select(SELECT_WITH_ACTOR)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },
};
