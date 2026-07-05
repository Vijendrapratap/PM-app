import { supabase } from '../config/supabase';

export const activityLogRepository = {
  async create(input: { action: string; user_id: string; project_id?: string; details: string }): Promise<void> {
    const { error } = await supabase.from('activity_logs').insert(input);
    if (error) throw error;
  },
};
