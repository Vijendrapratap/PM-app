import { supabase } from '../config/supabase';
import type { DailyWorkSession, WorkLog } from '../types/models';

const SESSION_SELECT = '*, user:user_id(id, name, email, role, department, photo, daily_capacity_minutes)';
const LOG_SELECT = '*, project:project_id(id, name), task:task_id(id, title)';

export const dailyWorkRepository = {
  async current(userId: string, workDate: string) {
    const { data, error } = await supabase.from('daily_work_sessions').select(SESSION_SELECT).eq('user_id', userId).eq('work_date', workDate).maybeSingle();
    if (error) throw error;
    return data;
  },
  async history(userId: string, startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('daily_work_sessions')
      .select(`${SESSION_SELECT}, logs:work_logs(${LOG_SELECT})`)
      .eq('user_id', userId)
      .gte('work_date', startDate)
      .lte('work_date', endDate)
      .order('work_date', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async create(input: Pick<DailyWorkSession, 'organization_id' | 'user_id' | 'work_date' | 'timezone'>) {
    const { data, error } = await supabase.from('daily_work_sessions').insert(input).select(SESSION_SELECT).single();
    if (error) throw error;
    return data;
  },
  async complete(id: string, status: 'COMPLETED' | 'AUTO_COMPLETED', endAt: string) {
    const { data, error } = await supabase.from('daily_work_sessions').update({ status, end_at: endAt, updated_at: endAt }).eq('id', id).eq('status', 'ACTIVE').select(SESSION_SELECT).single();
    if (error) throw error;
    return data;
  },
  async logs(sessionId: string) {
    const { data, error } = await supabase.from('work_logs').select(LOG_SELECT).eq('session_id', sessionId).order('created_at');
    if (error) throw error;
    return data || [];
  },
  async addLog(input: Omit<WorkLog, 'id' | 'created_at'>) {
    const { data, error } = await supabase.from('work_logs').insert(input).select(LOG_SELECT).single();
    if (error) throw error;
    return data;
  },
  async activeSessions() {
    const { data, error } = await supabase.from('daily_work_sessions').select(SESSION_SELECT).eq('status', 'ACTIVE');
    if (error) throw error;
    return data || [];
  },
  async adminSessions(filters: { date?: string; startDate?: string; endDate?: string; userId?: string; status?: string; projectId?: string }) {
    let query = supabase.from('daily_work_sessions').select(`${SESSION_SELECT}, logs:work_logs(${LOG_SELECT})`).order('work_date', { ascending: false }).limit(500);
    if (filters.date) query = query.eq('work_date', filters.date);
    if (filters.startDate) query = query.gte('work_date', filters.startDate);
    if (filters.endDate) query = query.lte('work_date', filters.endDate);
    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.status) query = query.eq('status', filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).filter((session: any) => !filters.projectId || (session.logs || []).some((log: any) => log.project_id === filters.projectId));
  },
  async commitments(sessionId: string) {
    const { data, error } = await supabase.from('daily_work_commitments')
      .select('*, task:task_id(id, title, project_id, status, canonical_status, carry_forward_count, project:project_id(id, name))')
      .eq('session_id', sessionId).order('position');
    if (error) throw error;
    return data || [];
  },
  async addCommitments(rows: { session_id: string; task_id: string; position: number }[]) {
    const { error } = await supabase.from('daily_work_commitments').insert(rows);
    if (error) throw error;
  },
  async setOutcome(sessionId: string, taskId: string, outcome: string, reasonCode: string | null, carryReason: string | null) {
    const { error } = await supabase.from('daily_work_commitments').update({ outcome, reason_code: reasonCode, carry_reason: carryReason }).eq('session_id', sessionId).eq('task_id', taskId);
    if (error) throw error;
  },
  async markUnresolvedCarried(sessionId: string) {
    const { data, error } = await supabase.from('daily_work_commitments').update({ outcome: 'CARRIED' }).eq('session_id', sessionId).is('outcome', null).select('task_id');
    if (error) throw error;
    return (data || []).map((row) => row.task_id as string);
  },
  // ponytail: read-then-write increments; a concurrent write can lose one count. Move to an RPC (update … set x = x + 1) if two people ever log on the same task in the same second.
  async incrementCarry(taskIds: string[]) {
    for (const id of taskIds) {
      const { data, error } = await supabase.from('project_tasks').select('carry_forward_count').eq('id', id).single();
      if (error) throw error;
      const { error: updateError } = await supabase.from('project_tasks').update({ carry_forward_count: (data.carry_forward_count || 0) + 1 }).eq('id', id);
      if (updateError) throw updateError;
    }
  },
  async addActualMinutes(taskId: string, minutes: number) {
    const { data, error } = await supabase.from('project_tasks').select('actual_minutes').eq('id', taskId).single();
    if (error) throw error;
    const { error: updateError } = await supabase.from('project_tasks').update({ actual_minutes: (data.actual_minutes || 0) + minutes }).eq('id', taskId);
    if (updateError) throw updateError;
  },
};