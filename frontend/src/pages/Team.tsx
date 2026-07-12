import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Plus, Users, Pencil, UserX, UserCheck, Trash2, KeyRound, ChevronLeft, ChevronRight, FolderKanban, ArrowUpDown } from 'lucide-react';
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

  const toggleSort = (key: SortKey) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  };

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: SortKey }) => (
    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort(sortKey)}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
        {label}
        <ArrowUpDown size={11} style={{ opacity: sort.key === sortKey ? 1 : 0.35 }} />
      </span>
    </th>
  );

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
      </div>

      {/* Table */}
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
        <div className="section-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <SortHeader label="Name" sortKey="name" />
                <th>Email</th>
                <SortHeader label="Role" sortKey="role" />
                <th>Assigned Projects</th>
                <SortHeader label="Status" sortKey="status" />
                <SortHeader label="Created" sortKey="createdAt" />
                <SortHeader label="Last Login" sortKey="lastLoginAt" />
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {paginated.map((member) => (
                <tr key={member._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div className="avatar" style={{ width: '30px', height: '30px', fontSize: '0.75rem' }}>
                        {member.photo ? (
                          <img src={member.photo} alt={member.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          member.name?.charAt(0)?.toUpperCase() ?? '?'
                        )}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{member.name}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{member.email}</td>
                  <td><span className={`badge ${getRoleColor(member.role)}`}>{member.role ?? 'Team Member'}</span></td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    {member.assignedProjects?.length
                      ? member.assignedProjects.map((p) => p.name).join(', ')
                      : <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}
                  </td>
                  <td><span className={`badge ${member.status === 'Inactive' ? 'badge-danger' : 'badge-success'}`}>{member.status ?? 'Active'}</span></td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{formatDate(member.createdAt)}</td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{formatDate(member.lastLoginAt)}</td>
                  {canManage && (
                    <td>
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button className="icon-btn" title="Edit" onClick={() => { setEditingMember(member); setIsModalOpen(true); }}>
                          <Pencil size={14} />
                        </button>
                        <button className="icon-btn" title="Manage Projects" onClick={() => setProjectsTarget(member)}>
                          <FolderKanban size={14} />
                        </button>
                        <button className="icon-btn" title="Reset Password" onClick={() => setResetTarget(member)}>
                          <KeyRound size={14} />
                        </button>
                        <button className="icon-btn" title={member.status === 'Inactive' ? 'Activate' : 'Deactivate'} onClick={() => handleToggleStatus(member)}>
                          {member.status === 'Inactive' ? <UserCheck size={14} /> : <UserX size={14} />}
                        </button>
                        <button className="icon-btn" title="Delete" style={{ color: 'var(--danger)' }} onClick={() => setDeleteTarget(member)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
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
