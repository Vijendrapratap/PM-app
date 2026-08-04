import { supabase } from '../config/supabase';

export interface DepartmentInput {
  name: string;
  code: string;
  type: 'DEVELOPMENT' | 'MARKETING' | 'SALES' | 'OPERATIONS' | 'OTHER';
  lead_user_id?: string | null;
  active?: boolean;
}

const SELECT = '*, lead:lead_user_id(id, name, email, role, designation)';

export const departmentRepository = {
  async list(organizationId: string, includeInactive = false) {
    let query = supabase
      .from('departments')
      .select(SELECT)
      .eq('organization_id', organizationId)
      .order('name');
    if (!includeInactive) query = query.eq('active', true);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async findById(id: string) {
    const { data, error } = await supabase.from('departments').select(SELECT).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async findByCode(organizationId: string, code: string) {
    const { data, error } = await supabase
      .from('departments')
      .select(SELECT)
      .eq('organization_id', organizationId)
      .eq('code', code)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(organizationId: string, input: DepartmentInput) {
    const { data, error } = await supabase
      .from('departments')
      .insert({ organization_id: organizationId, ...input })
      .select(SELECT)
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: Partial<DepartmentInput>) {
    const { data, error } = await supabase
      .from('departments')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(SELECT)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};
