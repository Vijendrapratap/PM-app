import { supabase } from '../config/supabase';
import { Project } from '../types/models';

const PROJECT_SELECT = `
  *,
  owner:owner_id(id, name),
  project_members(project_role, permissions_json, joined_at, user:user_id(id, name, email, role, platform_role, designation, phone, department, department_id, status, photo)),
  project_initial_documents(id, name, storage_path, uploaded_at)
`;

export const projectRepository = {
  async findByName(name: string): Promise<Project | null> {
    const { data, error } = await supabase.from('projects').select('*').eq('name', name).maybeSingle();
    if (error) throw error;
    return data;
  },

  async findById(id: string) {
    const { data, error } = await supabase.from('projects').select(PROJECT_SELECT).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async findAll(includeArchived = false) {
    let query = supabase.from('projects').select(PROJECT_SELECT).order('created_at', { ascending: false });
    if (!includeArchived) query = query.eq('archived', false);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async findForUser(userId: string, includeArchived = false) {
    let memberQuery = supabase
      .from('projects')
      .select(`${PROJECT_SELECT}, project_access:project_members!inner(user_id)`)
      .eq('project_access.user_id', userId)
      .order('created_at', { ascending: false });
    let ownerQuery = supabase
      .from('projects')
      .select(PROJECT_SELECT)
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });
    if (!includeArchived) {
      memberQuery = memberQuery.eq('archived', false);
      ownerQuery = ownerQuery.eq('archived', false);
    }
    const [memberResult, ownerResult] = await Promise.all([memberQuery, ownerQuery]);
    if (memberResult.error) throw memberResult.error;
    if (ownerResult.error) throw ownerResult.error;
    const merged = new Map<string, any>();
    [...(memberResult.data || []), ...(ownerResult.data || [])].forEach((project) => merged.set(project.id, project));
    return [...merged.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async create(input: Partial<Project>): Promise<Project> {
    const { data, error } = await supabase.from('projects').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },

  async addMembers(projectId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    const { error } = await supabase
      .from('project_members')
      .insert(userIds.map((userId) => ({ project_id: projectId, user_id: userId })));
    if (error) throw error;
  },

  async isMemberAssigned(projectId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  },

  async removeMember(projectId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);
    if (error) throw error;
  },

  async update(id: string, patch: Partial<Project>): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('projects').update({
      archived: true,
      archived_at: new Date().toISOString(),
      status: 'Cancelled',
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) throw error;
  },

  async addInitialDocuments(
    projectId: string,
    documents: { name: string; storage_path: string }[]
  ): Promise<void> {
    if (documents.length === 0) return;
    const { error } = await supabase
      .from('project_initial_documents')
      .insert(documents.map((doc) => ({ project_id: projectId, ...doc })));
    if (error) throw error;
  },

  async updateProgressAndStatus(id: string, progress: number, status: string): Promise<void> {
    const { error } = await supabase.from('projects').update({ progress, status }).eq('id', id);
    if (error) throw error;
  },

  async finish(
    id: string,
    input: {
      final_github?: string;
      final_google_drive?: string;
      final_live_website?: string;
      final_demo_video?: string;
      final_notes?: string;
    }
  ): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .update({
        status: 'Completed',
        is_locked: true,
        completion_date: new Date().toISOString(),
        progress: 100,
        ...input,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },
};
