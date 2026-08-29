import { supabase } from '../config/supabase';

const SELECT = '*, documents:document_link_project_documents(*)';

export const documentsLinksRepository = {
  async list(organizationId: string) {
    const { data, error } = await supabase
      .from('document_link_projects')
      .select(SELECT)
      .eq('organization_id', organizationId)
      .order('serial_number');
    if (error) throw error;
    return data || [];
  },

  async findById(id: string, organizationId: string) {
    const { data, error } = await supabase
      .from('document_link_projects')
      .select(SELECT)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(input: { organization_id: string; project_name: string; live_link: string; created_by: string }) {
    const { data, error } = await supabase
      .from('document_link_projects')
      .insert(input)
      .select(SELECT)
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, organizationId: string, input: { project_name: string; live_link: string }) {
    const { data, error } = await supabase
      .from('document_link_projects')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select(SELECT)
      .single();
    if (error) throw error;
    return data;
  },

  async addDocuments(projectId: string, documents: Array<{ file_name: string; storage_path: string; file_type: string }>) {
    if (!documents.length) return;
    const { error } = await supabase
      .from('document_link_project_documents')
      .insert(documents.map((document) => ({ project_id: projectId, ...document })));
    if (error) throw error;
  },

  async findDocument(id: string, projectId: string) {
    const { data, error } = await supabase
      .from('document_link_project_documents')
      .select('*')
      .eq('id', id)
      .eq('project_id', projectId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async deleteDocument(id: string, projectId: string) {
    const { error } = await supabase
      .from('document_link_project_documents')
      .delete()
      .eq('id', id)
      .eq('project_id', projectId);
    if (error) throw error;
  },

  async delete(id: string, organizationId: string) {
    const { error } = await supabase
      .from('document_link_projects')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);
    if (error) throw error;
  },
};
