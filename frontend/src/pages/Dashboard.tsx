import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderKanban, CheckCircle2, Users, Layers,
  ArrowUpRight, TrendingUp, Clock, Zap
} from 'lucide-react';
import { projectApi } from '../api/projectApi';
import { userApi } from '../api/userApi';
import type { Project } from '../types';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalProjects: 0,
    completedProjects: 0,
    activeProjects: 0,
    totalMembers: 0,
    draftProjects: 0,
  });
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [projects, users] = await Promise.all([projectApi.list(), userApi.list()]);
        setStats({
          totalProjects: projects.length,
          completedProjects: projects.filter((p) => p.status === 'Completed').length,
          activeProjects: projects.filter((p) => p.status !== 'Completed' && p.status !== 'Draft').length,
          draftProjects: projects.filter((p) => p.status === 'Draft').length,
          totalMembers: users.length,
        });
        setRecentProjects(projects.slice(0, 5));
      } catch (error) {
        console.error('Failed to load stats', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      'Completed': 'badge-success',
      'Draft': 'badge-neutral',
      'In Progress': 'badge-primary',
      'Review': 'badge-warning',
      'Testing': 'badge-purple',
      'Planning': 'badge-info',
    };
    return map[status] ?? 'badge-neutral';
  };

  const statCards = [
    {
      label: 'Active Projects',
      value: stats.activeProjects,
      desc: 'Currently in progress',
      icon: FolderKanban,
      color: 'blue',
      to: '/projects',
    },
    {
      label: 'Completed',
      value: stats.completedProjects,
      desc: 'Successfully delivered',
      icon: CheckCircle2,
      color: 'green',
      to: '/completed',
    },
    {
      label: 'Team Members',
      value: stats.totalMembers,
      desc: 'Across all projects',
      icon: Users,
      color: 'purple',
      to: '/team',
    },
    {
      label: 'Total Projects',
      value: stats.totalProjects,
      desc: 'All time projects',
      icon: Layers,
      color: 'indigo',
      to: '/projects',
    },
  ];

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <div className="skeleton" style={{ height: '2rem', width: '200px', marginBottom: '0.5rem' }}></div>
          <div className="skeleton" style={{ height: '1rem', width: '300px' }}></div>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton" style={{ height: '140px', borderRadius: '16px' }}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
            <Zap size={20} style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-cyan)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Pratap AI Innovation</span>
          </div>
          <h1 className="page-title">Command Center</h1>
          <p className="page-subtitle">Track all projects and team activity in real time.</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Today</p>
          <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <Link to={card.to} key={card.label} className={`stat-card ${card.color}`}>
            <div className={`stat-icon ${card.color}`}>
              <card.icon size={22} />
            </div>
            <div className="stat-value">{card.value}</div>
            <div className="stat-label">{card.label}</div>
            <div className="stat-desc">{card.desc}</div>
            <ArrowUpRight className="stat-arrow" size={16} />
          </Link>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Recent Projects */}
        <div className="col-span-2 section-card">
          <div className="section-card-header">
            <div className="section-card-title">
              <TrendingUp size={16} style={{ color: 'var(--accent-blue)' }} />
              Recent Projects
            </div>
            <Link to="/projects" style={{ fontSize: '0.8125rem', color: 'var(--accent-blue)', fontWeight: 500 }}>
              View all →
            </Link>
          </div>
          <div style={{ padding: 0 }}>
            {recentProjects.length === 0 ? (
              <div className="empty-state" style={{ padding: '3rem 2rem' }}>
                <div className="empty-state-icon"><FolderKanban size={28} /></div>
                <div className="empty-state-title">No Projects Yet</div>
                <div className="empty-state-desc">Create your first project to get started.</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Members</th>
                  </tr>
                </thead>
                <tbody>
                  {recentProjects.map((project) => (
                    <tr key={project._id} onClick={() => window.location.href = `/projects/${project._id}`}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{project.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{project.category || 'General'}</div>
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadge(project.status)}`}>{project.status}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className="progress-bar" style={{ width: '80px' }}>
                            <div className="progress-fill" style={{ width: `${project.progress}%` }}></div>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '30px' }}>{project.progress}%</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '-4px' }}>
                          {(project.assignedMembers || []).slice(0, 3).map((m, i) => (
                            <div key={i} className="avatar" style={{ width: '26px', height: '26px', fontSize: '0.625rem', border: '2px solid var(--surface-1)', marginLeft: i > 0 ? '-8px' : 0 }}>
                              {m.name?.charAt(0) ?? '?'}
                            </div>
                          ))}
                          {project.assignedMembers?.length === 0 && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Unassigned</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Summary Panel */}
        <div className="flex flex-col gap-4">
          {/* Status Breakdown */}
          <div className="section-card">
            <div className="section-card-header">
              <div className="section-card-title">
                <Clock size={16} style={{ color: 'var(--accent-purple)' }} />
                Overview
              </div>
            </div>
            <div className="section-card-body">
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Active', count: stats.activeProjects, color: 'var(--accent-blue)' },
                  { label: 'Completed', count: stats.completedProjects, color: 'var(--success)' },
                  { label: 'Drafts', count: stats.draftProjects, color: 'var(--text-muted)' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }}></div>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{item.label}</span>
                    </div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.count}</span>
                  </div>
                ))}
                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.25rem 0' }}></div>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.totalProjects}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="section-card">
            <div className="section-card-header">
              <div className="section-card-title">
                <Zap size={16} style={{ color: 'var(--accent-cyan)' }} />
                Quick Links
              </div>
            </div>
            <div className="section-card-body" style={{ padding: '1rem' }}>
              <div className="flex flex-col gap-2">
                {[
                  { label: 'Active Projects', to: '/projects', icon: FolderKanban },
                  { label: 'Completed Projects', to: '/completed', icon: CheckCircle2 },
                  { label: 'Team Members', to: '/team', icon: Users },
                ].map(item => (
                  <Link
                    key={item.label}
                    to={item.to}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      padding: '0.625rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      transition: 'all 0.15s',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                    }}
                  >
                    <item.icon size={15} style={{ color: 'var(--accent-blue)' }} />
                    {item.label}
                    <ArrowUpRight size={13} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
