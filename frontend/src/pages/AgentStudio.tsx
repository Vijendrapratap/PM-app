import { useEffect, useMemo, useState } from 'react';
import { Bot, Check, Clock3, FileText, Save, ShieldCheck, Sparkles } from 'lucide-react';
import { agentWorkflowApi, type AgentDefinition, type AgentProviderStatus } from '../api/agentWorkflowApi';
import { getErrorMessage } from '../utils/errorMessage';
import { useAuth } from '../context/AuthContext';
import { canApproveAgentWork, isLead } from '../utils/roles';

const safeDefinitions: AgentDefinition[] = [
  {
    _id: 'builtin-project-manager', agentKey: 'project-manager', name: 'Project Manager Agent',
    description: 'Turns a project brief into editable milestones, features, tasks, estimates, risks and acceptance criteria.',
    systemPrompt: 'You are a senior startup project manager. Convert the supplied project brief into a practical delivery plan for human review. Organize the plan as project, milestones, outcome-based features, and small executable tasks. Estimates are working-day estimates, never commitments. Do not invent customer facts, integrations, deadlines, or compliance requirements. Put uncertainty into assumptions, risks, or questions. Every acceptance criterion must be observable and testable.',
    active: true, editable: false, updatedAt: '1970-01-01T00:00:00.000Z', updatedBy: null, versions: [],
  },
  {
    _id: 'builtin-business-analyst', agentKey: 'business-analyst', name: 'Business Analyst Agent',
    description: 'Turns an approved delivery plan into versioned business requirements and project guidance.',
    systemPrompt: 'You are a senior business analyst. Produce a concise, complete Business Requirements Document in Markdown. Base every requirement on the supplied project and approved plan. Do not invent facts; label uncertainty as an assumption or open question. Include project overview, goals, scope, exclusions, functional and non-functional requirements, acceptance criteria, dependencies, risks, open questions and approval status. Clearly label all output as an agent draft until an authorized human approves it.',
    active: true, editable: false, updatedAt: '1970-01-01T00:00:00.000Z', updatedBy: null, versions: [],
  },
];

const AgentStudio = () => {
  const { user, isDemo } = useAuth();
  const authorized = canApproveAgentWork(user?.role) || isLead(user?.role);
  const [definitions, setDefinitions] = useState<AgentDefinition[]>([]);
  const [providerStatus, setProviderStatus] = useState<AgentProviderStatus | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState('');
  const selected = useMemo(() => definitions.find((definition) => definition._id === selectedId) || definitions[0] || null, [definitions, selectedId]);

  useEffect(() => {
    if (!authorized) { setLoading(false); return; }
    if (isDemo) {
      setDefinitions(safeDefinitions);
      setSelectedId(safeDefinitions[0]._id);
      setProviderStatus({ mode: 'Local fallback', configured: false, provider: 'Demo-safe structured provider', model: null, agents: safeDefinitions.map(({ agentKey, name, active }) => ({ agentKey, name, active })) });
      setNotice('Demo mode uses safe built-in agent definitions. Open a project to review the milestone, feature and task workflow.');
      setLoading(false);
      return;
    }
    Promise.allSettled([agentWorkflowApi.definitions(), agentWorkflowApi.status()])
      .then(([definitionResult, statusResult]) => {
        if (definitionResult.status === 'fulfilled') {
          setDefinitions(definitionResult.value);
          setSelectedId(definitionResult.value[0]?._id || '');
        } else {
          setDefinitions(safeDefinitions);
          setSelectedId(safeDefinitions[0]._id);
          setNotice('Safe default agents are active while prompt storage reconnects. Drafting remains available from each project.');
        }
        if (statusResult.status === 'fulfilled') setProviderStatus(statusResult.value);
        else setProviderStatus({ mode: 'Local fallback', configured: false, provider: 'Provider status unavailable', model: null, agents: safeDefinitions.map(({ agentKey, name, active }) => ({ agentKey, name, active })) });
      })
      .finally(() => setLoading(false));
  }, [authorized, isDemo]);
  useEffect(() => { setPrompt(selected?.systemPrompt || ''); setChangeNote(''); setSaved(''); }, [selected]);

  const save = async () => {
    if (!selected?.editable) { setError('Prompt storage is read-only until the agent definitions migration is applied. Agent runs can still use the safe default prompt.'); return; }
    if (prompt.trim().length < 80) { setError('The system prompt needs enough detail to guide safe, consistent output.'); return; }
    try { setSaving(true); setError(''); setSaved(''); const items = await agentWorkflowApi.updateDefinition(selected._id, prompt, changeNote || undefined); setDefinitions(items); setSaved('Prompt version published for future runs'); }
    catch (saveError) { setError(getErrorMessage(saveError, 'We could not save this prompt version.')); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="agent-studio-loading"><div className="skeleton"/><div className="skeleton"/></div>;
  if (!authorized) return <div className="agent-studio-denied"><ShieldCheck size={24}/><h1>Agent Studio is restricted</h1><p>Project Managers, Tech Leads and the CEO can manage agent prompts.</p></div>;
  return <div className="agent-studio animate-fade-in">
    <header className="studio-hero"><div><span><Sparkles size={14}/>Agent Studio</span><h1>Shape how your project agents work</h1><p>System prompts guide future drafts. Every saved change creates a version and never rewrites approved project work.</p></div><aside><ShieldCheck size={18}/><div><strong>Human-controlled</strong><small>Agents draft. Govind or Pratap publishes project truth.</small></div></aside></header>
    {notice && <div className="studio-message info" role="status"><ShieldCheck size={14}/>{notice}</div>}{error && <div className="studio-message error" role="alert">{error}</div>}{saved && <div className="studio-message success" role="status"><Check size={14}/>{saved}</div>}
    <div className="studio-layout">
      <aside className="studio-agents"><header>Available agents</header>{definitions.map((definition) => <button className={selected?._id === definition._id ? 'active' : ''} onClick={() => setSelectedId(definition._id)} key={definition._id}><span>{definition.agentKey === 'project-manager' ? 'PM' : 'BA'}</span><div><strong>{definition.name}</strong><small>{definition.active ? 'Active' : 'Paused'} · {definition.versions.length || 'Base'} versions</small></div></button>)}</aside>
      {selected && <main className="studio-editor"><header><div><small>{selected.agentKey}</small><h2>{selected.name}</h2><p>{selected.description}</p></div><span>{selected.active ? 'Active' : 'Paused'}</span></header>{!selected.editable && <div className="studio-readonly"><ShieldCheck size={14}/><div><strong>Safe default prompt is active</strong><span>Agent runs remain available. Prompt editing will unlock when version storage is connected.</span></div></div>}<label><span>System prompt</span><small>Be explicit about role, inputs, output quality, boundaries, and what the agent must never assume.</small><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} spellCheck readOnly={!selected.editable}/></label><label><span>Change note</span><input value={changeNote} onChange={(event) => setChangeNote(event.target.value)} placeholder="Why are you changing this prompt?" maxLength={500} disabled={!selected.editable}/></label><footer><span><FileText size={13}/>Changes affect new runs only</span><button className="btn btn-primary" onClick={save} disabled={!selected.editable || saving || prompt === selected.systemPrompt}><Save size={14}/>{saving ? 'Publishing…' : selected.editable ? 'Publish prompt version' : 'Prompt storage read-only'}</button></footer></main>}
      <aside className="studio-history"><header><Clock3 size={14}/>Version history</header>{selected?.versions.length ? selected.versions.slice(0, 8).map((version) => <div key={version._id}><span>v{version.version}</span><div><strong>{version.changeNote || 'Prompt update'}</strong><small>{version.createdBy?.name || 'Authorized user'} · {new Date(version.createdAt).toLocaleDateString()}</small></div></div>) : <p>The current base prompt has no edits yet.</p>}<section className={providerStatus?.configured ? 'provider-live' : 'provider-fallback'}><Bot size={16}/><strong>{providerStatus?.configured ? 'Hosted provider active' : 'Local fallback active'}</strong><span>{providerStatus?.provider || 'Checking provider…'}</span></section></aside>
    </div>
  </div>;
};

export default AgentStudio;
