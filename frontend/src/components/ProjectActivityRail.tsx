import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Bot, Gauge, MessageSquare, Send, UserRound } from 'lucide-react';
import { projectApi, type ProjectActivityEvent } from '../api/projectApi';
import type { DailyReport, Project, ProjectUpdate } from '../types';
import { getErrorMessage } from '../utils/errorMessage';

type RailFilter = 'all' | 'comments' | 'activity';
const eventLabel = (value: string) => value.toLowerCase().split('_')
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

const ProjectActivityRail = ({ project, updates, dailyReports, canComment, onRefresh, standalone = false }: {
  project: Project;
  updates: ProjectUpdate[];
  dailyReports: DailyReport[];
  canComment: boolean;
  onRefresh: () => void | Promise<void>;
  standalone?: boolean;
}) => {
  const [events, setEvents] = useState<ProjectActivityEvent[]>([]);
  const [filter, setFilter] = useState<RailFilter>('all');
  const [comment, setComment] = useState('');
  const [progress, setProgress] = useState(project.progress);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadEvents = useCallback(async () => {
    try { setEvents(await projectApi.getActivity(project._id)); }
    catch (reason) { setError(getErrorMessage(reason, 'Activity is temporarily unavailable.')); }
    finally { setLoading(false); }
  }, [project._id]);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => { setProgress(project.progress); }, [project.progress]);

  const timeline = useMemo(() => {
    const updateItems = updates.map((update) => ({
      id: `update-${update._id}`,
      kind: update.title === 'Comment' || update.title === 'Project comment' ? 'comment' as const : 'worklog' as const,
      title: update.title === 'Comment' || update.title === 'Project comment' ? 'Comment added' : update.title,
      description: update.description,
      actor: update.createdBy?.name || 'Team member',
      createdAt: update.createdAt,
      agent: false,
    }));
    const dailyReportItems = dailyReports.map((report) => ({
      id: `daily-report-${report._id}`,
      kind: 'activity' as const,
      title: 'Daily update',
      description: report.description,
      actor: report.member?.name || report.teamMemberName || report.createdBy?.name || 'Team member',
      createdAt: report.createdAt,
      agent: false,
    }));
    const eventItems = events.filter((event) => !['PROJECT_UPDATED', 'PROJECT_WORK_LOG_UPDATED'].includes(event.eventType)).map((event) => ({
      id: `event-${event._id}`,
      kind: 'activity' as const,
      title: eventLabel(event.eventType),
      description: typeof event.payload.details === 'string' ? event.payload.details : `${event.entityType.toLowerCase()} updated`,
      actor: event.actor?.name || event.actorType,
      createdAt: event.createdAt,
      agent: event.actorType === 'AGENT',
    }));
    return [...updateItems, ...dailyReportItems, ...eventItems]
      .filter((item) => filter === 'all' || (filter === 'comments' ? item.kind === 'comment' : item.kind !== 'comment'))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 40);
  }, [dailyReports, events, filter, updates]);

  const submitComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!comment.trim() || saving) return;
    setSaving(true); setError('');
    try {
      const data = new FormData();
      data.append('title', 'Comment');
      data.append('description', comment.trim());
      data.append('comments', 'Comment');
      await projectApi.addUpdate(project._id, data);
      setComment('');
      await onRefresh();
      await loadEvents();
    } catch (reason) { setError(getErrorMessage(reason, 'Your comment could not be added.')); }
    finally { setSaving(false); }
  };

  const saveProgress = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError('');
    try {
      const value = Math.max(0, Math.min(100, Number(progress)));
      const data = new FormData();
      data.append('title', 'Progress update');
      data.append('description', `Project progress updated to ${value}%.`);
      data.append('progress', String(value));
      await projectApi.addUpdate(project._id, data);
      setProgress(value);
      await onRefresh();
      await loadEvents();
    } catch (reason) { setError(getErrorMessage(reason, 'Project progress could not be updated.')); }
    finally { setSaving(false); }
  };

  return <aside className={`project-activity-rail section-card ${standalone ? 'is-workspace' : ''}`} aria-label="Project updates and comments">
    <header><div><Activity size={16}/><span><strong>Comments & activity</strong></span></div><b>{timeline.length}</b></header>
    <form className="project-calculated-status project-progress-edit" onSubmit={saveProgress}><Gauge size={15}/><label><span>Project progress</span><input aria-label="Project progress percentage" type="number" min="0" max="100" value={progress} disabled={!canComment || saving} onChange={(event) => setProgress(Number(event.target.value))}/><b>%</b></label>{canComment && <button disabled={saving || progress === project.progress}>Save</button>}<span><i style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}/></span></form>
    {canComment && <form className="project-comment-box" onSubmit={submitComment}>
      <label htmlFor="project-comment">Comment</label>
      <textarea id="project-comment" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Write a comment" rows={3}/>
      <footer><button type="submit" disabled={!comment.trim() || saving}><Send size={13}/>{saving ? 'Sending…' : 'Send comment'}</button></footer>
    </form>}
    <div className="project-log-filters" role="tablist" aria-label="Filter project log">
      {(['all', 'comments', 'activity'] as RailFilter[]).map((item) => <button type="button" role="tab" aria-selected={filter === item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} key={item}>{item === 'all' ? 'All' : item === 'comments' ? 'Comments' : 'Work log'}</button>)}
    </div>
    {error && <p className="project-log-error" role="alert">{error}</p>}
    <div className="project-log-list">
      {loading ? <div className="skeleton project-log-skeleton"/> : timeline.length === 0 ? <div className="project-log-empty"><MessageSquare size={18}/><strong>Nothing here yet</strong><span>Comments and work history will appear with clear dates.</span></div> : timeline.map((item) => {
        const date = new Date(item.createdAt);
        return <article className={`project-log-item ${item.kind}`} key={item.id}>
          <span className="project-log-icon">{item.agent ? <Bot size={13}/> : item.kind === 'comment' ? <MessageSquare size={13}/> : item.kind === 'worklog' ? <Activity size={13}/> : <UserRound size={13}/>}</span>
          <div><header><strong>{item.title}</strong><time dateTime={item.createdAt}>{date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</time></header><p>{item.description}</p><small>{item.actor} · {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</small></div>
        </article>;
      })}
    </div>
  </aside>;
};

export default ProjectActivityRail;
