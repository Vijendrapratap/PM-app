import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CircleDot, Lightbulb, Plus, Sparkles, Trash2 } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { ideaApi, type Idea } from '../api/ideaApi';
import { getErrorMessage } from '../utils/errorMessage';
import { useAuth } from '../context/AuthContext';
import { isSuperAdmin } from '../utils/roles';

const COLUMNS: Idea['status'][] = ['Inbox', 'Evaluating', 'Planned', 'Building', 'Parked'];
const COLUMN_COPY: Record<Idea['status'], string> = {
  Inbox: 'Captured, not yet triaged',
  Evaluating: 'Checking outcome and fit',
  Planned: 'Ready for a delivery slot',
  Building: 'Now an active initiative',
  Parked: 'Good idea, not now',
};
const DEMO_IDEAS: Idea[] = [
  { _id: 'demo-1', title: 'AI weekly project recap', description: 'Generate a concise leadership update from tasks, risks and project notes.', status: 'Planned', impact: 'High', effort: 'Medium', category: 'Internal systems', createdBy: { _id: 'demo-pm', name: 'Maya Pratap' }, createdAt: new Date().toISOString() },
  { _id: 'demo-2', title: 'Lead scoring signals', description: 'Prioritize incoming leads using source, intent and activity signals.', status: 'Evaluating', impact: 'High', effort: 'Large', category: 'Internal engine', createdBy: { _id: 'demo-2', name: 'Arjun Shah' }, createdAt: new Date().toISOString() },
  { _id: 'demo-3', title: 'Content repurposing workflow', description: 'Turn one approved article into channel-ready drafts automatically.', status: 'Inbox', impact: 'Medium', effort: 'Small', category: 'Internal engine', createdBy: { _id: 'demo-3', name: 'Lina Ahmed' }, createdAt: new Date().toISOString() },
];

const Ideas = () => {
  const { user, isDemo } = useAuth();
  const canManage = isSuperAdmin(user?.role);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', description: '', category: 'Internal systems', impact: 'Medium' as Idea['impact'], effort: 'Medium' as Idea['effort'] });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Idea | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    if (isDemo) { setIdeas(DEMO_IDEAS); setLoading(false); return; }
    try { setLoading(true); setIdeas(await ideaApi.list()); }
    catch (err) { setError(getErrorMessage(err, 'Failed to load the idea pipeline.')); }
    finally { setLoading(false); }
  }, [isDemo]);
  useEffect(() => { refetch(); }, [refetch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    setSubmitting(true); setError('');
    try {
      if (isDemo) {
        setIdeas((ideas) => [{ _id: `demo-${Date.now()}`, ...form, status: 'Inbox', createdBy: { _id: 'demo-pm', name: user?.name ?? 'Maya Pratap' }, createdAt: new Date().toISOString() }, ...ideas]);
        setForm({ title: '', description: '', category: 'Internal systems', impact: 'Medium', effort: 'Medium' });
        return;
      }
      await ideaApi.create(form);
      setForm({ title: '', description: '', category: 'Internal systems', impact: 'Medium', effort: 'Medium' });
      refetch();
    } catch (err) { setError(getErrorMessage(err, 'Failed to capture idea.')); }
    finally { setSubmitting(false); }
  };
  const moveIdea = async (idea: Idea, status: Idea['status']) => {
    setActionLoading(true);
    try { if (isDemo) setIdeas((ideas) => ideas.map((item) => item._id === idea._id ? { ...item, status } : item)); else { await ideaApi.update(idea._id, { status }); await refetch(); } }
    catch (err) { setError(getErrorMessage(err, 'Failed to update idea status.')); }
    finally { setActionLoading(false); }
  };
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try { if (isDemo) setIdeas((ideas) => ideas.filter((idea) => idea._id !== deleteTarget._id)); else { await ideaApi.remove(deleteTarget._id); refetch(); } setDeleteTarget(null); }
    catch (err) { setError(getErrorMessage(err, 'Failed to delete idea.')); }
    finally { setActionLoading(false); }
  };

  return <div className="animate-fade-in idea-page">
    <div className="idea-hero">
      <div>
        <div className="eyebrow"><Sparkles size={14} /> Opportunity pipeline</div>
        <h1 className="page-title">From signal to shipped.</h1>
        <p className="page-subtitle">{isDemo ? 'Demo data is saved only in this browser session — try moving an idea through the pipeline.' : 'Capture the team’s best ideas, assess them together, then turn the right ones into focused work.'}</p>
      </div>
      <div className="idea-hero-metric"><strong>{ideas.length}</strong><span>ideas in play</span></div>
    </div>

    {error && <div className="form-error">{error}</div>}

    <section className="idea-capture">
      <div className="idea-capture-heading"><div className="idea-capture-icon"><Lightbulb size={20} /></div><div><h2>Capture an opportunity</h2><p>Keep it short. The team can shape it when it reaches evaluation.</p></div></div>
      <form onSubmit={handleSubmit} className="idea-form">
        <input aria-label="Idea title" className="form-input" placeholder="What could we build or improve?" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        <input aria-label="Idea category" className="form-input" placeholder="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
        <select className="form-select" value={form.impact} onChange={(e) => setForm((f) => ({ ...f, impact: e.target.value as Idea['impact'] }))}><option>Low</option><option>Medium</option><option>High</option></select>
        <select className="form-select" value={form.effort} onChange={(e) => setForm((f) => ({ ...f, effort: e.target.value as Idea['effort'] }))}><option>Small</option><option>Medium</option><option>Large</option></select>
        <textarea aria-label="Idea context" className="form-textarea" rows={2} placeholder="What problem does it solve, and for whom?" required value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        <button type="submit" className="btn btn-primary" disabled={submitting}><Plus size={16} />{submitting ? 'Capturing...' : 'Add to inbox'}</button>
      </form>
    </section>

    {loading ? <div className="idea-board">{COLUMNS.map((c) => <div className="idea-column" key={c}><div className="skeleton" style={{ height: 160 }} /></div>)}</div> :
      <section className="idea-board" aria-label="Idea pipeline">
        {COLUMNS.map((column, index) => {
          const columnIdeas = ideas.filter((idea) => (idea.status || 'Inbox') === column);
          return <div className="idea-column" key={column}>
            <div className="idea-column-head"><div><h2>{column}</h2><p>{COLUMN_COPY[column]}</p></div><span>{columnIdeas.length}</span></div>
            <div className="idea-cards">
              {columnIdeas.map((idea) => <article className="idea-card" key={idea._id}>
                <div className="idea-card-top"><span className="idea-category">{idea.category || 'General'}</span>{canManage && <button className="idea-delete" title="Delete idea" onClick={() => setDeleteTarget(idea)}><Trash2 size={14} /></button>}</div>
                <h3>{idea.title}</h3><p>{idea.description}</p>
                <div className="idea-tags"><span>Impact: <b>{idea.impact || 'Medium'}</b></span><span>Effort: <b>{idea.effort || 'Medium'}</b></span></div>
                <footer><div className="idea-author"><CircleDot size={12} />{idea.createdBy?.name ?? 'Team'}</div>{canManage && index < COLUMNS.length - 1 && <button className="idea-next" disabled={actionLoading} onClick={() => moveIdea(idea, COLUMNS[index + 1])}>Move <ArrowRight size={13} /></button>}</footer>
              </article>)}
              {!columnIdeas.length && <div className="idea-empty">No ideas here yet.</div>}
            </div>
          </div>;
        })}
      </section>}
    {deleteTarget && <ConfirmDialog title="Delete Idea" message={`Delete “${deleteTarget.title}”?`} confirmLabel="Delete" danger loading={actionLoading} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />}
  </div>;
};
export default Ideas;
