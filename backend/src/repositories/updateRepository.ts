import { supabase } from '../config/supabase';
import { Update } from '../types/models';

const UPDATE_SELECT = `
  *,
  created_by:created_by(id, name, photo),
  update_documents(id, name, storage_path),
  update_links(id, url, label)
`;

export const updateRepository = {
  async create(input: {
    project_id: string;
    title: string;
    description: string;
    progress: number;
    status: string;
    comments?: string;
    created_by: string;
  }): Promise<Update> {
    const { data, error } = await supabase.from('updates').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },

  async addDocuments(updateId: string, documents: { name: string; storage_path: string }[]): Promise<void> {
    if (documents.length === 0) return;
    const { error } = await supabase
      .from('update_documents')
      .insert(documents.map((doc) => ({ update_id: updateId, ...doc })));
    if (error) throw error;
  },

  async addLinks(updateId: string, links: { url: string; label?: string }[]): Promise<void> {
    if (links.length === 0) return;
    const { error } = await supabase
      .from('update_links')
      .insert(links.map((link) => ({ update_id: updateId, ...link })));
    if (error) throw error;
  },

  async findByProject(projectId: string) {
    const { data, error } = await supabase
      .from('updates')
      .select(UPDATE_SELECT)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
};
