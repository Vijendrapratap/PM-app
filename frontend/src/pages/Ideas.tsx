import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, CircleDot, FolderKanban, Lightbulb, Plus, SearchCheck, Sparkles, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import { ideaApi, type Idea, type IdeaStatus } from '../api/ideaApi';
import { getErrorMessage } from '../utils/errorMessage';
import { useAuth } from '../context/AuthContext';
import { canApproveAgentWork, isSuperAdmin } from '../utils/roles';

type IdeaFilter = 'ALL' | 'INBOX' | 'REVIEW' | 'APPROVED' | 'CONVERTED' | 'PARKED';
const FILTERS: Array<{ id: IdeaFilter; label: string; statuses?: IdeaStatus[] }> = [
  { id: 'ALL', label: 'All ideas' },
  { id: 'INBOX', label: 'Needs triage', statuses: ['INBOX', 'NEEDS_CLARIFICATION'] },
  { id: 'REVIEW', label: 'In review', statuses: ['UNDER_REVIEW', 'VALIDATING'] },
  { id: 'APPROVED', label: 'Approved', statuses: ['APPROVED'] },
  { id: 'CONVERTED', label: 'Converted', statuses: ['CONVERTED_TO_PROJECT'] },
  { id: 'PARKED', label: 'Parked', statuses: ['INCUBATING', 'REJECTED', 'ARCHIVED'] },
];
const DEMO_IDEAS: Idea[] = [
  { _id: 'demo-1', title: 'AI weekly project recap', description: 'Generate a concise leadership update from tasks, risks and project notes.', status: 'APPROVED', impact: 'High', effort: 'Medium', category: 'Development', priorityScore: 8, createdBy: { _id: 'demo-pm', name: 'Maya Pratap' }, createdAt: new Date().toISOString() },
  { _id: 'demo-2', title: 'Lead scoring signals', description: 'Prioritize incoming leads using source, intent and activity signals.', status: 'UNDER_REVIEW', impact: 'High', effort: 'Large', category: 'Sales', createdBy: { _id: 'demo-2', name: 'Arjun Shah' }, createdAt: new Date().toISOString() },
  { _id: 'demo-3', title: 'Content repurposing workflow', description: 'Turn one approved article into channel-ready drafts automatically.', status: 'INBOX', impact: 'Medium', effort: 'Small', category: 'Marketing', createdBy: { _id: 'demo-3', name: 'Lina Ahmed' }, createdAt: new Date().toISOString() },
];
const emptyForm = { title: '', problem: '', category: 'Development', proposedSolution: '', beneficiary: '', expectedValue: '' };

const Ideas = () => {
  const { user, isDemo } = useAuth(); const navigate = useNavigate();
  const canReview = canApproveAgentWork(user?.platformRole || user?.role); const canConvert = isSuperAdmin(user?.platformRole || user?.role);
  const [ideas, setIdeas] = useState<Idea[]>([]); const [loading, setLoading] = useState(true); const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false); const [deleteTarget, setDeleteTarget] = useState<Idea | null>(null); const [actionId, setActionId] = useState(''); const [error, setError] = useState('');
  const [filter, setFilter] = useState<IdeaFilter>('ALL');
  const refetch = useCallback(async () => { if (isDemo) { setIdeas(DEMO_IDEAS); setLoading(false); return; } try { setLoading(true); setIdeas(await ideaApi.list()); } catch (caught) { setError(getErrorMessage(caught, 'Failed to load ideas.')); } finally { setLoading(false); } }, [isDemo]);
  useEffect(() => { refetch(); }, [refetch]);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setSubmitting(true); setError(''); try { if (isDemo) setIdeas((current) => [{ _id: `demo-${Date.now()}`, ...form, description: form.problem, status: 'INBOX', impact: 'Medium', effort: 'Medium', createdBy: { _id: user?._id || 'demo', name: user?.name || 'Team member' }, createdAt: new Date().toISOString() }, ...current]); else { await ideaApi.create(form); await refetch(); } setFilter('INBOX'); setForm(emptyForm); } catch (caught) { setError(getErrorMessage(caught, 'Failed to capture idea.')); } finally { setSubmitting(false); } };
  const act = async (idea: Idea, action: 'review' | 'approve' | 'reject' | 'convert') => { setActionId(idea._id); setError(''); try { if (isDemo) { const next: IdeaStatus = action === 'review' ? 'UNDER_REVIEW' : action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'CONVERTED_TO_PROJECT'; setIdeas((current) => current.map((row) => row._id === idea._id ? { ...row, status: next } : row)); } else if (action === 'convert') { const result = await ideaApi.convert(idea._id); navigate(`/projects/${result.project._id}`); } else { await ideaApi[action](idea._id); await refetch(); } } catch (caught) { setError(getErrorMessage(caught, 'Could not update the idea.')); } finally { setActionId(''); } };
  const score = async (idea: Idea, formData: FormData) => { setActionId(idea._id); try { const value = (name: string) => Number(formData.get(name)); if (!isDemo) await ideaApi.update(idea._id, { businessValueScore: value('business'), strategicAlignmentScore: value('alignment'), urgencyScore: value('urgency'), deliveryEffortScore: value('effort') }); await refetch(); } catch (caught) { setError(getErrorMessage(caught, 'Could not save score.')); } finally { setActionId(''); } };
  const archive = async () => { if (!deleteTarget) return; setActionId(deleteTarget._id); try { if (isDemo) setIdeas((current) => current.filter((row) => row._id !== deleteTarget._id)); else { await ideaApi.remove(deleteTarget._id); await refetch(); } setDeleteTarget(null); } catch (caught) { setError(getErrorMessage(caught, 'Could not archive idea.')); } finally { setActionId(''); } };

  const activeFilter = FILTERS.find((item) => item.id === filter);
  const visibleIdeas = activeFilter?.statuses ? ideas.filter((idea) => activeFilter.statuses?.includes(idea.status)) : ideas;
  const countFor = (item: (typeof FILTERS)[number]) => item.statuses ? ideas.filter((idea) => item.statuses?.includes(idea.status)).length : ideas.length;
  const nextStepFor = (idea: Idea) => {
    if (idea.status === 'INBOX') return 'Review the problem and decide whether it needs validation.';
    if (['NEEDS_CLARIFICATION', 'UNDER_REVIEW', 'VALIDATING'].includes(idea.status)) return 'Score the idea, then approve or reject it.';
    if (idea.status === 'APPROVED') return 'Convert the approved idea into a project when an owner is ready.';
    if (idea.status === 'CONVERTED_TO_PROJECT') return 'Open the linked project to follow delivery.';
    if (idea.status === 'INCUBATING') return 'Keep this visible until timing or capacity changes.';
    return 'This decision is preserved for future reference.';
  };

  return <div className="animate-fade-in idea-page">
    <div className="idea-hero"><div><div className="eyebrow"><Sparkles size={14}/> Idea workspace</div><h1 className="page-title">Turn a useful thought into a clear decision.</h1><p className="page-subtitle">Capture the problem in under a minute, review it with context, and convert only approved ideas into projects.</p></div><div className="idea-hero-metric"><strong>{ideas.length}</strong><span>ideas visible</span></div></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <section className="idea-flow" aria-label="How ideas move to projects">
      <article><span>01</span><i><Lightbulb size={18}/></i><div><strong>Capture</strong><p>Anyone records the problem and department.</p></div></article>
      <article><span>02</span><i><SearchCheck size={18}/></i><div><strong>Review and score</strong><p>A manager checks value, urgency, alignment, and effort.</p></div></article>
      <article><span>03</span><i><CheckCircle2 size={18}/></i><div><strong>Decide</strong><p>Approve, reject, or keep the idea for later.</p></div></article>
      <article><span>04</span><i><FolderKanban size={18}/></i><div><strong>Convert</strong><p>The CEO creates a linked project from an approved idea.</p></div></article>
    </section>
    <section className="idea-capture"><div className="idea-capture-heading"><div className="idea-capture-icon"><Plus size={20}/></div><div><h2>Quick capture</h2><p>Only three fields are required. Add supporting detail later if it helps the review.</p></div></div>
      <form onSubmit={submit} className="idea-form-simple"><label><span>Idea title</span><input className="form-input" required placeholder="Name the opportunity" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}/></label><label><span>Department</span><select className="form-select" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}><option>Development</option><option>Marketing</option><option>Sales</option><option>Operations</option><option>Other</option></select></label><label className="idea-problem"><span>Problem or opportunity</span><textarea className="form-textarea" required rows={2} placeholder="What did you notice, and why does it matter?" value={form.problem} onChange={(e) => setForm((f) => ({ ...f, problem: e.target.value }))}/></label><button className="btn btn-primary" disabled={submitting}><Plus size={16}/>{submitting ? 'Adding…' : 'Add to inbox'}</button>
        <details className="idea-more"><summary>Add supporting detail <small>optional</small></summary><div><label><span>Who benefits?</span><input className="form-input" placeholder="Customers, sales team, delivery team…" value={form.beneficiary} onChange={(e) => setForm((f) => ({ ...f, beneficiary: e.target.value }))}/></label><label><span>Possible solution</span><input className="form-input" placeholder="A rough approach is enough" value={form.proposedSolution} onChange={(e) => setForm((f) => ({ ...f, proposedSolution: e.target.value }))}/></label><label><span>Expected value</span><input className="form-input" placeholder="Time saved, risk reduced, revenue supported…" value={form.expectedValue} onChange={(e) => setForm((f) => ({ ...f, expectedValue: e.target.value }))}/></label></div></details>
      </form></section>
    <section className="idea-workspace" aria-label="Idea review workspace"><header><div><h2>Ideas and decisions</h2><p>Filter by the next action instead of searching across narrow board columns.</p></div><span>{visibleIdeas.length} shown</span></header><nav className="idea-filters" aria-label="Filter ideas">{FILTERS.map((item) => <button type="button" className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)} key={item.id}><span>{item.label}</span><b>{countFor(item)}</b></button>)}</nav>
      {loading ? <div className="idea-list"><div className="skeleton" style={{ height: 190 }}/><div className="skeleton" style={{ height: 190 }}/></div> : <div className="idea-list">{visibleIdeas.map((idea, index) => <article className={`idea-list-card tone-${index % 5}`} key={idea._id}><div className="idea-list-main"><header><div><span className={`idea-status idea-status-${idea.status.toLowerCase()}`}>{idea.status.replaceAll('_', ' ')}</span><span className="idea-category">{idea.department?.name || idea.category || 'General'}</span></div>{canConvert && <button className="idea-delete" aria-label={`Archive ${idea.title}`} title="Archive idea" onClick={() => setDeleteTarget(idea)}><Trash2 size={15}/></button>}</header><h3>{idea.title}</h3><p>{idea.description}</p><div className="idea-card-meta"><span><CircleDot size={12}/>Submitted by {idea.createdBy?.name || 'Team'}</span>{idea.priorityScore != null && <span><strong>{idea.priorityScore}</strong> priority score</span>}</div>
        {canReview && ['UNDER_REVIEW', 'VALIDATING'].includes(idea.status) && <details className="idea-score"><summary>Decision score <small>1–5 for each factor</small></summary><form action={(data) => score(idea, data)}>{[['business','Business value'],['alignment','Strategic alignment'],['urgency','Urgency'],['effort','Delivery effort']].map(([name,label]) => <label key={name}>{label}<select name={name} defaultValue="3">{[1,2,3,4,5].map((number) => <option key={number}>{number}</option>)}</select></label>)}<button className="btn btn-secondary" disabled={actionId === idea._id}>Save score</button></form></details>}
        </div><aside className="idea-next-step"><span>Next step</span><p>{nextStepFor(idea)}</p><div className="idea-card-actions">{canReview && idea.status === 'INBOX' && <button className="idea-next primary" disabled={actionId === idea._id} onClick={() => act(idea, 'review')}>Start review <ArrowRight size={14}/></button>}{canReview && ['UNDER_REVIEW','VALIDATING'].includes(idea.status) && <><button className="idea-next" disabled={actionId === idea._id} onClick={() => act(idea, 'reject')}>Reject</button><button className="idea-next primary" disabled={actionId === idea._id} onClick={() => act(idea, 'approve')}>Approve <ArrowRight size={14}/></button></>}{canConvert && idea.status === 'APPROVED' && <button className="idea-next primary" disabled={actionId === idea._id} onClick={() => act(idea, 'convert')}>Create project <ArrowRight size={14}/></button>}{idea.convertedProject && <button className="idea-next primary" onClick={() => navigate(`/projects/${idea.convertedProject?.id}`)}>Open project <ArrowRight size={14}/></button>}</div></aside></article>)}{!visibleIdeas.length && <div className="idea-empty"><Lightbulb size={22}/><strong>No ideas in this stage</strong><span>Choose another filter or add a new idea to the inbox.</span></div>}</div>}
    </section>
    {deleteTarget && <ConfirmDialog title="Archive Idea" message={`Archive “${deleteTarget.title}”? Its history will be preserved.`} confirmLabel="Archive" danger loading={actionId === deleteTarget._id} onConfirm={archive} onClose={() => setDeleteTarget(null)}/>}
  </div>;
};
export default Ideas;
