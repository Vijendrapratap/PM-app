export interface Member {
  _id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  department?: string | null;
  status: 'Active' | 'Inactive';
  photo?: string | null;
}

export interface User extends Member {
  skills: string[];
  availability: 'Available' | 'Busy' | 'On Leave';
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDocument {
  name: string;
  path: string;
  url: string;
  uploadedAt?: string;
}

export interface FinalLinks {
  github?: string | null;
  googleDrive?: string | null;
  liveWebsite?: string | null;
}

export interface Project {
  _id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  department?: string | null;
  status: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  startDate?: string | null;
  estimatedCompletionDate?: string | null;
  deadline?: string | null;
  budget?: number | null;
  owner?: { _id: string; name: string } | null;
  assignedMembers: Member[];
  tags: string[];
  progress: number;
  documents: ProjectDocument[];
  finalLinks: FinalLinks;
  finalNotes?: string | null;
  isLocked: boolean;
  completionDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateLink {
  url: string;
  label?: string;
}

export interface ProjectUpdate {
  _id: string;
  projectId: string;
  title: string;
  description: string;
  progress: number;
  status: string;
  comments?: string | null;
  documents: ProjectDocument[];
  links: UpdateLink[];
  createdBy?: { _id: string; name: string; photo?: string | null } | null;
  createdAt: string;
}

export interface DailyReport {
  _id: string;
  projectId: string;
  member: Member | null;
  teamMemberId: string;
  teamMemberName: string;
  role: string;
  reportDate: string;
  workDate: string;
  description: string;
  documentUrl?: string | null;
  documents: ProjectDocument[];
  createdBy?: { _id: string; name: string; photo?: string | null } | null;
  createdAt: string;
}
