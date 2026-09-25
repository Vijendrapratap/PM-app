import { supabase } from '../config/supabase';
import { DEFAULT_LIMITS, type BriefFacts, type ProjectStage, type TaskStage, type WorkLimits } from '../policies/workGatePolicy';

export const LEGACY_TASK_STAGE: Record<string, TaskStage> = { Pending: 'BACKLOG', 'In Progress': 'IN_PROGRESS', 'In Review': 'IN_REVIEW', Completed: 'DONE', Blocked: 'IN_PROGRESS', Cancelled: 'CANCELLED', Deferred: 'DEFERRED' };
export const taskStage = (task: any): TaskStage => task.canonical_status || LEGACY_TASK_STAGE[task.status] || 'BACKLOG';
export const projectStage = (project: any): ProjectStage => project.canonical_status || 'DRAFT';

export const workGateRepository = {
  async limits(organizationId: string): Promise<WorkLimits> {
    const { data, error } = await supabase.from('org_settings').select('*').eq('organization_id', organizationId).maybeSingle();
    if (error) throw error;
    if (!data) return DEFAULT_LIMITS;
    return {
      maxActiveProjectsPerOwner: data.max_active_projects_per_owner, maxActiveProjectsOrg: data.max_active_projects_org,
      maxInProgressPerPerson: data.max_in_progress_per_person, maxDailyCommitments: data.max_daily_commitments,
      staleProjectDays: data.stale_project_days, staleTaskDays: data.stale_task_days,
    };
  },
  async activeProjectCounts(organizationId: string, ownerId: string, excludeProjectId: string) {
    const { data, error } = await supabase.from('projects').select('id, owner_id')
      .eq('organization_id', organizationId).eq('kind', 'DELIVERY').eq('canonical_status', 'ACTIVE').eq('archived', false).neq('id', excludeProjectId);
    if (error) throw error;
    const rows = data || [];
    return { owner: rows.filter((row) => row.owner_id === ownerId).length, org: rows.length };
  },
  async briefFacts(project: any): Promise<BriefFacts> {
    const [milestones, tasks] = await Promise.all([
      supabase.from('milestones').select('id', { count: 'exact', head: true }).eq('project_id', project.id),
      supabase.from('project_tasks').select('assigned_to, estimate_minutes, status, canonical_status').eq('project_id', project.id),
    ]);
    if (milestones.error) throw milestones.error;
    if (tasks.error) throw tasks.error;
    return {
      objective: project.objective, successCriteria: Array.isArray(project.success_criteria_json) ? project.success_criteria_json : [],
      ownerId: project.owner_id, targetDate: project.target_date, milestoneCount: milestones.count || 0,
      tasks: (tasks.data || []).map((task: any) => ({ assignedTo: task.assigned_to, estimateMinutes: task.estimate_minutes, stage: taskStage(task) })),
    };
  },
  async collaboratorIds(taskId: string) {
    const { data, error } = await supabase.from('task_collaborators').select('user_id').eq('task_id', taskId);
    if (error) throw error;
    return (data || []).map((row) => row.user_id as string);
  },
  async inProgressCount(userId: string, excludeTaskId?: string) {
    let query = supabase.from('project_tasks').select('id', { count: 'exact', head: true }).eq('assigned_to', userId).eq('canonical_status', 'IN_PROGRESS');
    if (excludeTaskId) query = query.neq('id', excludeTaskId);
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  },
  // Department ops project; users without a department (CEOs) fall back to a
  // department-less standing project they belong to (Founder Office).
  async opsProjectFor(user: { id: string; organizationId?: string; departmentId?: string | null }) {
    if (!user.organizationId) return null;
    const base = supabase.from('projects').select(user.departmentId ? '*' : '*, project_members!inner(user_id)')
      .eq('organization_id', user.organizationId).eq('kind', 'STANDING').eq('archived', false);
    const query = user.departmentId ? base.eq('department_id', user.departmentId) : base.is('department_id', null).eq('project_members.user_id', user.id);
    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throw error;
    return data as any;
  },
};
