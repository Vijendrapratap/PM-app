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
  final_notes: string | null;
  is_locked: boolean;
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
