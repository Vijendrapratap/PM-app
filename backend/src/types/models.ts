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
  project_id: string;
  title: string;
  description: string | null;
  blocker_reason: string | null;
  due_date: string | null;
  priority: Priority;
  status: TaskStatus;
  assigned_to: string | null;
  created_by: string | null;
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
  status: 'Inbox' | 'Evaluating' | 'Planned' | 'Building' | 'Parked';
  impact: 'Low' | 'Medium' | 'High';
  effort: 'Small' | 'Medium' | 'Large';
  category: string | null;
  created_by: string;
  created_at: string;
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
}

export type AgentType = 'Project Manager' | 'Business Analyst';
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
