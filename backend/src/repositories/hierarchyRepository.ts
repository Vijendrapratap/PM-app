import { supabase } from '../config/supabase';

const MILESTONE_SELECT = '*, owner:owner_user_id(id, name), deliverables(*, owner:owner_user_id(id, name))';

export const hierarchyRepository = {
  async listMilestones(projectId: string) {
    const { data, error } = await supabase.from('milestones').select(MILESTONE_SELECT).eq('project_id', projectId).is('archived_at', null).order('sequence');
    if (error) throw error;
    return data || [];
  },
  async findMilestone(id: string) {
    const { data, error } = await supabase.from('milestones').select(MILESTONE_SELECT).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },
  async createMilestone(input: Record<string, unknown>) {
    const { data, error } = await supabase.from('milestones').insert(input).select(MILESTONE_SELECT).single();
    if (error) throw error;
    return data;
  },
  async updateMilestone(id: string, patch: Record<string, unknown>) {
    const { data, error } = await supabase.from('milestones').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select(MILESTONE_SELECT).single();
    if (error) throw error;
    return data;
  },
  async findDeliverable(id: string) {
    const { data, error } = await supabase.from('deliverables').select('*, milestone:milestone_id(project_id)').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },
  async createDeliverable(input: Record<string, unknown>) {
    const { data, error } = await supabase.from('deliverables').insert(input).select('*, owner:owner_user_id(id, name)').single();
    if (error) throw error;
    return data;
  },
  async updateDeliverable(id: string, patch: Record<string, unknown>) {
    const { data, error } = await supabase.from('deliverables').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select('*, owner:owner_user_id(id, name)').single();
    if (error) throw error;
    return data;
  },
};
