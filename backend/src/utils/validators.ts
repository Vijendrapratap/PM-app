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
  role: z.string().optional(),
  designation: z.string().max(120).optional(),
  department: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  managerUserId: z.string().uuid().optional(),
  timezone: z.string().max(100).optional(),
  dailyCapacityMinutes: z.coerce.number().int().min(0).max(1440).optional(),
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
export const onboardingSchema = z.object({
  timezone: z.string().trim().min(1).max(100),
  typicalWorkStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  typicalWorkEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  notificationPreference: z.enum(['IMMEDIATE_AND_DIGEST', 'DIGEST_ONLY']).optional(),
});

const departmentTypeSchema = z.enum(['DEVELOPMENT', 'MARKETING', 'SALES', 'OPERATIONS', 'OTHER']);
export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(40).optional(),
  type: departmentTypeSchema.default('OTHER'),
  lead_user_id: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
});
export const updateDepartmentSchema = createDepartmentSchema.partial();

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
  useAiPlanning: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
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
  github: z.string().optional(),
  demoVideo: z.string().optional(),
});

export const addUpdateSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  progress: z.coerce.number().min(0).max(100).optional(),
  status: z.string().min(1).optional(),
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
  demoVideo: z.string().optional(),
  finalNotes: z.string().optional(),
});

export const addProjectMemberSchema = z.object({
  userId: z.string().min(1),
});
export const setProjectHealthSchema = z.object({ health: z.enum(['ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'NOT_SET']), note: z.string().max(2000).optional() });

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
  domainType: z.enum(['PERSONAL', 'DEVELOPMENT', 'MARKETING', 'SALES', 'OPERATIONS']).optional(),
  workType: z.enum(['TASK', 'MEETING', 'UPDATE']).optional(),
  recurrence: z.enum(['NONE', 'DAILY', 'WEEKDAYS', 'WEEKLY']).optional(),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  meetingWith: z.string().max(240).optional(),
  channel: z.string().max(120).optional(),
});

export const updateTodoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  dueDate: optionalDateString,
  priority: prioritySchema.optional(),
  status: taskStatusSchema.optional(),
  assignedTo: z.string().optional(),
  domainType: z.enum(['PERSONAL', 'DEVELOPMENT', 'MARKETING', 'SALES', 'OPERATIONS']).optional(),
  workType: z.enum(['TASK', 'MEETING', 'UPDATE']).optional(),
  recurrence: z.enum(['NONE', 'DAILY', 'WEEKDAYS', 'WEEKLY']).optional(),
  scheduledStart: z.string().datetime().nullable().optional(),
  scheduledEnd: z.string().datetime().nullable().optional(),
  meetingWith: z.string().max(240).nullable().optional(),
  channel: z.string().max(120).nullable().optional(),
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
  milestoneId: z.string().uuid().optional(),
  deliverableId: z.string().uuid().optional(),
});

export const updateProjectTaskSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  blockerReason: z.string().optional(),
  dueDate: optionalDateString,
  priority: prioritySchema.optional(),
  status: taskStatusSchema.optional(),
  assignedTo: z.string().optional(),
  canonicalStatus: z.enum(['BACKLOG', 'READY', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED', 'DEFERRED']).optional(),
  milestoneId: z.string().uuid().nullable().optional(),
  deliverableId: z.string().uuid().nullable().optional(),
});

export const createTaskCommentSchema = z.object({ body: z.string().min(1).max(2000) });

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
  description: z.string().min(1).optional(),
  problem: z.string().min(1).optional(),
  proposedSolution: z.string().max(4000).optional(),
  beneficiary: z.string().max(1000).optional(),
  expectedValue: z.string().max(2000).optional(),
  departmentId: z.string().uuid().optional(),
  category: z.string().max(60).optional(),
  impact: z.enum(['Low', 'Medium', 'High']).optional(),
  effort: z.enum(['Small', 'Medium', 'Large']).optional(),
}).refine((value) => Boolean(value.problem || value.description), { message: 'Problem or opportunity is required' });

export const updateIdeaSchema = z.object({
  status: z.enum(['INBOX', 'NEEDS_CLARIFICATION', 'UNDER_REVIEW', 'VALIDATING', 'APPROVED', 'INCUBATING', 'CONVERTED_TO_PROJECT', 'ARCHIVED', 'REJECTED']).optional(),
  title: z.string().min(1).optional(), problem: z.string().min(1).optional(), description: z.string().min(1).optional(),
  proposedSolution: z.string().max(4000).optional(), beneficiary: z.string().max(1000).optional(), expectedValue: z.string().max(2000).optional(), departmentId: z.string().uuid().optional(),
  businessValueScore: z.coerce.number().int().min(1).max(5).optional(), strategicAlignmentScore: z.coerce.number().int().min(1).max(5).optional(), urgencyScore: z.coerce.number().int().min(1).max(5).optional(), deliveryEffortScore: z.coerce.number().int().min(1).max(5).optional(),
  category: z.string().max(60).optional(),
  impact: z.enum(['Low', 'Medium', 'High']).optional(),
  effort: z.enum(['Small', 'Medium', 'Large']).optional(),
});

const workdayItemStatusSchema = z.enum(['Planned', 'In Progress', 'Completed', 'Blocked', 'Deferred']);

export const startWorkdaySchema = z.object({
  focus: z.string().trim().min(3).max(240),
  remarks: z.string().max(2000).optional(),
  items: z.array(z.object({
    projectId: z.string().uuid(),
    taskId: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(180),
    plannedOutcome: z.string().trim().min(3).max(500),
    remarks: z.string().max(1000).optional(),
    source: z.enum(['CARRYOVER', 'ASSIGNED', 'ADDED_TODAY']).optional(),
    plannedEstimateMinutes: z.coerce.number().int().min(0).max(1440).optional(),
    carriedFromItemId: z.string().uuid().optional(),
    carryoverReason: z.string().max(1000).optional(),
    priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  })).min(1).max(20),
});

export const startWorkSessionSchema = z.object({
  dailyPlanId: z.string().uuid(),
  taskId: z.string().uuid().optional(),
  note: z.string().max(1000).optional(),
});
export const workSessionNoteSchema = z.object({ note: z.string().max(1000) });

export const reportBlockerSchema = z.object({
  summary: z.string().trim().min(1).max(240),
  details: z.string().max(3000).optional(),
  waitingOnType: z.enum(['PERSON', 'CLIENT', 'EXTERNAL_SYSTEM', 'DECISION', 'DEPENDENCY', 'OTHER']),
  waitingOnUserId: z.string().uuid().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  suggestedNextAction: z.string().max(1000).optional(),
  resolutionOwnerUserId: z.string().uuid().optional(),
});
export const resolveBlockerSchema = z.object({ resolutionNote: z.string().trim().min(1).max(2000) });
export const taskPauseSchema = z.object({ note: z.string().max(1000).optional() });
export const taskUpdateEventSchema = z.object({ updateText: z.string().trim().min(1).max(3000), progressPercent: z.coerce.number().int().min(0).max(100).optional(), remainingEstimateMinutes: z.coerce.number().int().min(0).max(100000).optional() });
export const taskReviewRequestSchema = z.object({ reviewerUserId: z.string().uuid().optional() });
export const taskReviewDecisionSchema = z.object({ note: z.string().max(2000).optional() });
export const completeTaskSchema = z.object({ completionNote: z.string().max(3000).optional(), deliveredOutput: z.string().max(3000).optional(), reviewerUserId: z.string().uuid().optional() });

export const createMilestoneSchema = z.object({
  name: z.string().trim().min(1).max(240), description: z.string().max(3000).optional(), sequence: z.coerce.number().int().min(0).optional(),
  ownerUserId: z.string().uuid().optional(), status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']).optional(), startDate: optionalDateString, targetDate: optionalDateString,
});
export const updateMilestoneSchema = createMilestoneSchema.partial();
export const createDeliverableSchema = z.object({
  name: z.string().trim().min(1).max(240), description: z.string().max(3000).optional(), ownerUserId: z.string().uuid().optional(),
  status: z.enum(['PLANNED', 'ACTIVE', 'IN_REVIEW', 'COMPLETED', 'CANCELLED']).optional(), acceptanceCriteria: z.array(z.string().trim().min(1).max(500)).max(30).optional(), targetDate: optionalDateString,
});
export const updateDeliverableSchema = createDeliverableSchema.partial();

export const updateWorkdayItemSchema = z.object({
  status: workdayItemStatusSchema.optional(),
  progressNote: z.string().max(1000).optional(),
  blockerReason: z.string().max(1000).optional(),
});

export const finishWorkdaySchema = z.object({
  completedSummary: z.string().trim().min(3).max(3000),
  blockers: z.string().max(2000).optional(),
  remarks: z.string().max(2000).optional(),
  items: z.array(z.object({
    id: z.string().uuid(),
    status: workdayItemStatusSchema,
    progressNote: z.string().max(1000).optional(),
    blockerReason: z.string().max(1000).optional(),
    endState: z.enum(['DONE', 'CARRY_OVER', 'RESCHEDULED', 'BACKLOG', 'BLOCKED', 'NO_LONGER_REQUIRED']).optional(),
    carryoverReason: z.string().max(1000).optional(),
  })).min(1).max(20),
});

const planTaskDraftSchema = z.object({
  key: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(3000),
  estimateDays: z.coerce.number().min(0.25).max(365),
  priority: prioritySchema,
  acceptanceCriteria: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
});

const planFeatureDraftSchema = z.object({
  key: z.string().trim().min(1).max(100),
  milestone: z.string().trim().min(1).max(240).default('Delivery'),
  title: z.string().trim().min(1).max(240),
  outcome: z.string().trim().min(1).max(2000),
  description: z.string().trim().min(1).max(4000),
  acceptanceCriteria: z.array(z.string().trim().min(1).max(500)).min(1).max(30),
  priority: prioritySchema,
  estimateDays: z.coerce.number().min(0.25).max(1000),
  confidence: z.enum(['Low', 'Medium', 'High']),
  tasks: z.array(planTaskDraftSchema).min(1).max(50),
});

export const projectPlanContentSchema = z.object({
  summary: z.string().trim().min(3).max(5000),
  assumptions: z.array(z.string().trim().min(1).max(1000)).max(50),
  risks: z.array(z.string().trim().min(1).max(1000)).max(50),
  questions: z.array(z.string().trim().min(1).max(1000)).max(50),
  features: z.array(planFeatureDraftSchema).min(1).max(30),
});

export const updatePlanDraftSchema = z.object({ content: projectPlanContentSchema });
export const runAgentSchema = z.object({ force: z.boolean().optional() });
export const updateKnowledgeDocumentSchema = z.object({ content: z.string().trim().min(20).max(100000) });
export const updateAgentDefinitionSchema = z.object({ systemPrompt: z.string().trim().min(80).max(30000), changeNote: z.string().trim().max(500).optional() });
