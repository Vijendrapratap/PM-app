import { useEffect, useState } from 'react';
import { Activity, Bot, CircleUserRound } from 'lucide-react';
import { projectApi, type ProjectActivityEvent } from '../api/projectApi';
import { getErrorMessage } from '../utils/errorMessage';

const labelFor = (eventType: string) => eventType.toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

const ProjectActivityFeed = ({ projectId }: { projectId: string }) => {
  const [events, setEvents] = useState<ProjectActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    projectApi.getActivity(projectId).then(setEvents).catch((reason) => setError(getErrorMessage(reason, 'We could not load project activity.'))).finally(() => setLoading(false));
  }, [projectId]);
  return <section className="section-card project-activity-feed">
    <header className="section-card-header"><div className="section-card-title"><Activity size={16}/>Activity</div><span className="badge badge-neutral">Immutable history</span></header>
    {error && <p className="project-activity-error" role="alert">{error}</p>}
    {loading ? <div className="project-activity-skeleton skeleton"/> : events.length === 0 ? <div className="project-activity-empty"><Activity size={20}/><strong>No activity yet</strong><span>Meaningful project changes will appear here.</span></div> : <ol>
      {events.map((event) => <li key={event._id}><span>{event.actorType === 'AGENT' ? <Bot size={14}/> : <CircleUserRound size={14}/>}</span><div><strong>{labelFor(event.eventType)}</strong><p>{typeof event.payload.details === 'string' ? event.payload.details : `${event.entityType.toLowerCase()} updated`}</p><small>{event.actor?.name || event.actorType} · {new Date(event.createdAt).toLocaleString()}</small></div></li>)}
    </ol>}
  </section>;
};
export default ProjectActivityFeed;
