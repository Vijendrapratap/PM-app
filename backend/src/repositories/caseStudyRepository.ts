import { supabase } from '../config/supabase';
export const caseStudyRepository = {
  async findByProject(projectId: string) { const { data, error } = await supabase.from('case_studies').select('*').eq('project_id', projectId).maybeSingle(); if (error) throw error; return data; },
  async findById(id: string) { const { data, error } = await supabase.from('case_studies').select('*').eq('id', id).maybeSingle(); if (error) throw error; return data; },
  async upsert(input: Record<string, unknown>) { const { data, error } = await supabase.from('case_studies').upsert(input, { onConflict: 'project_id' }).select('*').single(); if (error) throw error; return data; },
  async update(id: string, input: Record<string, unknown>) { const { data, error } = await supabase.from('case_studies').update({ ...input, updated_at: new Date().toISOString() }).eq('id', id).select('*').single(); if (error) throw error; return data; },
};
