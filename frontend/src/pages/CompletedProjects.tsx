import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Calendar, Search, Clock, Users } from 'lucide-react';
import api from '../api';

const CompletedProjects = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchCompleted = async () => {
      try {
        const { data } = await api.get('/projects');
        const completed = data.filter((p: any) => p.status === 'Completed');
        setProjects(completed);
      } catch (error) {
        console.error('Failed to fetch completed projects', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCompleted();
  }, []);

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Completed Projects</h1>
          <p className="page-subtitle">Archive of all delivered projects. Read-only.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.875rem', minWidth: '240px' }}>
          <Search size={15} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search completed..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'none', border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '0.8125rem', color: 'var(--text-primary)', width: '100%' }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: '80px', borderRadius: '12px' }}></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <CheckCircle2 size={28} />
            </div>
            <div className="empty-state-title">
              {search ? 'No results found' : 'No Completed Projects Yet'}
            </div>
            <div className="empty-state-desc">
              {search
                ? 'Try a different search term.'
                : 'Complete a project to see it here.'}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map((project: any) => (
            <Link
              to={`/projects/${project._id}`}
              key={project._id}
              style={{
                display: 'block',
                background: 'var(--surface-1)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem 1.5rem',
                textDecoration: 'none',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(16,185,129,0.3)';
                (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
                (e.currentTarget as HTMLElement).style.background = 'var(--surface-1)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {/* Icon */}
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(16,185,129,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{project.name}</span>
                    <span className="badge badge-success">Completed</span>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {project.description || 'No description.'}
                  </p>
                </div>

                {/* Meta */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexShrink: 0 }}>
                  {project.assignedMembers?.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      <Users size={14} />
                      <span>{project.assignedMembers.length}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    <Calendar size={14} />
                    <span>
                      {project.completionDate
                        ? new Date(project.completionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    <Clock size={14} />
                    <span>
                      {project.createdAt
                        ? (() => {
                            const start = new Date(project.createdAt);
                            const end = project.completionDate ? new Date(project.completionDate) : new Date();
                            const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                            return `${days} days`;
                          })()
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default CompletedProjects;
