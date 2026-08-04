import type { Member, Project } from '../types';

const STORAGE_KEY = 'pratap-demo-projects-v2';

const seedProjects: Project[] = [
  { _id: 'vishvas', name: 'Vishvas Foundation', description: 'Digital platform delivery for Vishvas Foundation.', category: 'Client delivery', department: 'Development', status: 'In Progress', priority: 'High', startDate: '2026-07-01', estimatedCompletionDate: '2026-08-31', owner: { _id: 'demo-delivery', name: 'Govind' }, assignedMembers: [], tags: ['foundation'], progress: 42, documents: [], finalLinks: {}, isLocked: false, archived: false, createdAt: '2026-07-01T08:00:00.000Z', updatedAt: '2026-08-03T08:00:00.000Z' },
  { _id: 'competitor-resort', name: 'Competitor Analysis (Resort)', description: 'Resort competitor research and commercial action plan.', category: 'Sales research', department: 'Sales', status: 'In Progress', priority: 'Medium', startDate: '2026-07-12', estimatedCompletionDate: '2026-08-21', owner: { _id: 'demo-sales-manager', name: 'Satyam Tiwari' }, assignedMembers: [], tags: ['research', 'resort'], progress: 35, documents: [], finalLinks: {}, isLocked: false, archived: false, createdAt: '2026-07-12T08:00:00.000Z', updatedAt: '2026-08-03T08:00:00.000Z' },
  { _id: 'niko', name: 'Niko Salon Chatbot', description: 'AI chatbot for salon enquiries, bookings and support.', category: 'AI delivery', department: 'Development', status: 'In Progress', priority: 'High', startDate: '2026-07-08', estimatedCompletionDate: '2026-08-27', owner: { _id: 'demo-lead', name: 'Anush MK' }, assignedMembers: [], tags: ['chatbot'], progress: 58, documents: [], finalLinks: {}, isLocked: false, archived: false, createdAt: '2026-07-08T08:00:00.000Z', updatedAt: '2026-08-03T08:00:00.000Z' },
  { _id: 'real-estate', name: 'Real Estate Complete Module', description: 'Complete real-estate listing, enquiry and follow-up workflow.', category: 'Product module', department: 'Development', status: 'In Progress', priority: 'Critical', startDate: '2026-06-28', estimatedCompletionDate: '2026-09-07', owner: { _id: 'demo-delivery', name: 'Govind' }, assignedMembers: [], tags: ['real-estate'], progress: 63, documents: [], finalLinks: {}, isLocked: false, archived: false, createdAt: '2026-06-28T08:00:00.000Z', updatedAt: '2026-08-03T08:00:00.000Z' },
  { _id: 'content-engine', name: 'Content Engine', description: 'Governed content planning, generation and approval workflow.', category: 'Internal AI', department: 'Marketing', status: 'In Progress', priority: 'High', startDate: '2026-07-10', estimatedCompletionDate: '2026-09-02', owner: { _id: 'demo-cio', name: 'Priyanshu Rajbhar' }, assignedMembers: [], tags: ['content', 'ai'], progress: 47, documents: [], finalLinks: {}, isLocked: false, archived: false, createdAt: '2026-07-10T08:00:00.000Z', updatedAt: '2026-08-03T08:00:00.000Z' },
  { _id: 'hermes-brain', name: 'Hermes + Obsidian Brain', description: 'Governed automation connected to organizational knowledge.', category: 'Internal AI', department: 'Development', status: 'In Progress', priority: 'High', startDate: '2026-07-15', estimatedCompletionDate: '2026-09-04', owner: { _id: 'demo-cio', name: 'Priyanshu Rajbhar' }, assignedMembers: [], tags: ['knowledge', 'automation'], progress: 31, documents: [], finalLinks: {}, isLocked: false, archived: false, createdAt: '2026-07-15T08:00:00.000Z', updatedAt: '2026-08-03T08:00:00.000Z' },
  { _id: 'ai-interviewer', name: 'AI Interviewer Platform', description: 'AI-assisted interview workflow with evidence-linked scoring.', category: 'AI platform', department: 'Development', status: 'Review', priority: 'Critical', startDate: '2026-06-24', estimatedCompletionDate: '2026-09-12', owner: { _id: 'demo-lead', name: 'Anush MK' }, assignedMembers: [], tags: ['interview', 'ai'], progress: 54, documents: [], finalLinks: {}, isLocked: false, archived: false, createdAt: '2026-06-24T08:00:00.000Z', updatedAt: '2026-08-03T08:00:00.000Z' },
];

const readStored = (): Project[] => {
  if (typeof window === 'undefined') return seedProjects;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    return Array.isArray(parsed) ? parsed : seedProjects;
  } catch {
    return seedProjects;
  }
};

const writeStored = (projects: Project[]) => {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
};

export const getDemoProjects = () => readStored();
export const getDemoProject = (id: string) => readStored().find((project) => project._id === id) || null;

export const createDemoProject = (input: {
  id?: string;
  name: string;
  description?: string;
  category?: string;
  department?: string;
  priority?: Project['priority'];
  startDate?: string;
  estimatedCompletionDate?: string;
  status?: string;
  progress?: number;
  owner?: Project['owner'];
  assignedMembers?: Member[];
  tags?: string[];
}) => {
  const now = new Date().toISOString();
  const project: Project = {
    _id: input.id || `demo-project-${Date.now()}`,
    name: input.name,
    description: input.description || 'New project ready for planning.',
    category: input.category || 'Internal systems',
    department: input.department || 'Engineering',
    status: input.status || 'Planning',
    priority: input.priority || 'Medium',
    startDate: input.startDate || now.slice(0, 10),
    estimatedCompletionDate: input.estimatedCompletionDate || null,
    owner: input.owner || { _id: 'demo-ceo', name: 'Vijendra Pratap Singh' },
    assignedMembers: input.assignedMembers || [],
    tags: input.tags || [],
    progress: input.progress || 0,
    documents: [],
    finalLinks: {},
    isLocked: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  const current = readStored();
  writeStored([project, ...current.filter((item) => item._id !== project._id)]);
  return project;
};
