import { useState } from 'react';
import { Search, Plus, Users, Pencil, UserX, Phone } from 'lucide-react';
import CreateTeamMemberModal from '../components/CreateTeamMemberModal';
import { useTeam } from '../hooks/useTeam';
import { userApi } from '../api/userApi';
import type { User } from '../types';

const getRoleColor = (role: string) => {
  const map: Record<string, string> = {
    'Project Manager': 'badge-danger',
    'Software Developer': 'badge-primary',
    'UI/UX Designer': 'badge-purple',
    'Backend Developer': 'badge-info',
    'Frontend Developer': 'badge-primary',
    'QA Tester': 'badge-warning',
    Operations: 'badge-neutral',
    Marketing: 'badge-success',
  };
  return map[role] ?? 'badge-neutral';
};

const AVATAR_COLORS = [
  'linear-gradient(135deg,#3b82f6,#6366f1)',
  'linear-gradient(135deg,#8b5cf6,#ec4899)',
  'linear-gradient(135deg,#06b6d4,#3b82f6)',
  'linear-gradient(135deg,#10b981,#06b6d4)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
];

const Team = () => {
  const { members, loading, refetch } = useTeam();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<User | null>(null);

  const filtered = members.filter(m =>
    m.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.email?.toLowerCase().includes(search.toLowerCase()) ||
    m.role?.toLowerCase().includes(search.toLowerCase()) ||
    m.phone?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDeactivate = async (member: User) => {
    const confirmed = window.confirm(`Deactivate ${member.name}?`);
    if (!confirmed) return;

    try {
      await userApi.deactivate(member._id);
      refetch();
    } catch (error) {
      console.error('Failed to deactivate member', error);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Team Members</h1>
          <p className="page-subtitle">{members.length} member{members.length !== 1 ? 's' : ''} in your organization</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={15} /> Add Member
        </button>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.625rem 1rem', marginBottom: '1.75rem' }}>
        <Search size={16} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ background: 'none', border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '0.875rem', color: 'var(--text-primary)', width: '100%' }}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-3 gap-5">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="skeleton" style={{ height: '160px', borderRadius: '16px' }}></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <div className="empty-state-icon"><Users size={28} /></div>
            <div className="empty-state-title">{search ? 'No results' : 'No Team Members'}</div>
            <div className="empty-state-desc">{search ? 'Try a different search term.' : 'Add your first team member.'}</div>
            {!search && (
              <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                <Plus size={15} /> Add Member
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {filtered.map((member, idx) => (
            <div key={member._id} style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              transition: 'all 0.2s',
              cursor: 'default',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-normal)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
              (e.currentTarget as HTMLElement).style.transform = 'none';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="avatar avatar-lg" style={{ background: AVATAR_COLORS[idx % AVATAR_COLORS.length], width: '48px', height: '48px', fontSize: '1.125rem' }}>
                  {member.name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.name}</div>
                    <span className={`badge ${member.status === 'Inactive' ? 'badge-danger' : 'badge-success'}`}>{member.status ?? 'Active'}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.email}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span className={`badge ${getRoleColor(member.role)}`}>{member.role ?? 'Team Member'}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{member.department || 'General'}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.9rem' }}>
                {member.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <Phone size={12} />
                    <span>{member.phone}</span>
                  </div>
                )}
              </div>

              {member.skills?.length > 0 && (
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                  {member.skills.slice(0, 3).map((skill, i) => (
                    <span key={i} style={{ fontSize: '0.7rem', fontWeight: 500, background: 'rgba(59,130,246,0.08)', color: 'var(--accent-blue)', borderRadius: 'var(--radius-full)', padding: '0.2rem 0.5rem' }}>
                      {skill}
                    </span>
                  ))}
                  {member.skills.length > 3 && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>+{member.skills.length - 3}</span>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.625rem', marginTop: '1rem' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setEditingMember(member); setIsModalOpen(true); }}>
                  <Pencil size={14} /> Edit
                </button>
                {member.status !== 'Inactive' && (
                  <button className="btn btn-ghost" style={{ flex: 1, color: 'var(--danger)' }} onClick={() => handleDeactivate(member)}>
                    <UserX size={14} /> Deactivate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <CreateTeamMemberModal
          onClose={() => { setIsModalOpen(false); setEditingMember(null); }}
          onSuccess={refetch}
          member={editingMember}
        />
      )}
    </div>
  );
};

export default Team;
