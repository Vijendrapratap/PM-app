import { supabase } from '../config/supabase';
import type { WorkSession } from '../types/models';

export const workSessionRepository = {
  async findById(id: string): Promise<WorkSession | null> {
    const { data, error } = await supabase.from('work_sessions').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async findActiveForUser(userId: string): Promise<WorkSession | null> {
    const { data, error } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async findForPlan(dailyPlanId: string): Promise<WorkSession[]> {
    const { data, error } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('daily_plan_id', dailyPlanId)
      .order('started_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async create(input: { organization_id: string; user_id: string; daily_plan_id: string; task_id?: string | null; note?: string | null }): Promise<WorkSession> {
    const { data, error } = await supabase.from('work_sessions').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: Partial<Pick<WorkSession, 'status' | 'task_id' | 'ended_at' | 'duration_minutes' | 'note'>>) {
    const { data, error } = await supabase
      .from('work_sessions')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as WorkSession;
  },
};
