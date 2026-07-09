import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, Lightbulb, Users, UserRoundX, Zap } from 'lucide-react';

const projects = [
  { name: 'Content Engine & social publishing', stream: 'Pratap AI', status: 'Discovery', progress: 25, risk: false, team: 3 },
  { name: 'Lead Generation Engine', stream: 'Pratap AI', status: 'Discovery', progress: 20, risk: false, team: 3 },
  { name: 'WhatsApp Business automation', stream: 'Pratap AI', status: 'Planning', progress: 15, risk: false, team: 2 },
  { name: 'AI clone video pipeline', stream: 'Pratap AI', status: 'Research', progress: 20, risk: false, team: 2 },
  { name: 'Guruji voice cloning platform', stream: 'Vishvas Foundation', status: 'Model research', progress: 20, risk: false, team: 3 },
  { name: 'Guruji RAG & knowledge graph chat', stream: 'Vishvas Foundation', status: 'Research', progress: 15, risk: false, team: 3 },
  { name: 'Recruitment platform — ATS, parsing & AI interviews', stream: 'Recruitment Platform', status: 'Demo validation', progress: 55, risk: true, team: 4 },
  { name: 'WhatsApp Business automation', stream: 'Real Estate', status: 'Discovery', progress: 15, risk: false, team: 2 },
  { name: 'Property voice calling agent', stream: 'Real Estate', status: 'Discovery', progress: 15, risk: false, team: 3 },
  { name: 'Blueprint-to-walkthrough video', stream: 'Real Estate', status: 'Discovery', progress: 10, risk: false, team: 3 },
  { name: 'Lead Generation Engine', stream: 'Real Estate', status: 'Planning', progress: 20, risk: false, team: 3 },
  { name: 'Content & social publishing engine', stream: 'Real Estate', status: 'Planning', progress: 20, risk: false, team: 2 },
  { name: 'Competitor ad analysis', stream: 'Real Estate', status: 'Discovery', progress: 10, risk: false, team: 2 },
  { name: 'Competitor Analysis — Gold', stream: "Sunny's Project", status: 'Discovery', progress: 15, risk: false, team: 2 },
  { name: 'Gold market sentiment analysis', stream: "Sunny's Project", status: 'Discovery', progress: 15, risk: false, team: 2 },
  { name: 'Competition analysis — Resort', stream: "Sunny's Project", status: 'Discovery', progress: 15, risk: false, team: 2 },
  { name: 'Niko Salon', stream: "Sunny's Project", status: 'Planning', progress: 20, risk: false, team: 2 },
  { name: 'Clinical chatbot', stream: "Sunny's Project", status: 'Planning', progress: 20, risk: false, team: 2 },
  { name: 'Content Brain', stream: "Sunny's Project", status: 'On hold', progress: 25, risk: false, team: 0 },
  { name: 'Export Package agent', stream: "Sunny's Project", status: 'Awaiting BRD approval', progress: 10, risk: true, team: 1 },
  { name: 'Loan vending Excel dashboard', stream: "Sunny's Project", status: 'Awaiting BRD approval', progress: 10, risk: true, team: 1 },
];
const people = [
  ['Maya Pratap', 'Available', 6], ['Arjun Shah', 'Busy', 8], ['Lina Ahmed', 'Available', 4], ['Samir Khan', 'Available', 2], ['Aisha Noor', 'On Leave', 0],
];

const DemoDashboard = () => {
  const [scope, setScope] = useState('All workstreams');
  const shown = useMemo(() => projects.filter((p) => scope === 'All workstreams' || p.stream === scope), [scope]);
  const risks = shown.filter((p) => p.risk);
  const unassigned = scope === 'Client delivery' ? 1 : scope === 'Internal systems' ? 2 : 3;
  return <div className="animate-fade-in">
    <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}><div><div className="eyebrow"><Zap size={14} /> Demo workspace</div><h1 className="page-title">Portfolio command center</h1><p className="page-subtitle">Sample operational data — safe to explore without connecting your database.</p></div><span className="badge badge-info">Demo mode</span></div>
    <section className="decision-panel"><div className="decision-panel-title"><div><span>Decision queue</span><small>Resolve these before planning new work</small></div><label className="workstream-filter">Portfolio scope <select value={scope} onChange={(e) => setScope(e.target.value)}>{['All workstreams', 'Pratap AI', 'Vishvas Foundation', 'Recruitment Platform', 'Real Estate', "Sunny's Project"].map((item) => <option key={item}>{item}</option>)}</select></label></div><div className="decision-grid"><div className="decision-item danger"><AlertTriangle size={19}/><div><strong>{risks.length} projects at risk</strong><span>{risks[0]?.name ?? 'No approval or delivery risks detected'}</span></div></div><div className="decision-item"><UserRoundX size={19}/><div><strong>{unassigned} unassigned tasks</strong><span>Assign an owner before the next stand-up</span></div></div><Link to="/ideas" className="decision-item"><Lightbulb size={19}/><div><strong>2 ideas ready to plan</strong><span>AI reporting assistant</span></div><ArrowUpRight size={15}/></Link></div></section>
    <div className="grid grid-cols-4 gap-4 mb-8">{[['Active initiatives', projects.length], ['At-risk delivery', risks.length], ['Portfolio areas', 5], ['Team members', 5]].map(([label, value]) => <div className="stat-card blue" key={String(label)}><div className="stat-value">{value}</div><div className="stat-label">{label}</div><div className="stat-desc">Demo portfolio data</div></div>)}</div>
    <div className="grid grid-cols-3 gap-6"><section className="col-span-2 section-card"><div className="section-card-header"><div className="section-card-title">Portfolio overview</div><span style={{fontSize: '.72rem', color:'var(--text-muted)'}}>{shown.length} initiatives in scope</span></div><table className="data-table"><thead><tr><th>Initiative</th><th>Portfolio area</th><th>Status</th><th>Progress</th></tr></thead><tbody>{shown.map((project) => <tr key={`${project.stream}-${project.name}`}><td><strong style={{fontSize:'.86rem'}}>{project.name}</strong>{project.risk && <span className="badge badge-danger" style={{marginLeft:'.5rem'}}>Needs attention</span>}</td><td>{project.stream}</td><td>{project.status}</td><td><div style={{display:'flex', gap:'.5rem', alignItems:'center'}}><div className="progress-bar" style={{width:60}}><div className="progress-fill" style={{width:`${project.progress}%`}} /></div>{project.progress}%</div></td></tr>)}</tbody></table></section><section className="section-card"><div className="section-card-header"><div className="section-card-title">Immediate focus</div></div><div className="section-card-body"><p style={{color:'var(--text-secondary)',fontSize:'.82rem',lineHeight:1.7}}>Validate the recruitment platform demo. Send BRDs for Export Package Agent and Loan Vending Dashboard. For Vishvas Foundation, benchmark voice models and knowledge-graph RAG quality.</p></div></section></div>
    <section className="capacity-card"><div className="capacity-header"><div><div className="eyebrow"><Users size={13}/> Team capacity</div><h2>Open work by owner</h2><p>Sample workload shows how the real dashboard balances assignments.</p></div></div><div className="capacity-list">{people.map(([name, availability, tasks]) => { const level = Number(tasks) >= 8 ? 'high' : Number(tasks) >= 4 ? 'medium' : 'low'; return <div className="capacity-member" key={String(name)}><div className="avatar">{String(name).charAt(0)}</div><div className="capacity-name"><strong>{name}</strong><span>{availability} · {tasks} open tasks</span></div><div className={`capacity-meter ${level}`}><i style={{width:`${Math.min(Number(tasks) / 8 * 100, 100)}%`}}/></div></div>; })}</div></section>
  </div>;
};
export default DemoDashboard;
