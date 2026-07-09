import { useCallback, useEffect, useState } from 'react';
import { Lightbulb, Plus, Trash2 } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { ideaApi, type Idea } from '../api/ideaApi';
import { getErrorMessage } from '../utils/errorMessage';
import { useAuth } from '../context/AuthContext';
import { isSuperAdmin } from '../utils/roles';

const Ideas = () => {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Idea | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setIdeas(await ideaApi.list());
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load ideas.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await ideaApi.create(form);
      setForm({ title: '', description: '' });
      refetch();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to submit idea.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await ideaApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete idea.'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Ideas</h1>
        <p className="page-subtitle">A shared space for the whole team to pitch ideas.</p>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', padding: '0.625rem 0.875rem', fontSize: '0.8125rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div className="section-card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-card-header">
          <div className="section-card-title">
            <Plus size={16} style={{ color: 'var(--accent-cyan)' }} />
            Share an Idea
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input type="text" className="form-input" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Description *</label>
            <textarea className="form-textarea" rows={3} required value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end' }} disabled={submitting}>
            {submitting ? 'Posting...' : 'Post Idea'}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: '80px', borderRadius: '16px' }}></div>)}
        </div>
      ) : ideas.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <div className="empty-state-icon"><Lightbulb size={28} /></div>
            <div className="empty-state-title">No Ideas Yet</div>
            <div className="empty-state-desc">Be the first to share one.</div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {ideas.map((idea) => (
            <div key={idea._id} className="section-card" style={{ padding: '1.125rem 1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: '0.375rem' }}>{idea.title}</div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.5rem' }}>{idea.description}</p>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {idea.createdBy?.name ?? 'Unknown'} · {new Date(idea.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {isSuperAdmin(user?.role) && (
                  <button className="icon-btn" style={{ color: 'var(--danger)', flexShrink: 0 }} onClick={() => setDeleteTarget(idea)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Idea"
          message={`Delete "${deleteTarget.title}"?`}
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

export default Ideas;
