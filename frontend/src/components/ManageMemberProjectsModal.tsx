import { useEffect, useMemo, useState } from 'react';
import { X, FolderKanban, Search } from 'lucide-react';
import { projectApi } from '../api/projectApi';
import { getErrorMessage } from '../utils/errorMessage';
import type { Project, User } from '../types';

const ManageMemberProjectsModal = ({
  member,
  onClose,
  onSuccess,
}: {
  member: User;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [assignedIds, setAssignedIds] = useState<string[]>(member.assignedProjects.map((p) => p.id));

  useEffect(() => {
    projectApi
      .list()
      .then(setProjects)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load projects.')))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [projects, search]
  );

  const toggle = async (project: Project) => {
    const isAssigned = assignedIds.includes(project._id);
    setPendingId(project._id);
    setError('');
    try {
      if (isAssigned) {
        await projectApi.removeMember(project._id, member._id);
        setAssignedIds((ids) => ids.filter((id) => id !== project._id));
      } else {
        await projectApi.addMember(project._id, member._id);
        setAssignedIds((ids) => [...ids, project._id]);
      }
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update project assignment.'));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-sm">
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FolderKanban size={16} style={{ color: 'var(--accent-cyan)' }} /> Manage Projects
            </div>
            <div className="modal-subtitle">Assign or remove {member.name} from projects.</div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.875rem', marginBottom: '0.875rem' }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ background: 'none', border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '0.8125rem', color: 'var(--text-primary)', width: '100%' }}
            />
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>{error}</p>}

          <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            {loading ? (
              <div style={{ padding: '1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading projects...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No projects found.</div>
            ) : (
              filtered.map((project) => {
                const isAssigned = assignedIds.includes(project._id);
                return (
                  <label
                    key={project._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      padding: '0.75rem 1rem',
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: pendingId ? 'wait' : 'pointer',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{project.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{project.status}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      disabled={pendingId === project._id}
                      onChange={() => toggle(project)}
                    />
                  </label>
                );
              })
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

export default ManageMemberProjectsModal;
