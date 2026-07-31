import { supabase } from '../config/supabase';
import { Workday, WorkdayItem, WorkdayItemStatus } from '../types/models';

const WORKDAY_SELECT = `
  *,
  user:user_id(id, name, email, role, department, photo),
  items:workday_items(
    *,
    project:project_id(id, name, status, progress),
    task:task_id(id, title, status, priority, assigned_to)
  )
`;

export const workdayRepository = {
  async findForUserAndDate(userId: string, workDate: string) {
    const { data, error } = await supabase
      .from('workdays')
      .select(WORKDAY_SELECT)
      .eq('user_id', userId)
      .eq('work_date', workDate)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async findLatestBeforeDate(userId: string, workDate: string) {
    const { data, error } = await supabase
      .from('workdays')
      .select(WORKDAY_SELECT)
      .eq('user_id', userId)
      .lt('work_date', workDate)
      .order('work_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async findById(id: string) {
    const { data, error } = await supabase.from('workdays').select(WORKDAY_SELECT).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async findItemById(id: string) {
    const { data, error } = await supabase.from('workday_items').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as WorkdayItem | null;
  },

  async create(input: Pick<Workday, 'user_id' | 'work_date' | 'focus'> & { remarks?: string | null }) {
    const { data, error } = await supabase.from('workdays').insert(input).select('*').single();
    if (error) throw error;
    return data as Workday;
  },

  async addItems(workdayId: string, items: Array<{
    project_id: string;
    task_id?: string | null;
    title: string;
    planned_outcome: string;
    progress_note?: string | null;
  }>) {
    const { error } = await supabase.from('workday_items').insert(
      items.map((item) => ({ ...item, workday_id: workdayId }))
    );
    if (error) throw error;
  },

  async updateItem(id: string, patch: {
    status?: WorkdayItemStatus;
    progress_note?: string | null;
    blocker_reason?: string | null;
  }) {
    const { data, error } = await supabase
      .from('workday_items')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as WorkdayItem;
  },

  async finish(id: string, input: { completed_summary: string; blockers?: string; remarks?: string }) {
    const { data, error } = await supabase
      .from('workdays')
      .update({
        status: 'Completed',
        check_out_at: new Date().toISOString(),
        completed_summary: input.completed_summary,
        blockers: input.blockers || null,
        remarks: input.remarks || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as Workday;
  },

  async findTeamForDate(workDate: string) {
    const [{ data: users, error: usersError }, { data: workdays, error: workdaysError }] = await Promise.all([
      supabase
        .from('users')
        .select('id, name, email, role, department, photo, availability')
        .eq('status', 'Active')
        .is('deleted_at', null)
        .order('name'),
      supabase.from('workdays').select(WORKDAY_SELECT).eq('work_date', workDate).order('check_in_at'),
    ]);
    if (usersError) throw usersError;
    if (workdaysError) throw workdaysError;
    return { users: users || [], workdays: workdays || [] };
  },
};
