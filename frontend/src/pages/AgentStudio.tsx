import { useEffect, useMemo, useState } from 'react';
import { Bot, Check, Clock3, FileText, Save, ShieldCheck, Sparkles } from 'lucide-react';
import { agentWorkflowApi, type AgentDefinition } from '../api/agentWorkflowApi';
import { getErrorMessage } from '../utils/errorMessage';
import { useAuth } from '../context/AuthContext';
import { canApproveAgentWork, isLead } from '../utils/roles';

const AgentStudio = () => {
  const { user } = useAuth();
  const authorized = canApproveAgentWork(user?.role) || isLead(user?.role);
  const [definitions, setDefinitions] = useState<AgentDefinition[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const selected = useMemo(() => definitions.find((definition) => definition._id === selectedId) || definitions[0] || null, [definitions, selectedId]);

  useEffect(() => { if (!authorized) { setLoading(false); return; } agentWorkflowApi.definitions().then((items) => { setDefinitions(items); setSelectedId(items[0]?._id || ''); }).catch((loadError) => setError(getErrorMessage(loadError, 'Agent Studio is not available yet.'))).finally(() => setLoading(false)); }, [authorized]);
  useEffect(() => { setPrompt(selected?.systemPrompt || ''); setChangeNote(''); setSaved(''); }, [selected]);

  const save = async () => {
    if (!selected || prompt.trim().length < 80) { setError('The system prompt needs enough detail to guide safe, consistent output.'); return; }
    try { setSaving(true); setError(''); setSaved(''); const items = await agentWorkflowApi.updateDefinition(selected._id, prompt, changeNote || undefined); setDefinitions(items); setSaved('Prompt version published for future runs'); }
    catch (saveError) { setError(getErrorMessage(saveError, 'We could not save this prompt version.')); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="agent-studio-loading"><div className="skeleton"/><div className="skeleton"/></div>;
  if (!authorized) return <div className="agent-studio-denied"><ShieldCheck size={24}/><h1>Agent Studio is restricted</h1><p>Project Managers, Tech Leads and the CEO can manage agent prompts.</p></div>;
  return <div className="agent-studio animate-fade-in">
    <header className="studio-hero"><div><span><Sparkles size={14}/>Agent Studio</span><h1>Shape how your project agents work</h1><p>System prompts guide future drafts. Every saved change creates a version and never rewrites approved project work.</p></div><aside><ShieldCheck size={18}/><div><strong>Human-controlled</strong><small>Agents draft. Govind or Pratap publishes project truth.</small></div></aside></header>
    {error && <div className="studio-message error" role="alert">{error}</div>}{saved && <div className="studio-message success" role="status"><Check size={14}/>{saved}</div>}
    <div className="studio-layout">
      <aside className="studio-agents"><header>Available agents</header>{definitions.map((definition) => <button className={selected?._id === definition._id ? 'active' : ''} onClick={() => setSelectedId(definition._id)} key={definition._id}><span>{definition.agentKey === 'project-manager' ? 'PM' : 'BA'}</span><div><strong>{definition.name}</strong><small>{definition.active ? 'Active' : 'Paused'} · {definition.versions.length || 'Base'} versions</small></div></button>)}</aside>
      {selected && <main className="studio-editor"><header><div><small>{selected.agentKey}</small><h2>{selected.name}</h2><p>{selected.description}</p></div><span>{selected.active ? 'Active' : 'Paused'}</span></header><label><span>System prompt</span><small>Be explicit about role, inputs, output quality, boundaries, and what the agent must never assume.</small><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} spellCheck/></label><label><span>Change note</span><input value={changeNote} onChange={(event) => setChangeNote(event.target.value)} placeholder="Why are you changing this prompt?" maxLength={500}/></label><footer><span><FileText size={13}/>Changes affect new runs only</span><button className="btn btn-primary" onClick={save} disabled={saving || prompt === selected.systemPrompt}><Save size={14}/>{saving ? 'Publishing…' : 'Publish prompt version'}</button></footer></main>}
      <aside className="studio-history"><header><Clock3 size={14}/>Version history</header>{selected?.versions.length ? selected.versions.slice(0, 8).map((version) => <div key={version._id}><span>v{version.version}</span><div><strong>{version.changeNote || 'Prompt update'}</strong><small>{version.createdBy?.name || 'Authorized user'} · {new Date(version.createdAt).toLocaleDateString()}</small></div></div>) : <p>The current base prompt has no edits yet.</p>}<section><Bot size={16}/><strong>Configured provider</strong><span>OpenRouter · DeepSeek V4 Flash</span></section></aside>
    </div>
  </div>;
};

export default AgentStudio;
