import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.string().min(1),
  department: z.string().optional(),
  phone: z.string().optional(),
  skills: z.array(z.string()).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateUserSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  role: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  availability: z.enum(['Available', 'Busy', 'On Leave']).optional(),
  skills: z.array(z.string()).optional(),
});

export const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  department: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  startDate: z.string().optional(),
  estimatedCompletionDate: z.string().optional(),
  deadline: z.string().optional(),
  budget: z.coerce.number().optional(),
  assignedMembers: z.union([z.array(z.string()), z.string()]).optional(),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
  status: z.string().optional(),
});

export const addUpdateSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  progress: z.coerce.number().min(0).max(100),
  status: z.string().min(1),
  comments: z.string().optional(),
  links: z.union([z.array(z.object({ url: z.string(), label: z.string().optional() })), z.string()]).optional(),
});

export const saveDailyReportSchema = z.object({
  reportDate: z.string().min(1),
  memberId: z.string().min(1),
  description: z.string().min(1),
});

export const finishProjectSchema = z.object({
  github: z.string().optional(),
  googleDrive: z.string().optional(),
  liveWebsite: z.string().optional(),
  finalNotes: z.string().optional(),
});
