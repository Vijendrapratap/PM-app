import { supabase } from '../config/supabase';
import { Project } from '../types/models';

const PROJECT_SELECT = `
  *,
  owner:owner_id(id, name),
  project_members(user:user_id(id, name, email, role, phone, department, status, photo)),
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

  async findAll() {
    const { data, error } = await supabase
      .from('projects')
      .select(PROJECT_SELECT)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
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
