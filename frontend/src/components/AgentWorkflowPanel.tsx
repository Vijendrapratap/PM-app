import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Bot, Check, CheckCircle2, ChevronDown, ChevronRight, Clock3,
  FileCheck2, FileText, Flag, GitBranch, ListChecks, Plus, RefreshCw, Save,
  Sparkles, Trash2, UserCheck,
} from 'lucide-react';
import {
  agentWorkflowApi, type AgentWorkspace, type PlanFeatureDraft,
  type PlanTaskDraft, type ProjectPlanContent,
} from '../api/agentWorkflowApi';
import { useAuth } from '../context/AuthContext';
import { canApproveAgentWork, isLead } from '../utils/roles';
import { getErrorMessage } from '../utils/errorMessage';

const emptyWorkspace: AgentWorkspace = { runs: [], plans: [], features: [], documents: [] };
const listText = (items: string[]) => items.join('\n');
const parseList = (value: string) => value.split('\n').map((item) => item.trim().replace(/^[-•]\s*/, '')).filter(Boolean);
const keyFor = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const statusClass = (status: string) => status.toLowerCase().replace(/\s+/g, '-');

const AgentWorkflowPanel = ({ projectId, view }: { projectId: string; view: 'plan' | 'documents' }) => {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<AgentWorkspace>(emptyWorkspace);
  const [planDraft, setPlanDraft] = useState<ProjectPlanContent | null>(null);
  const [documentDraft, setDocumentDraft] = useState('');
  const [selectedDocumentVersionId, setSelectedDocumentVersionId] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const activePlan = useMemo(() => workspace.plans.find((plan) => plan.status !== 'Superseded') || workspace.plans[0] || null, [workspace.plans]);
  const activeDocument = workspace.documents[0] || null;
  const activeDocumentVersion = activeDocument?.versions.find((version) => version._id === selectedDocumentVersionId)
    || activeDocument?.versions.find((version) => version.status !== 'Superseded')
    || activeDocument?.versions[0]
    || null;
  const latestRun = workspace.runs.find((run) => run.agentType === (view === 'plan' ? 'Project Manager' : 'Business Analyst'));
  const canEdit = canApproveAgentWork(user?.role) || isLead(user?.role);
  const canApprove = canApproveAgentWork(user?.role);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const next = await agentWorkflowApi.get(projectId);
      setWorkspace(next);
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'We could not load the project intelligence workspace.'));
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPlanDraft(activePlan ? structuredClone(activePlan.content) : null); }, [activePlan]);
  useEffect(() => { setDocumentDraft(activeDocumentVersion?.content || ''); }, [activeDocumentVersion]);

  const act = async (action: () => Promise<AgentWorkspace>, success: string) => {
    try {
      setSaving(true); setError(''); setSaved('');
      const next = await action();
      setWorkspace(next); setSaved(success);
    } catch (actionError) {
      setError(getErrorMessage(actionError, 'The action could not be completed.'));
    } finally { setSaving(false); }
  };

  const updateFeature = (key: string, patch: Partial<PlanFeatureDraft>) => setPlanDraft((current) => current ? ({
    ...current, features: current.features.map((feature) => feature.key === key ? { ...feature, ...patch } : feature),
  }) : current);

  const updateTask = (featureKey: string, taskKey: string, patch: Partial<PlanTaskDraft>) => setPlanDraft((current) => current ? ({
    ...current,
    features: current.features.map((feature) => feature.key === featureKey ? {
      ...feature, tasks: feature.tasks.map((task) => task.key === taskKey ? { ...task, ...patch } : task),
    } : feature),
  }) : current);

  const addFeature = () => {
    const key = keyFor('feature');
    setPlanDraft((current) => current ? ({ ...current, features: [...current.features, {
      key, milestone: 'Delivery', title: 'New module', outcome: 'Describe the measurable outcome.', description: 'Describe the module boundary.',
      acceptanceCriteria: ['Define the acceptance condition'], priority: 'Medium', estimateDays: 1,
      confidence: 'Low', tasks: [],
    }] }) : current);
    setExpanded((current) => ({ ...current, [key]: true }));
  };

  const addTask = (featureKey: string) => updateFeature(featureKey, {
    tasks: [...(planDraft?.features.find((feature) => feature.key === featureKey)?.tasks || []), {
      key: keyFor('task'), title: 'New task', description: 'Describe the executable work.', estimateDays: 1,
      priority: 'Medium', acceptanceCriteria: ['Define done'],
    }],
  });

  const removeTask = (featureKey: string, taskKey: string) => updateFeature(featureKey, {
    tasks: (planDraft?.features.find((feature) => feature.key === featureKey)?.tasks || []).filter((task) => task.key !== taskKey),
  });

  const savePlan = async () => {
    if (!activePlan || !planDraft) return;
    try {
      setSaving(true); setError('');
      const updated = await agentWorkflowApi.savePlan(projectId, activePlan._id, planDraft);
      setWorkspace((current) => ({ ...current, plans: current.plans.map((plan) => plan._id === updated._id ? updated : plan) }));
      setSaved('Draft saved');
    } catch (saveError) { setError(getErrorMessage(saveError, 'The plan draft could not be saved.')); }
    finally { setSaving(false); }
  };

  const saveDocument = async () => {
    if (!activeDocumentVersion) return;
    try {
      setSaving(true); setError('');
      const updated = await agentWorkflowApi.saveDocumentVersion(projectId, activeDocumentVersion._id, documentDraft);
      setWorkspace((current) => ({ ...current, documents: current.documents.map((document) => ({
        ...document, versions: document.versions.map((version) => version._id === updated._id ? updated : version),
      })) }));
      setSaved('Document draft saved');
    } catch (saveError) { setError(getErrorMessage(saveError, 'The document draft could not be saved.')); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="agent-workspace"><div className="agent-hero skeleton"/><div className="agent-body-skeleton skeleton"/></div>;

  return (
    <section className="agent-workspace">
      {error && <div className="agent-error" role="alert"><AlertCircle size={16}/><span>{error}</span></div>}
      {saved && <div className="agent-success" role="status"><Check size={15}/>{saved}</div>}

      <header className="agent-hero">
        <div className="agent-identity"><div className="agent-mark"><Bot size={20}/></div><div><small>{view === 'plan' ? 'Project Manager Agent' : 'Business Analyst Agent'}</small><h2>{view === 'plan' ? 'From brief to executable plan' : 'From approved plan to project guidance'}</h2><p>{view === 'plan' ? 'The agent prepares structure. Govind decides what becomes official.' : 'The BRD remains an agent draft until a named reviewer approves this version.'}</p></div></div>
        <div className={`agent-run-state ${statusClass(latestRun?.status || 'not started')}`}><span><i/>{latestRun?.status || 'Not started'}</span><small>{latestRun?.provider || 'No run yet'}</small></div>
      </header>

      <div className="agent-stage-track" aria-label="Agent workflow stages">
        {(view === 'plan' ? ['Project brief', 'Agent draft', 'Govind review', 'Published plan'] : ['Approved plan', 'BRD draft', 'Govind review', 'Approved guidance']).map((stage, index) => {
          const complete = view === 'plan'
            ? Boolean(activePlan && (index < 2 || activePlan.status === 'Approved'))
            : Boolean(activeDocumentVersion && (index < 2 || activeDocumentVersion.status === 'Approved'));
          return <div className={complete ? 'complete' : ''} key={stage}><span>{complete ? <Check size={11}/> : index + 1}</span><small>{stage}</small></div>;
        })}
      </div>

      {view === 'plan' ? !activePlan || !planDraft ? (
        <div className="agent-empty"><Sparkles size={25}/><h3>No planning draft yet</h3><p>Run the Project Manager Agent to turn the brief into editable milestones, modules, tasks, acceptance criteria, and estimate ranges.</p>{canEdit && <button className="btn btn-primary" disabled={saving} onClick={() => act(() => agentWorkflowApi.runProjectManager(projectId), 'Planning draft created')}><Bot size={15}/>{saving ? 'Preparing…' : 'Create planning draft'}</button>}</div>
      ) : (
        <div className="plan-workspace">
          <main className="plan-main">
            <div className="plan-heading"><div><span>Plan v{activePlan.version} · Project → Milestone → Module → Task</span><h2>Delivery structure</h2><p>{activePlan.status === 'Approved' ? `Approved by ${activePlan.approvedBy?.name || 'Project Manager'}` : 'Edit every layer, then publish the approved structure to the project workspace.'}</p></div><span className={`review-state ${statusClass(activePlan.status)}`}>{activePlan.status}</span></div>
            <label className="agent-field"><span>Plan summary</span><textarea rows={4} disabled={!canEdit || activePlan.status === 'Approved'} value={planDraft.summary} onChange={(event) => setPlanDraft({ ...planDraft, summary: event.target.value })}/></label>
            <div className="feature-list">
              {planDraft.features.map((feature, featureIndex) => {
                const isOpen = expanded[feature.key] ?? featureIndex === 0;
                return <article className="feature-draft" key={feature.key}>
                  <button className="feature-summary" onClick={() => setExpanded((current) => ({ ...current, [feature.key]: !isOpen }))} aria-expanded={isOpen}>
                    <span className="feature-index">{String(featureIndex + 1).padStart(2, '0')}</span><div><small>{feature.milestone || 'Delivery'} · {feature.priority} · {feature.estimateDays} days · {feature.confidence} confidence</small><strong>{feature.title}</strong><p>{feature.outcome}</p></div><span>{isOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}</span>
                  </button>
                  {isOpen && <div className="feature-editor">
                    <div className="agent-form-grid"><label className="agent-field"><span>Milestone</span><input disabled={!canEdit || activePlan.status === 'Approved'} value={feature.milestone || 'Delivery'} onChange={(event) => updateFeature(feature.key, { milestone: event.target.value })}/></label><label className="agent-field"><span>Module title</span><input disabled={!canEdit || activePlan.status === 'Approved'} value={feature.title} onChange={(event) => updateFeature(feature.key, { title: event.target.value })}/></label><label className="agent-field"><span>Estimate (days)</span><input type="number" min="0.25" step="0.25" disabled={!canEdit || activePlan.status === 'Approved'} value={feature.estimateDays} onChange={(event) => updateFeature(feature.key, { estimateDays: Number(event.target.value) })}/></label></div>
                    <label className="agent-field"><span>Outcome</span><textarea disabled={!canEdit || activePlan.status === 'Approved'} value={feature.outcome} onChange={(event) => updateFeature(feature.key, { outcome: event.target.value })}/></label>
                    <label className="agent-field"><span>Acceptance criteria <small>one per line</small></span><textarea disabled={!canEdit || activePlan.status === 'Approved'} value={listText(feature.acceptanceCriteria)} onChange={(event) => updateFeature(feature.key, { acceptanceCriteria: parseList(event.target.value) })}/></label>
                    <div className="task-draft-list"><div className="task-list-heading"><span><ListChecks size={14}/>Executable tasks</span>{canEdit && activePlan.status !== 'Approved' && <button onClick={() => addTask(feature.key)}><Plus size={13}/>Add task</button>}</div>
                      {feature.tasks.map((task, taskIndex) => <div className="task-draft" key={task.key}><span>{taskIndex + 1}</span><div><input aria-label="Task title" disabled={!canEdit || activePlan.status === 'Approved'} value={task.title} onChange={(event) => updateTask(feature.key, task.key, { title: event.target.value })}/><textarea aria-label="Task description" disabled={!canEdit || activePlan.status === 'Approved'} value={task.description} onChange={(event) => updateTask(feature.key, task.key, { description: event.target.value })}/><textarea aria-label="Task acceptance criteria" disabled={!canEdit || activePlan.status === 'Approved'} value={listText(task.acceptanceCriteria)} onChange={(event) => updateTask(feature.key, task.key, { acceptanceCriteria: parseList(event.target.value) })}/></div><label><small>days</small><input aria-label="Task estimate in days" type="number" min="0.25" step="0.25" disabled={!canEdit || activePlan.status === 'Approved'} value={task.estimateDays} onChange={(event) => updateTask(feature.key, task.key, { estimateDays: Number(event.target.value) })}/></label>{canEdit && activePlan.status !== 'Approved' && <button className="task-remove" aria-label={`Remove ${task.title}`} onClick={() => removeTask(feature.key, task.key)}><Trash2 size={13}/></button>}</div>)}
                    </div>
                  </div>}
                </article>;
              })}
            </div>
            {canEdit && activePlan.status !== 'Approved' && <button className="add-feature" onClick={addFeature}><Plus size={14}/>Add module</button>}
          </main>
          <aside className="plan-review-rail">
            <section><span><Flag size={14}/>Risks</span><textarea disabled={!canEdit || activePlan.status === 'Approved'} value={listText(planDraft.risks)} onChange={(event) => setPlanDraft({ ...planDraft, risks: parseList(event.target.value) })}/></section>
            <section><span><AlertCircle size={14}/>Open questions</span><textarea disabled={!canEdit || activePlan.status === 'Approved'} value={listText(planDraft.questions)} onChange={(event) => setPlanDraft({ ...planDraft, questions: parseList(event.target.value) })}/></section>
            <section><span><GitBranch size={14}/>Assumptions</span><textarea disabled={!canEdit || activePlan.status === 'Approved'} value={listText(planDraft.assumptions)} onChange={(event) => setPlanDraft({ ...planDraft, assumptions: parseList(event.target.value) })}/></section>
            {activePlan.status !== 'Approved' ? <div className="review-actions">{canEdit && <button className="btn btn-secondary" disabled={saving} onClick={savePlan}><Save size={14}/>{saving ? 'Saving…' : 'Save draft'}</button>}{canApprove && <button className="btn btn-primary" disabled={saving} onClick={() => act(() => agentWorkflowApi.approvePlan(projectId, activePlan._id), 'Plan approved and published')}><UserCheck size={14}/>{saving ? 'Publishing…' : 'Approve & publish'}</button>}</div> : canEdit && <button className="btn btn-secondary new-version" disabled={saving} onClick={() => act(() => agentWorkflowApi.runProjectManager(projectId, true), 'A new planning version is ready')}><RefreshCw size={14}/>Generate new version</button>}
          </aside>
        </div>
      ) : !activeDocumentVersion ? (
        <div className="agent-empty"><FileText size={25}/><h3>No business requirements draft yet</h3><p>The Business Analyst Agent starts automatically after the project plan is approved.</p>{activePlan?.status === 'Approved' && canEdit && <button className="btn btn-primary" disabled={saving} onClick={() => act(() => agentWorkflowApi.runBusinessAnalyst(projectId, activePlan._id), 'BRD draft created')}><Bot size={15}/>{saving ? 'Drafting…' : 'Create BRD draft'}</button>}</div>
      ) : (
        <div className="document-workspace">
          <aside className="document-outline"><div><FileCheck2 size={16}/><span>{activeDocument?.title}</span></div>{activeDocument?.versions.map((version) => <button className={version._id === activeDocumentVersion._id ? 'active' : ''} key={version._id} onClick={() => setSelectedDocumentVersionId(version._id)}><span>Version {version.version}</span><small>{version.status}</small></button>)}</aside>
          <main className="document-editor"><div className="document-editor-head"><div><span>{activeDocument?.documentType} · v{activeDocumentVersion.version}</span><h2>{activeDocument?.title}</h2></div><span className={`review-state ${statusClass(activeDocumentVersion.status)}`}>{activeDocumentVersion.status}</span></div><textarea aria-label="Business requirements document" disabled={!canEdit || activeDocumentVersion.status === 'Approved'} value={documentDraft} onChange={(event) => setDocumentDraft(event.target.value)}/></main>
          <aside className="document-review"><div className="document-review-mark"><Clock3 size={18}/></div><h3>{activeDocumentVersion.status === 'Approved' ? 'Approved guidance' : 'Waiting for Govind'}</h3><p>{activeDocumentVersion.status === 'Approved' ? `Approved by ${activeDocumentVersion.approvedBy?.name || 'Project Manager'}. This version is read-only.` : 'Review and edit this draft. Approval makes this exact version visible as official project guidance.'}</p>{activeDocumentVersion.status !== 'Approved' && <div className="review-actions">{canEdit && <button className="btn btn-secondary" disabled={saving} onClick={saveDocument}><Save size={14}/>Save draft</button>}{canApprove && <button className="btn btn-primary" disabled={saving} onClick={() => act(() => agentWorkflowApi.approveDocumentVersion(projectId, activeDocumentVersion._id), 'Document approved')}><CheckCircle2 size={14}/>Approve document</button>}</div>}{activeDocumentVersion.status === 'Approved' && canEdit && activePlan && <button className="btn btn-secondary new-version" disabled={saving} onClick={() => act(() => agentWorkflowApi.runBusinessAnalyst(projectId, activePlan._id, true), 'A new BRD version is ready')}><RefreshCw size={14}/>Generate new version</button>}</aside>
        </div>
      )}
    </section>
  );
};

export default AgentWorkflowPanel;
