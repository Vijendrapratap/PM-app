import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, FolderKanban, Calendar, Users } from 'lucide-react';
import CreateProjectModal from '../components/CreateProjectModal';
import api from '../api';

const Projects = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchProjects(); }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/projects');
      const active = data.filter((p: any) => p.status !== 'Completed');
      setProjects(active);
    } catch (error) {
      console.error('Failed to fetch projects', error);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Active Projects</h1>
          <p className="page-subtitle">{projects.length} project{projects.length !== 1 ? 's' : ''} in progress</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />
          New Project
        </button>
      </div>

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
            {!search && (
              <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                <Plus size={15} /> Create Project
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {filtered.map((project: any) => (
            <Link to={`/projects/${project._id}`} key={project._id} className="project-card">
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
                    <span>{new Date(project.estimatedCompletionDate || project.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {isModalOpen && (
        <CreateProjectModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchProjects}
        />
      )}
    </div>
  );
};

export default Projects;
