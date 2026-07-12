import { z } from 'zod';

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email();

export const registerSchema = z.object({
  name: z.string().min(1),
  email: emailSchema,
  password: z.string().min(6),
  // Only honored when the caller is an authenticated Super Admin - see
  // authService.register. Optional so public self-registration can omit it.
  role: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  skills: z.array(z.string()).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const updateUserSchema = z.object({
  name: z.string().optional(),
  email: emailSchema.optional(),
  role: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  availability: z.enum(['Available', 'Busy', 'On Leave']).optional(),
  skills: z.array(z.string()).optional(),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(6),
});

const prioritySchema = z.enum(['Low', 'Medium', 'High', 'Critical']);
const taskStatusSchema = z.enum(['Pending', 'In Progress', 'In Review', 'Completed', 'Blocked']);

export const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  department: z.string().optional(),
  priority: prioritySchema.optional(),
  startDate: z.string().optional(),
  estimatedCompletionDate: z.string().optional(),
  deadline: z.string().optional(),
  budget: z.coerce.number().optional(),
  assignedMembers: z.union([z.array(z.string()), z.string()]).optional(),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
  status: z.string().optional(),
});

// Postgres `date` columns reject '' outright ("invalid input syntax for type
// date"). The edit form always submits these fields, blank or not, so an
// empty string here must be treated the same as "not provided", not as a
// literal value to save.
const optionalDateString = z
  .string()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

export const updateProjectSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  department: z.string().optional(),
  priority: prioritySchema.optional(),
  startDate: optionalDateString,
  estimatedCompletionDate: optionalDateString,
  deadline: optionalDateString,
  budget: z.coerce.number().optional(),
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

export const addProjectMemberSchema = z.object({
  userId: z.string().min(1),
});

export const createMessageSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  priority: prioritySchema.optional(),
  startDate: z.string().optional(),
  expiryDate: z.string().min(1),
  pinned: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const updateMessageSchema = createMessageSchema.partial();

export const createTodoSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  priority: prioritySchema.optional(),
  assignedTo: z.string().optional(),
});

export const updateTodoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  dueDate: optionalDateString,
  priority: prioritySchema.optional(),
  status: taskStatusSchema.optional(),
  assignedTo: z.string().optional(),
});

export const createSubtaskSchema = z.object({
  title: z.string().min(1),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  priority: prioritySchema.optional(),
  addToToday: z.boolean().optional(),
});

export const updateSubtaskSchema = z.object({
  title: z.string().optional(),
  status: taskStatusSchema.optional(),
  assignedTo: z.string().optional(),
  dueDate: optionalDateString,
  priority: prioritySchema.optional(),
  addToToday: z.boolean().optional(),
});

export const createProjectTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  priority: prioritySchema.optional(),
  assignedTo: z.string().optional(),
});

export const updateProjectTaskSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  dueDate: optionalDateString,
  priority: prioritySchema.optional(),
  status: taskStatusSchema.optional(),
  assignedTo: z.string().optional(),
});

export const createProjectTaskSubtaskSchema = z.object({
  title: z.string().min(1),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  priority: prioritySchema.optional(),
});

export const updateProjectTaskSubtaskSchema = z.object({
  title: z.string().optional(),
  status: taskStatusSchema.optional(),
  assignedTo: z.string().optional(),
  dueDate: optionalDateString,
  priority: prioritySchema.optional(),
});

export const createIdeaSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().max(60).optional(),
  impact: z.enum(['Low', 'Medium', 'High']).optional(),
  effort: z.enum(['Small', 'Medium', 'Large']).optional(),
});

export const updateIdeaSchema = z.object({
  status: z.enum(['Inbox', 'Evaluating', 'Planned', 'Building', 'Parked']).optional(),
  category: z.string().max(60).optional(),
  impact: z.enum(['Low', 'Medium', 'High']).optional(),
  effort: z.enum(['Small', 'Medium', 'Large']).optional(),
});
