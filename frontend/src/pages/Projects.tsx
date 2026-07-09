import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, FolderKanban, Calendar, Users, Pencil, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
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
  const canManage = isSuperAdmin(user?.role);
  const [showArchived, setShowArchived] = useState(false);
  const { projects: allProjects, loading, refetch } = useProjects(showArchived);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const projects = allProjects.filter((p) => p.status !== 'Completed' && (showArchived || !p.archived));

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

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

      {/* Search */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        background: 'var(--surface-1)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '0.625rem 1rem',
        marginBottom: '1.75rem',
      }}>
        <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'none',
            border: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            fontSize: '0.875rem',
            color: 'var(--text-primary)',
            width: '100%',
          }}
        />
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="grid grid-cols-3 gap-5">
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
        <div className="grid grid-cols-3 gap-5">
          {filtered.map((project) => (
            <div key={project._id} style={{ position: 'relative' }}>
              <Link to={`/projects/${project._id}`} className="project-card" style={{ opacity: project.archived ? 0.6 : 1 }}>
                {/* Priority stripe */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: getPriorityColor(project.priority),
                  borderRadius: '16px 16px 0 0',
                }} />

                <div className="project-card-header" style={{ marginTop: '0.5rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="project-card-title">{project.name}</div>
                  </div>
                  <span className={`badge ${getStatusBadge(project.status)}`}>{project.status}</span>
                  {project.archived && <span className="badge badge-neutral">Archived</span>}
                </div>

                <p className="project-card-desc">{project.description || 'No description provided.'}</p>

                {/* Progress */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Progress</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{project.progress}%</span>
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
                  {(project.estimatedCompletionDate || project.deadline) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <Calendar size={13} />
                      <span>{new Date(project.estimatedCompletionDate || project.deadline || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
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
