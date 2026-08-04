import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowUpRight, BarChart3, CalendarCheck2, CheckCircle2,
  CircleAlert, FolderKanban, ShieldCheck, Target,
} from 'lucide-react';
import { reportApi, type ReportOverview } from '../api/reportApi';
import { getErrorMessage } from '../utils/errorMessage';

const scopeLabel = {
  PERSONAL: 'Personal view',
  MANAGED: 'Managed team',
  ORGANIZATION: 'Organization',
};

const Reports = () => {
  const [report, setReport] = useState<ReportOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    reportApi.overview()
      .then(setReport)
      .catch((reason) => setError(getErrorMessage(reason, 'Reports could not be loaded.')))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="reports-loading"><div className="skeleton"/><div className="skeleton"/><div className="skeleton"/></div>;
  if (!report) return <div className="reports-error"><CircleAlert size={22}/><strong>Reports unavailable</strong><p>{error}</p></div>;

  const { metrics, sources } = report;
  const dailyPlanRate = metrics.dailyPlanCompletion?.planned
    ? Math.round(metrics.dailyPlanCompletion.closed / metrics.dailyPlanCompletion.planned * 100)
    : null;
  const metricCards = [
    { label: 'Active projects', value: metrics.activeProjects, note: 'Currently delivering', icon: FolderKanban, tone: 'blue' },
    { label: 'On track', value: metrics.onTrackProjects, note: 'No active warning', icon: ShieldCheck, tone: 'green' },
    { label: 'At risk', value: metrics.atRiskProjects, note: 'Needs intervention', icon: AlertTriangle, tone: 'amber' },
    { label: 'Completed tasks', value: metrics.completedTasks, note: 'Within your scope', icon: CheckCircle2, tone: 'mint' },
    { label: 'Overdue tasks', value: metrics.overdueTasks, note: 'Past their due date', icon: CalendarCheck2, tone: 'rose' },
    { label: 'Open blockers', value: metrics.activeBlockers, note: 'Still unresolved', icon: CircleAlert, tone: 'violet' },
  ];

  return <div className="reports-page animate-fade-in">
    <header className="reports-hero">
      <div><span><BarChart3 size={14}/>Delivery intelligence</span><h1>Reports</h1><p>Historical performance, exceptions and source-backed totals. Use Today for live execution.</p></div>
      <div className="reports-scope"><Target size={15}/><span><small>Scope</small><strong>{scopeLabel[report.scope]}</strong></span></div>
    </header>

    <section className="reports-metrics" aria-label="Delivery metrics">
      {metricCards.map(({ label, value, note, icon: Icon, tone }) => <article className={`reports-metric ${tone}`} key={label}>
        <span><Icon size={17}/></span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div>
      </article>)}
      {dailyPlanRate !== null && <article className="reports-metric gold">
        <span><CalendarCheck2 size={17}/></span><div><small>Days closed</small><strong>{dailyPlanRate}%</strong><p>{metrics.dailyPlanCompletion?.closed} of {metrics.dailyPlanCompletion?.planned} plans</p></div>
      </article>}
    </section>

    <div className="reports-source-grid">
      <section className="reports-source-panel projects">
        <header><div><FolderKanban size={16}/><span><strong>Projects in scope</strong><small>Active delivery portfolio</small></span></div><b>{sources.projects.length}</b></header>
        <div>{sources.projects.length ? sources.projects.map((project) => <Link to={project.href} key={project.id}><span>{project.name}</span><ArrowUpRight size={14}/></Link>) : <p>No active projects in this scope.</p>}</div>
      </section>
      <section className="reports-source-panel overdue">
        <header><div><CalendarCheck2 size={16}/><span><strong>Overdue work</strong><small>Tasks needing a new decision</small></span></div><b>{sources.overdueTasks.length}</b></header>
        <div>{sources.overdueTasks.length ? sources.overdueTasks.map((task) => <Link to={task.href} key={task.id}><span><strong>{task.title}</strong><small>{task.project}</small></span><ArrowUpRight size={14}/></Link>) : <p>No overdue work. Good shape.</p>}</div>
      </section>
      <section className="reports-source-panel blockers">
        <header><div><CircleAlert size={16}/><span><strong>Open blockers</strong><small>Unresolved delivery constraints</small></span></div><b>{sources.blockers.length}</b></header>
        <div>{sources.blockers.length ? sources.blockers.map((blocker) => <Link to={blocker.href} key={blocker.id}><span>{blocker.summary}</span><ArrowUpRight size={14}/></Link>) : <p>No active blockers in this scope.</p>}</div>
      </section>
    </div>
    <footer className="reports-generated">Generated {new Date(report.generatedAt).toLocaleString()} · Every item links to its source record.</footer>
  </div>;
};

export default Reports;
