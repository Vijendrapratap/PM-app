import { supabase } from '../config/supabase';
import { DailyTodo, DailyTodoSubtask } from '../types/models';

const TODOS_TABLE = 'daily_todos';
const SUBTASKS_TABLE = 'daily_todo_subtasks';

const TODO_SELECT = `
  *,
  assignee:assigned_to(id, name, email, photo),
  creator:created_by(id, name),
  documents:daily_todo_documents(id, name, storage_path, uploaded_at),
  subtasks:daily_todo_subtasks(*, assignee:assigned_to(id, name, email, photo), documents:daily_todo_subtask_documents(id, name, storage_path, uploaded_at))
`;

export const todoRepository = {
  async findById(id: string) {
    const { data, error } = await supabase.from(TODOS_TABLE).select(TODO_SELECT).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  // "Mine" = todos assigned to the user OR created by them, so a Super Admin
  // (or anyone) can still see/manage a task they created for someone else.
  async findForUser(userId: string) {
    const { data, error } = await supabase
      .from(TODOS_TABLE)
      .select(TODO_SELECT)
      .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async create(input: Partial<DailyTodo>): Promise<DailyTodo> {
    const { data, error } = await supabase.from(TODOS_TABLE).insert(input).select('*').single();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: Partial<DailyTodo>): Promise<DailyTodo | null> {
    const { data, error } = await supabase
      .from(TODOS_TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TODOS_TABLE).delete().eq('id', id);
    if (error) throw error;
  },

  async addDocuments(todoId: string, documents: { name: string; storage_path: string }[]): Promise<void> {
    if (documents.length === 0) return;
    const { error } = await supabase
      .from('daily_todo_documents')
      .insert(documents.map((doc) => ({ todo_id: todoId, ...doc })));
    if (error) throw error;
  },

  async findSubtaskById(id: string): Promise<DailyTodoSubtask | null> {
    const { data, error } = await supabase.from(SUBTASKS_TABLE).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async createSubtask(input: Partial<DailyTodoSubtask>): Promise<DailyTodoSubtask> {
    const { data, error } = await supabase.from(SUBTASKS_TABLE).insert(input).select('*').single();
    if (error) throw error;
    return data;
  },

  async updateSubtask(id: string, patch: Partial<DailyTodoSubtask>): Promise<DailyTodoSubtask | null> {
    const { data, error } = await supabase
      .from(SUBTASKS_TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async removeSubtask(id: string): Promise<void> {
    const { error } = await supabase.from(SUBTASKS_TABLE).delete().eq('id', id);
    if (error) throw error;
  },

  async addSubtaskDocuments(subtaskId: string, documents: { name: string; storage_path: string }[]): Promise<void> {
    if (documents.length === 0) return;
    const { error } = await supabase
      .from('daily_todo_subtask_documents')
      .insert(documents.map((doc) => ({ subtask_id: subtaskId, ...doc })));
    if (error) throw error;
  },

  // Today's To-Do widget: subtasks explicitly flagged for the assignee's daily
  // planner. Same rows the parent-task view renders - no duplication.
  async findTodaySubtasksForUser(userId: string) {
    const { data, error } = await supabase
      .from(SUBTASKS_TABLE)
      .select('*, todo:todo_id(id, title)')
      .eq('assigned_to', userId)
      .eq('add_to_today', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async findSubtasksAssignedToUser(userId: string) {
    const { data, error } = await supabase
      .from(SUBTASKS_TABLE)
      .select('*, todo:todo_id(id, title)')
      .eq('assigned_to', userId)
      .order('due_date', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data;
  },
};
