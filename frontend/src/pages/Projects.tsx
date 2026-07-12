import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, FolderKanban, Calendar, Users, Pencil, Archive, ArchiveRestore, Trash2, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import CreateProjectModal from '../components/CreateProjectModal';
import EditProjectModal from '../components/EditProjectModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../context/AuthContext';
import { isSuperAdmin } from '../utils/roles';
import { projectApi } from '../api/projectApi';
import { getErrorMessage } from '../utils/errorMessage';
import type { Project } from '../types';

const Projects = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canManage = isSuperAdmin(user?.role);
  const [showArchived, setShowArchived] = useState(false);
  const { projects: allProjects, loading, refetch } = useProjects(showArchived);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const categoryFilter = searchParams.get('category') || 'All';
  const [sortBy, setSortBy] = useState('recent');

  const projects = allProjects.filter((p) => p.status !== 'Completed' && (showArchived || !p.archived));

  const statuses = Array.from(new Set(projects.map((project) => project.status)));
  const categories = Array.from(new Set(projects.map((project) => project.category || project.department || 'General')));
  const filtered = projects
    .filter((project) => {
      const query = search.trim().toLowerCase();
      const matchesSearch = !query || [project.name, project.description, project.category, project.department]
        .some((value) => value?.toLowerCase().includes(query));
      const projectCategory = project.category || project.department || 'General';
      return matchesSearch && (statusFilter === 'All' || project.status === statusFilter) && (categoryFilter === 'All' || projectCategory === categoryFilter);
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

  const formatDeadline = (project: Project) => {
    const value = project.estimatedCompletionDate || project.deadline;
    if (!value) return null;
    const date = new Date(value);
    const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
    return {
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      urgent: days >= 0 && days <= 7,
      overdue: days < 0,
    };
  };

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

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', padding: '0.625rem 0.875rem', fontSize: '0.8125rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Compact portfolio controls: search, filter and sort without changing navigation. */}
      <div className="project-toolbar">
        <label className="project-search">
          <Search size={16} />
          <input type="search" placeholder="Search name, category or department" value={search} onChange={e => setSearch(e.target.value)} />
        </label>
        <label className="project-select"><FolderKanban size={14} /><span>Domain</span>
          <select value={categoryFilter} onChange={(e) => setSearchParams(e.target.value === 'All' ? {} : { category: e.target.value })}>
            <option value="All">All domains</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label className="project-select"><SlidersHorizontal size={14} /><span>Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All ({projects.length})</option>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
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

      {categories.length > 1 && <div className="project-domain-strip" aria-label="Project domains">
        <button className={categoryFilter === 'All' ? 'active' : ''} onClick={() => setSearchParams({})}><span>All work</span><strong>{projects.length}</strong></button>
        {categories.map((category) => {
          const count = projects.filter((project) => (project.category || project.department || 'General') === category).length;
          return <button key={category} className={categoryFilter === category ? 'active' : ''} onClick={() => setSearchParams({ category })}><span>{category}</span><strong>{count}</strong></button>;
        })}
      </div>}

      {/* Projects Grid */}
      {loading ? (
        <div className="project-grid">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="skeleton" style={{ height: '220px', borderRadius: '16px' }}></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <div className="empty-state-icon"><FolderKanban size={28} /></div>
            <div className="empty-state-title">{search ? 'No results found' : 'No Active Projects'}</div>
            <div className="empty-state-desc">
              {search ? 'Try a different search term.' : 'Create your first project to get started.'}
            </div>
            {!search && canManage && (
              <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                <Plus size={15} /> Create Project
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="project-grid">
          {filtered.map((project) => (
            <div key={project._id} style={{ position: 'relative' }}>
              <Link
                to={`/projects/${project._id}`}
                className={`project-card ${canManage ? 'project-card--managed' : ''}`}
                style={{ opacity: project.archived ? 0.6 : 1 }}
              >
                <div className="project-priority-stripe" style={{ background: getPriorityColor(project.priority) }} />

                <div className="project-card-header">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="project-card-title">{project.name}</div>
                    <div className="project-card-context">{project.category || project.department || project.priority}</div>
                  </div>
                  <span className={`badge ${getStatusBadge(project.status)}`}>{project.status}</span>
                  {project.archived && <span className="badge badge-neutral">Archived</span>}
                </div>

                <p className="project-card-desc">{project.description || 'No description provided.'}</p>

                {/* Progress */}
                <div className="project-progress">
                  <div className="project-progress-label">
                    <span>Progress</span><strong>{project.progress}%</strong>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${project.progress}%` }}></div>
                  </div>
                </div>

                {/* Meta */}
                <div className="project-card-meta">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <Users size={13} />
                    <span>{project.assignedMembers?.length ?? 0} members</span>
                  </div>
                  {formatDeadline(project) && (
                    <div className={`project-deadline ${formatDeadline(project)?.urgent ? 'is-urgent' : ''} ${formatDeadline(project)?.overdue ? 'is-overdue' : ''}`}>
                      <Calendar size={13} />
                      <span>{formatDeadline(project)?.overdue ? 'Overdue · ' : ''}{formatDeadline(project)?.label}</span>
                    </div>
                  )}
                </div>
              </Link>

              {canManage && (
                <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', display: 'flex', gap: '0.25rem', zIndex: 2 }}>
                  <button
                    className="icon-btn"
                    title="Edit"
                    style={{ background: 'var(--surface-1)' }}
                    onClick={(e) => { e.preventDefault(); setEditTarget(project); }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="icon-btn"
                    title={project.archived ? 'Restore' : 'Archive'}
                    style={{ background: 'var(--surface-1)' }}
                    onClick={(e) => { e.preventDefault(); handleArchiveToggle(project); }}
                  >
                    {project.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                  </button>
                  <button
                    className="icon-btn"
                    title="Delete"
                    style={{ background: 'var(--surface-1)', color: 'var(--danger)' }}
                    onClick={(e) => { e.preventDefault(); setDeleteTarget(project); }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <CreateProjectModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={refetch}
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
