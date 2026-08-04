import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Bot, Calendar, CheckCircle2, ChevronRight, Columns3, FileCheck2,
  Layers3, ListTree, Lock, TrendingUp, Users,
} from 'lucide-react';
import AgentWorkflowPanel from '../components/AgentWorkflowPanel';
import CaseStudyPanel from '../components/CaseStudyPanel';
import FinishProjectModal from '../components/FinishProjectModal';
import ProjectActivityRail from '../components/ProjectActivityRail';
import ProjectMilestonePanel from '../components/ProjectMilestonePanel';
import ProjectTaskList from '../components/ProjectTaskList';
import { useAuth } from '../context/AuthContext';
import { useProjectDetails } from '../hooks/useProjectDetails';
import { canApproveAgentWork, isLead, isSuperAdmin } from '../utils/roles';

type Workspace = 'delivery' | 'documents' | 'assistant';
type DeliveryView = 'outline' | 'board';

const getStatusBadge = (status: string) => ({
  Completed: 'badge-success',
  Draft: 'badge-neutral',
  'In Progress': 'badge-primary',
  Review: 'badge-warning',
  Testing: 'badge-purple',
  Planning: 'badge-info',
  Blocked: 'badge-danger',
  'On Hold': 'badge-danger',
}[status] || 'badge-neutral');

const formatTargetDate = (value?: string | null) => value
  ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
  : 'No target date';

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { project, updates, loading, error, refetch } = useProjectDetails(id);
  const [deliveryView, setDeliveryView] = useState<DeliveryView>('outline');
  const [executionVersion, setExecutionVersion] = useState(0);
  const [isFinishOpen, setIsFinishOpen] = useState(false);

  const requestedWorkspace = searchParams.get('workspace');
  const workspace: Workspace = requestedWorkspace === 'documents' || requestedWorkspace === 'assistant'
    ? requestedWorkspace
    : 'delivery';

  const changeWorkspace = (next: Workspace) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'delivery') params.delete('workspace');
    else params.set('workspace', next);
    setSearchParams(params, { replace: true });
  };

  const refreshExecution = async () => {
    setExecutionVersion((value) => value + 1);
    await refetch();
  };

  if (loading) {
    return <div className="project-detail-loading" aria-label="Loading project">
      <div className="skeleton"/><div className="skeleton"/><div className="skeleton"/>
    </div>;
  }

  if (!project) {
    return <div className="project-detail-state"><Layers3 size={24}/><strong>Project unavailable</strong><p>{error || 'This project could not be found or is outside your access.'}</p></div>;
  }

  const isCompleted = project.status === 'Completed';
  const isAssigned = project.owner?._id === user?._id || project.assignedMembers.some((member) => member._id === user?._id);
  const canContribute = canApproveAgentWork(user?.role) || isAssigned;
  const canManageStructure = canApproveAgentWork(user?.role) || (isLead(user?.role) && isAssigned);
  const projectPeople = [
    ...(project.owner ? [{ _id: project.owner._id, name: project.owner.name, role: 'Project owner', photo: null }] : []),
    ...project.assignedMembers,
  ].filter((person, index, people) => people.findIndex((candidate) => candidate._id === person._id) === index);

  return <div className="animate-fade-in project-detail-page">
    <header className="project-hero-header">
      <div className="project-hero-main">
        <div className="project-hero-copy">
          <span className="project-hero-eyebrow">{project.department || 'General'} · {project.category || 'Delivery project'}</span>
          <div className="project-title-line">
            <h1>{project.name}</h1>
            <span className={`badge ${getStatusBadge(project.status)}`}>{project.status}</span>
            {isCompleted && <span className="project-read-only"><CheckCircle2 size={14}/>Read-only</span>}
          </div>
          <p>{project.description || 'Add a short objective so the team understands the expected result.'}</p>
        </div>
        {!isCompleted && canManageStructure && <button className="project-finish-action" onClick={() => setIsFinishOpen(true)}><CheckCircle2 size={14}/>Finish project</button>}
      </div>
      {!isCompleted && !canContribute && <div className="project-readonly-notice"><Lock size={14}/>You have read-only access to this project.</div>}
    </header>

    <div className="project-command-strip">
      <section className="project-compact-team">
        <div><Users size={15}/><span><strong>Team</strong><small>{projectPeople.length} people</small></span></div>
        <div className="project-avatar-stack">
          {projectPeople.slice(0, 6).map((person) => <span title={`${person.name} · ${person.role || 'Team member'}`} key={person._id}>
            {person.photo ? <img src={person.photo} alt=""/> : person.name.charAt(0).toUpperCase()}
          </span>)}
          {projectPeople.length > 6 && <b>+{projectPeople.length - 6}</b>}
        </div>
      </section>
      <section className="project-compact-progress" aria-label="Calculated project progress">
        <span><TrendingUp size={14}/><strong>{project.progress}%</strong><small>task completion</small></span>
        <span><Calendar size={14}/><strong>{formatTargetDate(project.estimatedCompletionDate || project.deadline)}</strong><small>target</small></span>
      </section>
      <button className="project-ai-structure" onClick={() => changeWorkspace('assistant')}>
        <Bot size={16}/><span><strong>Plan with AI</strong><small>Milestones <ChevronRight size={10}/> modules <ChevronRight size={10}/> tasks</small></span><ChevronRight size={14}/>
      </button>
    </div>

    <nav className="project-workspace-tabs" aria-label="Project workspace">
      <button className={workspace === 'delivery' ? 'active' : ''} onClick={() => changeWorkspace('delivery')}><Columns3 size={15}/>Delivery</button>
      <button className={workspace === 'documents' ? 'active' : ''} onClick={() => changeWorkspace('documents')}><FileCheck2 size={15}/>Documents</button>
      <button className={workspace === 'assistant' ? 'active' : ''} onClick={() => changeWorkspace('assistant')}><Bot size={15}/>AI plan</button>
    </nav>

    {workspace === 'delivery' ? <>
      <div className="project-delivery-toolbar">
        <div><strong>Delivery workspace</strong><small>Switch between the structured plan and an execution board. The work log remains visible.</small></div>
        <div className="project-delivery-view" role="group" aria-label="Delivery view">
          <button className={deliveryView === 'outline' ? 'active' : ''} onClick={() => setDeliveryView('outline')}><ListTree size={14}/>Structure</button>
          <button className={deliveryView === 'board' ? 'active' : ''} onClick={() => setDeliveryView('board')}><Columns3 size={14}/>Kanban</button>
        </div>
      </div>
      <div className="project-execution-layout">
        <main>
          {deliveryView === 'outline'
            ? <ProjectMilestonePanel projectId={project._id} canManage={canManageStructure} compact members={project.assignedMembers} currentUserId={user?._id} refreshSignal={executionVersion} onTasksChanged={refreshExecution}/>
            : <ProjectTaskList projectId={project._id} members={project.assignedMembers} canManage={canManageStructure} currentUserId={user?._id} refreshSignal={executionVersion} onTasksChanged={refreshExecution}/>
          }
        </main>
        <ProjectActivityRail project={project} updates={updates} canComment={Boolean(canContribute && !isCompleted)} onRefresh={refreshExecution}/>
      </div>
    </> : <>
      <AgentWorkflowPanel projectId={project._id} view={workspace === 'documents' ? 'documents' : 'plan'}/>
      {workspace === 'documents' && isCompleted && <CaseStudyPanel projectId={project._id} canManage={canApproveAgentWork(user?.role)} canApprove={isSuperAdmin(user?.role)}/>}
    </>}

    {isFinishOpen && <FinishProjectModal
      project={project}
      onClose={() => setIsFinishOpen(false)}
      onSuccess={() => { setIsFinishOpen(false); navigate('/completed'); }}
    />}
  </div>;
};

export default ProjectDetails;
