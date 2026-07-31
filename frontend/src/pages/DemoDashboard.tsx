import DemoPersonaBar from '../components/DemoPersonaBar';
import TeamMemberDemo from '../components/TeamMemberDemo';
import DeliveryLeadershipDemo from '../components/DeliveryLeadershipDemo';
import { CeoDashboard } from '../components/LeadershipDashboards';
import { useAuth } from '../context/AuthContext';
import type { Project, ProjectDocument, Priority } from '../types';
import type { ProjectTask } from '../api/projectTaskApi';
import type { AgentReviewQueueItem } from '../api/agentWorkflowApi';
import type { Workday } from '../api/workdayApi';

const now = '2026-07-31T08:30:00.000Z';
const member = (id: string, name: string, role = 'Team Member') => ({ _id: id, name, email: `${id}@pratap.ai`, role, status: 'Active' as const, department: 'Engineering', photo: null });
const team = [member('alex', 'Alex Rivera'), member('meera', 'Meera Nair'), member('aarav', 'Aarav Shah'), member('zoya', 'Zoya Khan')];

const project = (id: string, name: string, progress: number, priority: Priority, deadline: string, status = 'In Progress'): Project => ({
  _id: id, name, description: null, category: 'Product', department: 'Engineering', status, priority,
  startDate: '2026-07-06', estimatedCompletionDate: deadline, deadline, budget: null,
  owner: { _id: 'govind', name: 'Govind' }, assignedMembers: team.slice(0, id === 'portal' ? 4 : 3),
  tags: ['Delivery'], progress, documents: [] as ProjectDocument[], finalLinks: {}, finalNotes: null,
  isLocked: false, archived: false, completionDate: null, createdAt: now, updatedAt: now,
});

const projects = [
  project('portal', 'Customer Portal V2', 78, 'High', '2026-08-18'),
  project('agents', 'Agent Operations Studio', 46, 'Critical', '2026-08-08'),
  project('recruitment', 'AI Recruitment Platform', 62, 'High', '2026-08-22'),
  project('content', 'Content Engine', 31, 'Medium', '2026-09-05', 'Planning'),
];

const task = (id: string, projectId: string, title: string, status: ProjectTask['status'], assignedTo: string | null, dueDate: string, priority: Priority = 'High', blockerReason: string | null = null): ProjectTask => ({
  _id: id, projectId, title, description: null, blockerReason, dueDate, priority, status,
  assignedTo: assignedTo ? { _id: assignedTo, name: team.find((person) => person._id === assignedTo)?.name || assignedTo } : null,
  createdBy: { _id: 'govind', name: 'Govind' }, completedAt: null, documents: [], comments: [], subtasks: [], createdAt: now, updatedAt: now,
});

const taskGroups = [
  { project: projects[0], tasks: [task('t1', 'portal', 'Mobile navigation regression', 'In Review', 'alex', '2026-08-02'), task('t2', 'portal', 'Staging CORS configuration', 'Blocked', 'meera', '2026-07-31', 'Critical', 'Waiting for DevOps environment access')] },
  { project: projects[1], tasks: [task('t3', 'agents', 'Approval history interface', 'In Review', 'alex', '2026-08-03'), task('t4', 'agents', 'Business Analyst document versioning', 'In Progress', 'zoya', '2026-08-04'), task('t5', 'agents', 'Agent run observability', 'Pending', null, '2026-08-05')] },
  { project: projects[2], tasks: [task('t6', 'recruitment', 'Interview scoring calibration', 'Blocked', 'aarav', '2026-08-02', 'High', 'Needs approved evaluation rubric'), task('t7', 'recruitment', 'Candidate consent flow', 'In Review', 'meera', '2026-08-06')] },
  { project: projects[3], tasks: [task('t8', 'content', 'Define publishing adapters', 'Pending', null, '2026-08-12')] },
];

const agentQueue: AgentReviewQueueItem[] = [
  { _id: 'run-1', agentType: 'Project Manager', status: 'Ready for review', provider: 'OpenRouter', completedAt: now, createdAt: now, workspace: 'plan', project: { _id: 'content', name: 'Content Engine', priority: 'Medium', deadline: '2026-09-05' } },
  { _id: 'run-2', agentType: 'Business Analyst', status: 'Ready for review', provider: 'OpenRouter', completedAt: now, createdAt: now, workspace: 'documents', project: { _id: 'agents', name: 'Agent Operations Studio', priority: 'Critical', deadline: '2026-08-08' } },
];

const workday: Workday = {
  _id: 'wd-demo', userId: 'demo-delivery', user: null, workDate: '2026-07-31', status: 'Open',
  focus: 'Clear approvals and remove the two delivery blockers', checkInAt: now, checkOutAt: null,
  completedSummary: null, blockers: null, remarks: null, items: [], createdAt: now, updatedAt: now,
};

const capacity = [
  { _id: 'alex', name: 'Alex Rivera', availability: 'Busy', openTasks: 5, overdueTasks: 0 },
  { _id: 'meera', name: 'Meera Nair', availability: 'Available', openTasks: 4, overdueTasks: 1 },
  { _id: 'aarav', name: 'Aarav Shah', availability: 'Busy', openTasks: 6, overdueTasks: 2 },
  { _id: 'zoya', name: 'Zoya Khan', availability: 'Available', openTasks: 3, overdueTasks: 0 },
];

const blockers = taskGroups.flatMap(({ project: itemProject, tasks }) => tasks.filter((item) => item.status === 'Blocked').map((item) => ({ project: itemProject, task: item })));
const unassigned = taskGroups.flatMap(({ project: itemProject, tasks }) => tasks.filter((item) => !item.assignedTo).map((item) => ({ project: itemProject, task: item })));
const shared = { projects, risks: [projects[1]], blockers, unassigned, capacity, agentQueue, workday };

const DemoDashboard = () => {
  const { demoPersona } = useAuth();

  return (
    <div className="demo-role-workspace">
      <DemoPersonaBar />
      {demoPersona === 'team' && <TeamMemberDemo />}
      {demoPersona === 'delivery' && <DeliveryLeadershipDemo />}
      {(!demoPersona || demoPersona === 'ceo') && <CeoDashboard name="Pratap" {...shared} totalProjects={9} completedProjects={3} teamSize={12}/>}
    </div>
  );
};

export default DemoDashboard;
