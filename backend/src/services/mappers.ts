import { getPublicUrl } from '../lib/storage';

// Raw shapes as returned by Supabase's embedded-resource selects (see repositories/*).
// Deliberately loose (any-ish) here since they're internal wire shapes from a single call site.
//
// Field names deliberately mirror the old Mongoose/Mongo API contract (`_id`, `path`, etc.)
// rather than the new Postgres column names, since the existing frontend (kept as-is, not
// rewritten) reads `_id` and similar keys throughout every page and modal.

export const mapMember = (user: any) => ({
  _id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  department: user.department,
  status: user.status,
  photo: user.photo,
});

export const mapDocument = (doc: { name: string; storage_path: string; uploaded_at?: string }) => ({
  name: doc.name,
  path: getPublicUrl(doc.storage_path),
  url: getPublicUrl(doc.storage_path),
  uploadedAt: doc.uploaded_at,
});

export const mapProject = (row: any) => ({
  _id: row.id,
  name: row.name,
  description: row.description,
  category: row.category,
  department: row.department,
  status: row.status,
  priority: row.priority,
  startDate: row.start_date,
  estimatedCompletionDate: row.estimated_completion_date,
  deadline: row.deadline,
  budget: row.budget,
  owner: row.owner ? { _id: row.owner.id, name: row.owner.name } : null,
  assignedMembers: (row.project_members || []).map((pm: any) => mapMember(pm.user)),
  tags: row.tags || [],
  progress: row.progress,
  documents: (row.project_initial_documents || []).map(mapDocument),
  finalLinks: {
    github: row.final_github,
    googleDrive: row.final_google_drive,
    liveWebsite: row.final_live_website,
    demoVideo: row.final_demo_video,
  },
  finalNotes: row.final_notes,
  isLocked: row.is_locked,
  archived: row.archived,
  completionDate: row.completion_date,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapUpdate = (row: any) => ({
  _id: row.id,
  projectId: row.project_id,
  title: row.title,
  description: row.description,
  progress: row.progress,
  status: row.status,
  comments: row.comments,
  documents: (row.update_documents || []).map(mapDocument),
  links: (row.update_links || []).map((link: any) => ({ url: link.url, label: link.label })),
  createdBy: row.created_by ? { _id: row.created_by.id, name: row.created_by.name, photo: row.created_by.photo } : null,
  createdAt: row.created_at,
});

export const mapDailyReport = (row: any) => ({
  _id: row.id,
  projectId: row.project_id,
  member: row.member ? mapMember(row.member) : null,
  teamMemberId: row.member_id,
  teamMemberName: row.team_member_name,
  role: row.role,
  reportDate: row.report_date,
  workDate: row.work_date,
  description: row.description,
  documentUrl: row.document_url,
  documents: (row.daily_report_documents || []).map(mapDocument),
  createdBy: row.created_by ? { _id: row.created_by.id, name: row.created_by.name, photo: row.created_by.photo } : null,
  createdAt: row.created_at,
});
