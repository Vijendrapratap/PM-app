import { supabase } from '../config/supabase';
import { DailyReport } from '../types/models';

const DAILY_REPORT_SELECT = `
  *,
  member:member_id(id, name, email, role, photo, status),
  created_by:created_by(id, name, photo),
  daily_report_documents(id, name, storage_path)
`;

export const dailyReportRepository = {
  async findByProject(projectId: string) {
    const { data, error } = await supabase
      .from('daily_reports')
      .select(DAILY_REPORT_SELECT)
      .eq('project_id', projectId)
      .order('report_date', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  async findOne(projectId: string, memberId: string, workDate: string): Promise<DailyReport | null> {
    const { data, error } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('project_id', projectId)
      .eq('member_id', memberId)
      .eq('work_date', workDate)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async upsert(input: {
    project_id: string;
    member_id: string;
    team_member_name: string;
    role: string;
    report_date: string;
    work_date: string;
    description: string;
    document_url?: string;
    created_by: string;
  }): Promise<DailyReport> {
    const { data, error } = await supabase
      .from('daily_reports')
      .upsert(input, { onConflict: 'project_id,work_date,member_id' })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async addDocuments(reportId: string, documents: { name: string; storage_path: string }[]): Promise<void> {
    if (documents.length === 0) return;
    const { error } = await supabase
      .from('daily_report_documents')
      .insert(documents.map((doc) => ({ daily_report_id: reportId, ...doc })));
    if (error) throw error;
  },

  async findById(id: string) {
    const { data, error } = await supabase
      .from('daily_reports')
      .select(DAILY_REPORT_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};
