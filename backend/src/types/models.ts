export type UserStatus = 'Active' | 'Inactive';
export type UserAvailability = 'Available' | 'Busy' | 'On Leave';
export type ProjectStatus =
  | 'Draft'
  | 'Saved'
  | 'Planning'
  | 'In Progress'
  | 'Review'
  | 'Testing'
  | 'Completed'
  | 'Cancelled'
  | 'On Hold';
export type ProjectPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string | null;
  role: string;
  platform_role?: 'CEO' | 'MANAGER' | 'TEAM_MEMBER';
  organization_id?: string;
  designation?: string | null;
  department_id?: string | null;
  manager_user_id?: string | null;
  timezone?: string | null;
  daily_capacity_minutes?: number | null;
  account_status?: 'INVITED' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | null;
  onboarding_completed_at?: string | null;
  typical_work_start?: string | null;
  typical_work_end?: string | null;
  notification_preferences_json?: Record<string, unknown>;
  department: string | null;
  phone: string | null;
  skills: string[];
  status: UserStatus;
  availability: UserAvailability;
  photo: string | null;
  deleted_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  source_idea_id?: string | null;
  organization_id?: string;
  department_id?: string | null;
  objective?: string | null;
  expected_outcome?: string | null;
  health?: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'NOT_SET';
  target_date?: string | null;
  created_by?: string | null;
  archived_at?: string | null;
  health_note?: string | null;
  health_updated_by?: string | null;
  health_updated_at?: string | null;
  name: string;
  description: string | null;
  category: string | null;
  department: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  start_date: string | null;
  estimated_completion_date: string | null;
  deadline: string | null;
  budget: number | null;
  owner_id: string;
  tags: string[];
  progress: number;
  final_github: string | null;
  final_google_drive: string | null;
  final_live_website: string | null;
  final_demo_video: string | null;
  final_notes: string | null;
  is_locked: boolean;
  archived: boolean;
  completion_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentRef {
  name: string;
  storage_path: string;
  url: string;
}

export interface Update {
  id: string;
  project_id: string;
  title: string;
  description: string;
  progress: number;
  status: string;
  comments: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DailyReport {
  id: string;
  project_id: string;
  member_id: string;
  team_member_name: string;
  role: string;
  report_date: string;
  work_date: string;
  description: string;
  document_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  user_id: string;
  project_id: string | null;
  details: string;
  created_at: string;
}

export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';
export type TaskStatus = 'Pending' | 'In Progress' | 'In Review' | 'Completed' | 'Blocked';
export type MessagePriority = Priority;

export interface ImportantMessage {
  id: string;
  title: string;
  description: string;
  priority: MessagePriority;
  start_date: string;
  expiry_date: string;
  pinned: boolean;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DailyTodo {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  original_due_date: string | null;
  carry_forward_count: number;
  priority: Priority;
  status: TaskStatus;
  assigned_to: string | null;
  created_by: string | null;
  completed_at: string | null;
  domain_type: 'PERSONAL' | 'DEVELOPMENT' | 'MARKETING' | 'SALES' | 'OPERATIONS';
  work_type: 'TASK' | 'MEETING' | 'UPDATE';
  recurrence: 'NONE' | 'DAILY' | 'WEEKDAYS' | 'WEEKLY';
  scheduled_start: string | null;
  scheduled_end: string | null;
  meeting_with: string | null;
  channel: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyTodoSubtask {
  id: string;
  todo_id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assigned_to: string | null;
  due_date: string | null;
  add_to_today: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectTask {
  id: string;
  organization_id?: string;
  project_id: string;
  milestone_id?: string | null;
  deliverable_id?: string | null;
  department_type?: string | null;
  task_type?: string | null;
  title: string;
  description: string | null;
  blocker_reason: string | null;
  blocked?: boolean;
  canonical_status?: 'BACKLOG' | 'READY' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED' | 'DEFERRED' | null;
  estimate_minutes?: number | null;
  remaining_estimate_minutes?: number | null;
  reviewer_user_id?: string | null;
  review_requested_at?: string | null;
  completion_note?: string | null;
  due_date: string | null;
  priority: Priority;
  status: TaskStatus;
  assigned_to: string | null;
  created_by: string | null;
  reporter_user_id?: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectTaskSubtask {
  id: string;
  task_id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Idea {
  id: string;
  title: string;
  description: string;
  status: 'INBOX' | 'NEEDS_CLARIFICATION' | 'UNDER_REVIEW' | 'VALIDATING' | 'APPROVED' | 'INCUBATING' | 'CONVERTED_TO_PROJECT' | 'ARCHIVED' | 'REJECTED';
  impact: 'Low' | 'Medium' | 'High';
  effort: 'Small' | 'Medium' | 'Large';
  category: string | null;
  created_by: string;
  created_at: string;
  organization_id?: string;
  department_id?: string | null;
  submitted_by?: string;
  problem?: string;
  proposed_solution?: string | null;
  beneficiary?: string | null;
  expected_value?: string | null;
  business_value_score?: number | null;
  strategic_alignment_score?: number | null;
  urgency_score?: number | null;
  delivery_effort_score?: number | null;
  priority_score?: number | null;
  converted_project_id?: string | null;
  archived_at?: string | null;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  related_type: string | null;
  related_id: string | null;
  read: boolean;
  created_at: string;
}

export type WorkdayStatus = 'Open' | 'Completed';
export type WorkdayItemStatus = 'Planned' | 'In Progress' | 'Completed' | 'Blocked' | 'Deferred';

export interface Workday {
  id: string;
  user_id: string;
  work_date: string;
  status: WorkdayStatus;
  focus: string;
  check_in_at: string;
  check_out_at: string | null;
  completed_summary: string | null;
  blockers: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  organization_id?: string;
  timezone?: string | null;
  plan_status?: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'REOPENED' | null;
  generated_summary?: string | null;
}

export interface WorkdayItem {
  id: string;
  workday_id: string;
  project_id: string | null;
  task_id: string | null;
  title: string;
  planned_outcome: string;
  status: WorkdayItemStatus;
  progress_note: string | null;
  blocker_reason: string | null;
  created_at: string;
  updated_at: string;
  source?: 'CARRYOVER' | 'ASSIGNED' | 'ADDED_TODAY' | null;
  planned_estimate_minutes?: number | null;
  order_index?: number;
  end_state?: string | null;
  carryover_reason?: string | null;
  carryover_count?: number;
}

export interface WorkSession {
  id: string;
  organization_id: string;
  user_id: string;
  daily_plan_id: string;
  task_id: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'CLOSED';
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type AgentType = 'Project Manager' | 'Business Analyst' | 'Case Study' | 'Daily Summary';
export type AgentRunStatus = 'Queued' | 'Working' | 'Ready for review' | 'Approved' | 'Changes requested' | 'Failed';
export type ReviewStatus = 'Draft' | 'In review' | 'Approved' | 'Superseded';

export interface AgentRun {
  id: string;
  project_id: string;
  agent_type: AgentType;
  status: AgentRunStatus;
  trigger_event: string;
  provider: string;
  input_snapshot: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  created_by: string;
  reviewed_by: string | null;
  review_note: string | null;
  started_at: string | null;
  completed_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanTaskDraft {
  key: string;
  title: string;
  description: string;
  estimateDays: number;
  priority: Priority;
  acceptanceCriteria: string[];
}

export interface PlanFeatureDraft {
  key: string;
  milestone?: string;
  title: string;
  outcome: string;
  description: string;
  acceptanceCriteria: string[];
  priority: Priority;
  estimateDays: number;
  confidence: 'Low' | 'Medium' | 'High';
  tasks: PlanTaskDraft[];
}

export interface ProjectPlanContent {
  summary: string;
  assumptions: string[];
  risks: string[];
  questions: string[];
  features: PlanFeatureDraft[];
}
