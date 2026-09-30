import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, FolderKanban, Calendar, Users, Pencil, Archive, ArchiveRestore, Trash2, SlidersHorizontal, ArrowUpDown, MoreHorizontal, Flag } from 'lucide-react';
import CreateProjectModal from '../components/CreateProjectModal';
import EditProjectModal from '../components/EditProjectModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../context/AuthContext';
import { canApproveAgentWork } from '../utils/roles';
import { projectApi } from '../api/projectApi';
import { verticalApi, type Vertical } from '../api/verticalApi';
import { getErrorMessage } from '../utils/errorMessage';
import type { Project } from '../types';
import { projectProgressLabel, projectProgressTone } from '../utils/projectProgress';

const getProjectDeadline = (project: Project) => {
  const value = project.estimatedCompletionDate || project.deadline;
  if (!value) return null;

  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(date);
  dueDate.setHours(0, 0, 0, 0);
  const days = Math.round((dueDate.getTime() - today.getTime()) / 86400000);

  return {
    label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined }),
    relativeLabel: days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `In ${days} days`,
    days,
    urgent: days >= 0 && days <= 7,
    overdue: days < 0,
  };
};

const Projects = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const canManage = canApproveAgentWork(user?.role);
  const [showArchived, setShowArchived] = useState(false);
  const { projects: allProjects, loading, error: loadError, refetch, addProject } = useProjects(showArchived);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [deadlineFilter, setDeadlineFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [verticals, setVerticals] = useState<Vertical[]>([]);
  useEffect(() => { verticalApi.list().then(setVerticals).catch(() => setVerticals([])); }, []);
  const verticalFilter = searchParams.get('vertical') || 'All';
  const [sortBy, setSortBy] = useState('recent');

  const projects = allProjects.filter((p) => p.status !== 'Completed' && (showArchived || !p.archived));

  const statuses = Array.from(new Set(projects.map((project) => project.status)));
  const filtered = projects
    .filter((project) => {
      const query = search.trim().toLowerCase();
      const matchesSearch = !query || [project.name, project.description, project.category, project.department]
        .some((value) => value?.toLowerCase().includes(query));
      const deadline = getProjectDeadline(project);
      const matchesDeadline = deadlineFilter === 'All'
        || (deadlineFilter === 'overdue' && Boolean(deadline?.overdue))
        || (deadlineFilter === 'week' && Boolean(deadline && deadline.days >= 0 && deadline.days <= 7))
        || (deadlineFilter === 'month' && Boolean(deadline && deadline.days >= 0 && deadline.days <= 30))
        || (deadlineFilter === 'none' && !deadline);

      return matchesSearch
        && (statusFilter === 'All' || project.status === statusFilter)
        && (priorityFilter === 'All' || project.priority === priorityFilter)
        && matchesDeadline
        && (verticalFilter === 'All' || (verticalFilter === 'NONE' ? !project.vertical : project.vertical?._id === verticalFilter));
    })
    .sort((a, b) => {
      if (sortBy === 'deadline') {
        const aDate = new Date(a.estimatedCompletionDate || a.deadline || '9999-12-31').getTime();
        const bDate = new Date(b.estimatedCompletionDate || b.deadline || '9999-12-31').getTime();
        return aDate - bDate;
      }
      if (sortBy === 'progress') return b.progress - a.progress;
      if (sortBy === 'priority') {
        const rank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
        return rank[b.priority] - rank[a.priority];
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      'In Progress': 'badge-primary',
      'Draft': 'badge-neutral',
      'Review': 'badge-warning',
      'Testing': 'badge-purple',
      'Planning': 'badge-info',
      'On Hold': 'badge-danger',
    };
    return map[status] ?? 'badge-neutral';
  };

  const getPriorityColor = (priority: string) => {
    const map: Record<string, string> = {
      Low: 'var(--success)',
      Medium: 'var(--warning)',
      High: 'var(--priority-high)',
      Critical: 'var(--danger)',
    };
    return map[priority] ?? 'var(--text-muted)';
  };

  const handleArchiveToggle = async (project: Project) => {
    setError('');
    try {
      if (project.archived) {
        await projectApi.restore(project._id);
      } else {
        await projectApi.archive(project._id);
      }
      refetch();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update project.'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await projectApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete project.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleProjectCreated = (project: Project) => {
    addProject(project);
    setSearch('');
    setStatusFilter('All');
    setDeadlineFilter('All');
    setPriorityFilter('All');
    setSortBy('recent');
    setShowArchived(false);
    setSearchParams({});
    navigate(`/projects/${project._id}`);
  };

  const hasActiveFilters = Boolean(search.trim()) || statusFilter !== 'All' || priorityFilter !== 'All' || deadlineFilter !== 'All' || verticalFilter !== 'All';
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('All');
    setPriorityFilter('All');
    setDeadlineFilter('All');
    setSearchParams({});
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Active Projects</h1>
          <p className="page-subtitle">{projects.length} project{projects.length !== 1 ? 's' : ''} {showArchived ? '(including archived)' : 'in progress'}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem' }}>
          {canManage && (
            <button className={`btn ${showArchived ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowArchived((v) => !v)}>
              <Archive size={15} /> {showArchived ? 'Hide Archived' : 'Show Archived'}
            </button>
          )}
          {canManage && (
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={16} />
              New Project
            </button>
          )}
        </div>
      </div>

      {(error || loadError) && (
        <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', padding: '0.625rem 0.875rem', fontSize: '0.8125rem', marginBottom: '1rem' }}>
          {error || loadError}
        </div>
      )}

      {/* Compact toolbar: search, filter and sort without changing navigation. */}
      <div className="project-toolbar">
        <label className="project-search">
          <Search size={16} />
          <input type="search" placeholder="Search name, category or department" value={search} onChange={e => setSearch(e.target.value)} />
        </label>
        <label className="project-select"><FolderKanban size={14} /><span>Vertical</span>
          <select value={verticalFilter} onChange={(e) => setSearchParams(e.target.value === 'All' ? {} : { vertical: e.target.value })}>
            <option value="All">All verticals</option>
            {verticals.map((vertical) => <option key={vertical._id} value={vertical._id}>{vertical.name}</option>)}
            <option value="NONE">No vertical</option>
          </select>
        </label>
        <label className="project-select"><SlidersHorizontal size={14} /><span>Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All ({projects.length})</option>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <label className="project-select project-select--priority"><Flag size={14} /><span>Priority</span>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="All">All priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </label>
        <label className="project-select project-select--deadline"><Calendar size={14} /><span>Deadline</span>
          <select value={deadlineFilter} onChange={(e) => setDeadlineFilter(e.target.value)}>
            <option value="All">Any deadline</option>
            <option value="overdue">Overdue</option>
            <option value="week">Due in 7 days</option>
            <option value="month">Due in 30 days</option>
            <option value="none">No deadline</option>
          </select>
        </label>
        <label className="project-select"><ArrowUpDown size={14} /><span>Sort</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="recent">Recently updated</option>
            <option value="deadline">Due date</option>
            <option value="priority">Priority</option>
            <option value="progress">Progress</option>
          </select>
        </label>
      </div>

      <div className="project-domain-strip" aria-label="Project verticals">
        <button className={verticalFilter === 'All' ? 'active' : ''} onClick={() => setSearchParams({})}><span>All work</span><strong>{projects.length}</strong></button>
        {verticals.map((vertical) => {
          const count = projects.filter((project) => project.vertical?._id === vertical._id).length;
          return <button key={vertical._id} className={verticalFilter === vertical._id ? 'active' : ''} onClick={() => setSearchParams({ vertical: vertical._id })}><span>{vertical.name}</span><strong>{count}</strong></button>;
        })}
      </div>

      {/* Horizontal project list */}
      {loading ? (
        <div className="project-list project-list--loading">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="skeleton project-row-skeleton"></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <div className="empty-state-icon"><FolderKanban size={28} /></div>
            <div className="empty-state-title">{hasActiveFilters ? 'No projects match these filters' : 'No Active Projects'}</div>
            <div className="empty-state-desc">
              {hasActiveFilters ? 'Adjust the deadline, priority, status, or vertical filters.' : 'Create your first project to get started.'}
            </div>
            {hasActiveFilters ? (
              <button className="btn btn-secondary" onClick={clearFilters}>Clear filters</button>
            ) : canManage && (
              <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                <Plus size={15} /> Create Project
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="project-list">
          <div className="project-list-head" aria-hidden="true">
            <span>Project</span>
            <span>Status &amp; priority</span>
            <span>Progress</span>
            <span>Team</span>
            <span>Deadline</span>
          </div>
          {filtered.map((project) => {
            const progressTone = projectProgressTone(project);
            const deadline = getProjectDeadline(project);
            return (
            <div key={project._id} className={`project-row-shell project-card-shell progress-${progressTone}`}>
              <Link
                to={`/projects/${project._id}`}
                className={`project-row ${canManage ? 'project-row--managed' : ''}`}
                style={{ opacity: project.archived ? 0.6 : 1 }}
              >
                <div className="project-priority-stripe" style={{ background: getPriorityColor(project.priority) }} />

                <div className="project-row-identity">
                  <div className="project-card-title">{project.name}</div>
                  <div className="project-card-context">{project.vertical?.name || 'No vertical'}{project.category ? ` · ${project.category}` : ''}</div>
                  <p className="project-card-desc">{project.description || 'No description provided.'}</p>
                </div>

                <div className="project-row-state">
                  <span className={`badge ${getStatusBadge(project.status)}`}>{project.status}</span>
                  <span className={`project-priority-badge priority-${project.priority.toLowerCase()}`}><Flag size={11} />{project.priority}</span>
                  {project.archived && <span className="badge badge-neutral">Archived</span>}
                </div>

                <div className="project-row-progress">
                  <div className="project-progress-label">
                    <span>{projectProgressLabel(project)}</span><strong>{project.progress}%</strong>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${project.progress}%` }}></div>
                  </div>
                </div>

                <div className="project-row-team">
                  <Users size={15} />
                  <span><strong>{project.assignedMembers?.length ?? 0}</strong> members</span>
                  {project.owner?.name && <small>{project.owner.name}</small>}
                </div>

                <div className={`project-row-deadline ${deadline?.urgent ? 'is-urgent' : ''} ${deadline?.overdue ? 'is-overdue' : ''} ${!deadline ? 'is-empty' : ''}`}>
                  <Calendar size={15} />
                  <span>
                    <strong>{deadline?.label || 'Not scheduled'}</strong>
                    <small>{deadline?.relativeLabel || 'No deadline set'}</small>
                  </span>
                </div>
              </Link>

              {canManage && (
                <details className="project-actions">
                  <summary title="Project actions"><MoreHorizontal size={17}/></summary>
                  <div className="project-actions-menu">
                    <button onClick={() => setEditTarget(project)}><Pencil size={13}/><span>Edit project</span></button>
                    <button onClick={() => handleArchiveToggle(project)}>{project.archived ? <ArchiveRestore size={13}/> : <Archive size={13}/>}<span>{project.archived ? 'Restore' : 'Archive'}</span></button>
                    <button className="danger" onClick={() => setDeleteTarget(project)}><Trash2 size={13}/><span>Delete</span></button>
                  </div>
                </details>
              )}
            </div>
          );})}
        </div>
      )}

      {isModalOpen && (
        <CreateProjectModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleProjectCreated}
        />
      )}

      {editTarget && (
        <EditProjectModal project={editTarget} onClose={() => setEditTarget(null)} onSuccess={refetch} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Project"
          message={`Delete "${deleteTarget.name}" permanently? This removes all its updates, daily reports, tasks, and documents. Consider archiving instead if you might need it later.`}
          confirmLabel="Delete"
          danger
          loading={actionLoading}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default Projects;
