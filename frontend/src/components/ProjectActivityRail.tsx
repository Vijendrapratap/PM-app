import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Bot, Gauge, MessageSquare, Send, UserRound } from 'lucide-react';
import { projectApi, type ProjectActivityEvent } from '../api/projectApi';
import type { Project, ProjectUpdate } from '../types';
import { getErrorMessage } from '../utils/errorMessage';

type RailFilter = 'all' | 'comments' | 'activity';
type UpdateKind = 'Progress update' | 'Blocker or risk' | 'Decision' | 'Comment';

const eventLabel = (value: string) => value.toLowerCase().split('_')
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

const ProjectActivityRail = ({ project, updates, canComment, onRefresh }: {
  project: Project;
  updates: ProjectUpdate[];
  canComment: boolean;
  onRefresh: () => void | Promise<void>;
}) => {
  const [events, setEvents] = useState<ProjectActivityEvent[]>([]);
  const [filter, setFilter] = useState<RailFilter>('all');
  const [comment, setComment] = useState('');
  const [updateKind, setUpdateKind] = useState<UpdateKind>('Progress update');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadEvents = useCallback(async () => {
    try { setEvents(await projectApi.getActivity(project._id)); }
    catch (reason) { setError(getErrorMessage(reason, 'Activity is temporarily unavailable.')); }
    finally { setLoading(false); }
  }, [project._id]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const timeline = useMemo(() => {
    const updateItems = updates.map((update) => ({
      id: `update-${update._id}`,
      kind: update.title === 'Comment' || update.title === 'Project comment' ? 'comment' as const : 'update' as const,
      title: update.title === 'Comment' || update.title === 'Project comment' ? 'Comment added' : update.title,
      description: update.description,
      actor: update.createdBy?.name || 'Team member',
      createdAt: update.createdAt,
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
    return [...updateItems, ...eventItems]
      .filter((item) => filter === 'all' || (filter === 'comments' ? item.kind === 'comment' : item.kind !== 'comment'))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 40);
  }, [events, filter, updates]);

  const submitComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!comment.trim() || saving) return;
    setSaving(true); setError('');
    try {
      const data = new FormData();
      data.append('title', updateKind);
      data.append('description', comment.trim());
      data.append('comments', updateKind);
      await projectApi.addUpdate(project._id, data);
      setComment('');
      await onRefresh();
      await loadEvents();
    } catch (reason) { setError(getErrorMessage(reason, 'Your comment could not be added.')); }
    finally { setSaving(false); }
  };

  return <aside className="project-activity-rail section-card" aria-label="Project updates and comments">
    <header><div><Activity size={16}/><span><strong>Live project log</strong><small>Work, decisions and discussion</small></span></div><b>{timeline.length}</b></header>
    <div className="project-calculated-status"><Gauge size={15}/><div><small>Calculated from tasks</small><strong>{project.status} · {project.progress}%</strong></div><span><i style={{ width: `${project.progress}%` }}/></span></div>
    {canComment && <form className="project-comment-box" onSubmit={submitComment}>
      <div className="project-log-compose-head"><label htmlFor="project-comment">Post to work log</label><select aria-label="Update type" value={updateKind} onChange={(event) => setUpdateKind(event.target.value as UpdateKind)}><option>Progress update</option><option>Blocker or risk</option><option>Decision</option><option>Comment</option></select></div>
      <textarea id="project-comment" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="What changed, what needs attention, or what should the team know?" rows={3}/>
      <footer><small>Your login and posting time are attached automatically.</small><button type="submit" disabled={!comment.trim() || saving}><Send size={13}/>{saving ? 'Posting…' : 'Post update'}</button></footer>
    </form>}
    <div className="project-log-filters" role="tablist" aria-label="Filter project log">
      {(['all', 'comments', 'activity'] as RailFilter[]).map((item) => <button type="button" role="tab" aria-selected={filter === item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} key={item}>{item === 'all' ? 'All' : item === 'comments' ? 'Comments' : 'Work log'}</button>)}
    </div>
    {error && <p className="project-log-error" role="alert">{error}</p>}
    <div className="project-log-list">
      {loading ? <div className="skeleton project-log-skeleton"/> : timeline.length === 0 ? <div className="project-log-empty"><MessageSquare size={18}/><strong>Nothing here yet</strong><span>Comments and work history will appear with clear dates.</span></div> : timeline.map((item) => {
        const date = new Date(item.createdAt);
        return <article className={`project-log-item ${item.kind}`} key={item.id}>
          <span className="project-log-icon">{item.agent ? <Bot size={13}/> : item.kind === 'comment' ? <MessageSquare size={13}/> : <UserRound size={13}/>}</span>
          <div><header><strong>{item.title}</strong><time dateTime={item.createdAt}>{date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</time></header><p>{item.description}</p><small>{item.actor} · {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</small></div>
        </article>;
      })}
    </div>
  </aside>;
};

export default ProjectActivityRail;
