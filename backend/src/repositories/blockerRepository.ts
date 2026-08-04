import { supabase } from '../config/supabase';

const SELECT = '*, task:task_id(id, title, assigned_to, status, canonical_status), project:project_id(id, name, owner_id), reporter:reported_by(id, name), resolution_owner:resolution_owner_user_id(id, name)';

export const blockerRepository = {
  async findById(id: string) {
    const { data, error } = await supabase.from('blockers').select(SELECT).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async findOpenForTask(taskId: string) {
    const { data, error } = await supabase.from('blockers').select(SELECT).eq('task_id', taskId).in('status', ['OPEN', 'IN_PROGRESS']).maybeSingle();
    if (error) throw error;
    return data;
  },

  async findOpenReportedBy(userId: string) {
    const { data, error } = await supabase.from('blockers').select(SELECT).eq('reported_by', userId).in('status', ['OPEN', 'IN_PROGRESS']).order('created_at');
    if (error) throw error;
    return data || [];
  },

  async findOpenForProjects(projectIds: string[]) {
    if (!projectIds.length) return [];
    const { data, error } = await supabase.from('blockers').select(SELECT).in('project_id', projectIds).in('status', ['OPEN', 'IN_PROGRESS']).order('severity').order('created_at');
    if (error) throw error;
    return data || [];
  },

  async create(input: Record<string, unknown>) {
    const { data, error } = await supabase.from('blockers').insert(input).select(SELECT).single();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: Record<string, unknown>) {
    const { data, error } = await supabase.from('blockers').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select(SELECT).single();
    if (error) throw error;
    return data;
  },
};
