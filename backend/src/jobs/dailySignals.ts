import type { WorkLimits } from '../policies/workGatePolicy';
import { supabase } from '../config/supabase';
import { projectStage, taskStage, workGateRepository } from '../repositories/workGateRepository';
import { notificationService } from '../services/notificationService';

export interface SignalFacts {
  projects: { id: string; ownerId: string; kind: 'DELIVERY' | 'STANDING'; stage: string; targetDate: string | null; lastLogDate: string | null; activatedDate: string }[];
  tasks: { id: string; projectId: string; assignedTo: string | null; stage: string; lastLogDate: string | null; startedDate: string | null; carryForwardCount: number }[];
}
export interface DetectedSignal {
  kind: 'STALE_PROJECT' | 'STALE_TASK' | 'UNASSIGNED_READY_TASK' | 'OVERDUE_PROJECT' | 'REPEATED_CARRY';
  subjectType: 'PROJECT' | 'TASK';
  subjectId: string;
  projectId: string;
  notify: string | null;
  message: string;
}

const dayMs = 86_400_000;
export const workingDaysBetween = (from: string, to: string) => {
  let days = 0;
  for (let time = Date.parse(`${from}T00:00:00Z`) + dayMs; time <= Date.parse(`${to}T00:00:00Z`); time += dayMs) {
    const weekday = new Date(time).getUTCDay();
    if (weekday !== 0 && weekday !== 6) days += 1;
  }
  return days;
};

export const detectSignals = (facts: SignalFacts, limits: WorkLimits, today: string): DetectedSignal[] => {
  const projectById = new Map(facts.projects.map((project) => [project.id, project]));
  const signals: DetectedSignal[] = [];
  for (const project of facts.projects) {
    if (project.kind !== 'DELIVERY' || project.stage !== 'ACTIVE') continue;
    const idleDays = workingDaysBetween(project.lastLogDate || project.activatedDate, today);
    if (idleDays >= limits.staleProjectDays) signals.push({ kind: 'STALE_PROJECT', subjectType: 'PROJECT', subjectId: project.id, projectId: project.id, notify: project.ownerId, message: `No work logged for ${idleDays} working days. Park it or plan the next task.` });
    if (project.targetDate && project.targetDate < today) signals.push({ kind: 'OVERDUE_PROJECT', subjectType: 'PROJECT', subjectId: project.id, projectId: project.id, notify: project.ownerId, message: `Past its target date (${project.targetDate}).` });
  }
  for (const task of facts.tasks) {
    const owner = projectById.get(task.projectId)?.ownerId || null;
    if (task.stage === 'IN_PROGRESS') {
      const idleDays = workingDaysBetween(task.lastLogDate || task.startedDate || today, today);
      if (idleDays >= limits.staleTaskDays) signals.push({ kind: 'STALE_TASK', subjectType: 'TASK', subjectId: task.id, projectId: task.projectId, notify: task.assignedTo, message: `In progress with no work logged for ${idleDays} working days.` });
    }
    if (['READY', 'BACKLOG'].includes(task.stage) && !task.assignedTo) signals.push({ kind: 'UNASSIGNED_READY_TASK', subjectType: 'TASK', subjectId: task.id, projectId: task.projectId, notify: owner, message: 'Open task with nobody assigned.' });
    if (task.carryForwardCount > 2) signals.push({ kind: 'REPEATED_CARRY', subjectType: 'TASK', subjectId: task.id, projectId: task.projectId, notify: owner, message: `Carried over ${task.carryForwardCount} times.` });
  }
  return signals;
};

const lastRunByOrg = new Map<string, string>();

export const runDailySignals = async (now = new Date()) => {
  const today = now.toISOString().slice(0, 10);
  const { data: orgs, error } = await supabase.from('organizations').select('id');
  if (error) throw error;
  let created = 0;
  for (const { id: organizationId } of orgs || []) {
    if (lastRunByOrg.get(organizationId) === today) continue;
    const [projects, tasks, logs] = await Promise.all([
      supabase.from('projects').select('id, owner_id, kind, status, canonical_status, target_date, updated_at').eq('organization_id', organizationId).eq('archived', false),
      supabase.from('project_tasks').select('id, project_id, assigned_to, status, canonical_status, carry_forward_count, updated_at').eq('organization_id', organizationId),
      supabase.from('work_logs').select('project_id, task_id, created_at').eq('organization_id', organizationId).gte('created_at', new Date(now.getTime() - 30 * 86_400_000).toISOString()),
    ]);
    for (const result of [projects, tasks, logs]) if (result.error) throw result.error;
    const lastLog = (key: 'project_id' | 'task_id', id: string) => (logs.data || []).filter((log: any) => log[key] === id).map((log: any) => log.created_at.slice(0, 10)).sort().pop() || null;
    // ponytail: activatedDate/startedDate use updated_at as a proxy, which is good enough for 30-day staleness. Read activity_events for exact stage-change dates if false positives show up.
    const facts: SignalFacts = {
      projects: (projects.data || []).map((row: any) => ({ id: row.id, ownerId: row.owner_id, kind: row.kind || 'DELIVERY', stage: projectStage(row), targetDate: row.target_date, lastLogDate: lastLog('project_id', row.id), activatedDate: row.updated_at.slice(0, 10) })),
      tasks: (tasks.data || []).map((row: any) => ({ id: row.id, projectId: row.project_id, assignedTo: row.assigned_to, stage: taskStage(row), lastLogDate: lastLog('task_id', row.id), startedDate: row.updated_at.slice(0, 10), carryForwardCount: row.carry_forward_count || 0 })),
    };
    for (const signal of detectSignals(facts, await workGateRepository.limits(organizationId), today)) {
      const { data: inserted, error: insertError } = await supabase.from('signals')
        .upsert({ organization_id: organizationId, kind: signal.kind, subject_type: signal.subjectType, subject_id: signal.subjectId, project_id: signal.projectId, signal_date: today, details: { message: signal.message } }, { onConflict: 'organization_id,kind,subject_id,signal_date', ignoreDuplicates: true })
        .select('id');
      if (insertError) throw insertError;
      if (!inserted?.length) continue;
      created += 1;
      if (signal.notify) await notificationService.notify(signal.notify, 'work_signal', signal.kind.replace(/_/g, ' ').toLowerCase(), signal.message, { link: `/projects/${signal.projectId}`, relatedType: signal.subjectType === 'PROJECT' ? 'project' : 'project_task', relatedId: signal.subjectId });
    }
    lastRunByOrg.set(organizationId, today);
  }
  return created;
};
