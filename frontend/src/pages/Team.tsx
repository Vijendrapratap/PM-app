import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Plus, Users, Pencil, UserX, UserCheck, Trash2, KeyRound, ChevronLeft, ChevronRight, FolderKanban, MoreHorizontal, Mail } from 'lucide-react';
import CreateTeamMemberModal from '../components/CreateTeamMemberModal';
import ConfirmDialog from '../components/ConfirmDialog';
import ResetPasswordModal from '../components/ResetPasswordModal';
import ManageMemberProjectsModal from '../components/ManageMemberProjectsModal';
import { useTeam } from '../hooks/useTeam';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../api/userApi';
import { getErrorMessage } from '../utils/errorMessage';
import { isSuperAdmin } from '../utils/roles';
import type { User } from '../types';

const PAGE_SIZE = 8;

const getRoleColor = (role: string) => {
  const map: Record<string, string> = {
    'Super Admin': 'badge-purple',
    'Project Manager': 'badge-danger',
    'Team Member': 'badge-primary',
  };
  return map[role] ?? 'badge-neutral';
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

type SortKey = 'name' | 'role' | 'status' | 'createdAt' | 'lastLoginAt';

const Team = () => {
  const { members, loading, refetch } = useTeam();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedMember = searchParams.get('member');
  const canManage = isSuperAdmin(user?.role);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<User | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [projectsTarget, setProjectsTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const roles = useMemo(() => Array.from(new Set(members.map((m) => m.role).filter(Boolean))).sort(), [members]);

  const filtered = useMemo(() => {
    const rows = members.filter((m) => {
      const matchesSearch =
        m.name?.toLowerCase().includes(search.toLowerCase()) ||
        m.email?.toLowerCase().includes(search.toLowerCase()) ||
        m.role?.toLowerCase().includes(search.toLowerCase()) ||
        m.phone?.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'All' || m.role === roleFilter;
      const matchesStatus = statusFilter === 'All' || (m.status ?? 'Active') === statusFilter;
      return matchesSearch && matchesRole && matchesStatus && (!selectedMember || m._id === selectedMember);
    });

    const sorted = [...rows].sort((a, b) => {
      const av = (a[sort.key] ?? '') as string;
      const bv = (b[sort.key] ?? '') as string;
      return av.localeCompare(bv) * sort.dir;
    });
    return sorted;
  }, [members, search, roleFilter, statusFilter, sort, selectedMember]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const resetPageAnd = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const handleToggleStatus = async (member: User) => {
    setActionError('');
    try {
      if (member.status === 'Inactive') {
        await userApi.activate(member._id);
      } else {
        await userApi.deactivate(member._id);
      }
      refetch();
    } catch (error) {
      setActionError(getErrorMessage(error, 'Failed to update status.'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    setActionError('');
    try {
      await userApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      refetch();
    } catch (error) {
      setActionError(getErrorMessage(error, 'Failed to delete team member.'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Team Members</h1>
          <p className="page-subtitle">{filtered.length} of {members.length} member{members.length !== 1 ? 's' : ''} in your organization</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={15} /> Add Member
          </button>
        )}
      </div>

      {actionError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', padding: '0.625rem 0.875rem', fontSize: '0.8125rem', marginBottom: '1rem' }}>
          {actionError}
        </div>
      )}

      {/* Search + Filters */}
      {selectedMember && <div className="team-focus-banner"><span>Showing one team member and their project assignments</span><button onClick={() => setSearchParams({})}>Show full team</button></div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem' }}>
        <div style={{ flex: '1 1 260px', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.625rem 1rem' }}>
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by name, email, role..."
            value={search}
            onChange={(e) => resetPageAnd(setSearch)(e.target.value)}
            style={{ background: 'none', border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '0.875rem', color: 'var(--text-primary)', width: '100%' }}
          />
        </div>
        <select className="form-select" style={{ maxWidth: '180px' }} value={roleFilter} onChange={(e) => resetPageAnd(setRoleFilter)(e.target.value)}>
          <option value="All">All Roles</option>
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="form-select" style={{ maxWidth: '160px' }} value={statusFilter} onChange={(e) => resetPageAnd(setStatusFilter)(e.target.value)}>
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        <select className="form-select" style={{ maxWidth: '180px' }} value={sort.key} onChange={(e) => setSort({ key: e.target.value as SortKey, dir: 1 })}>
          <option value="name">Sort by name</option><option value="role">Sort by role</option><option value="status">Sort by status</option><option value="lastLoginAt">Sort by recent login</option>
        </select>
      </div>

      {/* Compact member directory */}
      {loading ? (
        <div className="grid grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton" style={{ height: '160px', borderRadius: '16px' }}></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <div className="empty-state-icon"><Users size={28} /></div>
            <div className="empty-state-title">{search || roleFilter !== 'All' || statusFilter !== 'All' ? 'No results' : 'No Team Members'}</div>
            <div className="empty-state-desc">{search || roleFilter !== 'All' || statusFilter !== 'All' ? 'Try different search or filter criteria.' : 'Add your first team member.'}</div>
            {canManage && !search && roleFilter === 'All' && statusFilter === 'All' && (
              <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                <Plus size={15} /> Add Member
              </button>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="team-card-grid">
            {paginated.map((member) => <article className="team-card" key={member._id}>
              <header className="team-card-header">
                <div className="avatar team-card-avatar">{member.photo ? <img src={member.photo} alt=""/> : member.name?.charAt(0)?.toUpperCase() ?? '?'}</div>
                <div className="team-card-identity"><h2>{member.name}</h2><p><Mail size={11}/>{member.email}</p></div>
                {canManage && <details className="team-actions"><summary><MoreHorizontal size={17}/></summary><div>
                  <button onClick={() => { setEditingMember(member); setIsModalOpen(true); }}><Pencil size={13}/>Edit member</button>
                  <button onClick={() => setProjectsTarget(member)}><FolderKanban size={13}/>Manage projects</button>
                  <button onClick={() => setResetTarget(member)}><KeyRound size={13}/>Reset password</button>
                  <button onClick={() => handleToggleStatus(member)}>{member.status === 'Inactive' ? <UserCheck size={13}/> : <UserX size={13}/>}{member.status === 'Inactive' ? 'Activate' : 'Deactivate'}</button>
                  <button className="danger" onClick={() => setDeleteTarget(member)}><Trash2 size={13}/>Delete</button>
                </div></details>}
              </header>
              <div className="team-card-status"><span className={`badge ${getRoleColor(member.role)}`}>{member.role || 'Team Member'}</span><span className={`availability-dot availability-${(member.availability || 'Available').toLowerCase().replace(' ', '-')}`}>{member.availability || member.status || 'Available'}</span></div>
              <div className="team-card-work"><div><span>Assigned work</span><strong>{member.assignedProjects?.length || 0} project{member.assignedProjects?.length === 1 ? '' : 's'}</strong></div>
                <div className="team-project-chips">{member.assignedProjects?.length ? <>{member.assignedProjects.slice(0, 2).map((project) => <span key={project.id}>{project.name}</span>)}{member.assignedProjects.length > 2 && <span>+{member.assignedProjects.length - 2} more</span>}</> : <em>No projects assigned</em>}</div>
              </div>
              <footer><span>{member.department || 'General team'}</span><span>Last login {formatDate(member.lastLoginAt)}</span></footer>
            </article>)}
          </div>

          {totalPages > 1 && (
            <div className="team-pagination">
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Page {currentPage} of {totalPages}</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-secondary" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft size={14} /> Prev
                </button>
                <button className="btn btn-secondary" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <CreateTeamMemberModal
          onClose={() => { setIsModalOpen(false); setEditingMember(null); }}
          onSuccess={refetch}
          member={editingMember}
          canAssignSuperAdmin={canManage}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal member={resetTarget} onClose={() => setResetTarget(null)} onSuccess={refetch} />
      )}

      {projectsTarget && (
        <ManageMemberProjectsModal member={projectsTarget} onClose={() => setProjectsTarget(null)} onSuccess={refetch} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Team Member"
          message={`Delete ${deleteTarget.name}? Their historical tasks, updates, and reports will remain on record, but they'll be removed from the team and any project assignments.`}
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

export default Team;
