import { supabase } from '../config/supabase';
import { ProjectTask, ProjectTaskSubtask } from '../types/models';

const TASKS_TABLE = 'project_tasks';
const SUBTASKS_TABLE = 'project_task_subtasks';

const TASK_SELECT = `
  *,
  assignee:assigned_to(id, name, email, photo),
  creator:created_by(id, name),
  documents:project_task_documents(id, name, storage_path, uploaded_at),
  comments:project_task_comments(id, body, created_at, author:author_id(id, name, photo)),
  subtasks:project_task_subtasks(*, assignee:assigned_to(id, name, email, photo), documents:project_task_subtask_documents(id, name, storage_path, uploaded_at))
`;

export const projectTaskRepository = {
  async findById(id: string) {
    const { data, error } = await supabase.from(TASKS_TABLE).select(TASK_SELECT).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async findForProject(projectId: string) {
    const { data, error } = await supabase
      .from(TASKS_TABLE)
      .select(TASK_SELECT)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async findAssignedToUser(userId: string) {
    const { data, error } = await supabase
      .from(TASKS_TABLE)
      .select('*, project:project_id(id, name)')
      .eq('assigned_to', userId)
      .order('due_date', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data;
  },

  async create(input: Partial<ProjectTask>): Promise<ProjectTask> {
    const { data, error } = await supabase.from(TASKS_TABLE).insert(input).select('*').single();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: Partial<ProjectTask>): Promise<ProjectTask | null> {
    const { data, error } = await supabase
      .from(TASKS_TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TASKS_TABLE).delete().eq('id', id);
    if (error) throw error;
  },

  async addDocuments(taskId: string, documents: { name: string; storage_path: string }[]): Promise<void> {
    if (documents.length === 0) return;
    const { error } = await supabase
      .from('project_task_documents')
      .insert(documents.map((doc) => ({ task_id: taskId, ...doc })));
    if (error) throw error;
  },

  async addComment(taskId: string, authorId: string, body: string) {
    const { error } = await supabase.from('project_task_comments').insert({ task_id: taskId, author_id: authorId, body });
    if (error) throw error;
  },

  async findSubtaskById(id: string): Promise<ProjectTaskSubtask | null> {
    const { data, error } = await supabase.from(SUBTASKS_TABLE).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async createSubtask(input: Partial<ProjectTaskSubtask>): Promise<ProjectTaskSubtask> {
    const { data, error } = await supabase.from(SUBTASKS_TABLE).insert(input).select('*').single();
    if (error) throw error;
    return data;
  },

  async updateSubtask(id: string, patch: Partial<ProjectTaskSubtask>): Promise<ProjectTaskSubtask | null> {
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
      .from('project_task_subtask_documents')
      .insert(documents.map((doc) => ({ subtask_id: subtaskId, ...doc })));
    if (error) throw error;
  },
};
