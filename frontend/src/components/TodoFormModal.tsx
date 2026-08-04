import { useRef, useState } from 'react';
import { CalendarClock, ChevronDown, FileText, ListChecks, Paperclip, RefreshCw, X } from 'lucide-react';
import { todoApi, type DailyTodo } from '../api/todoApi';
import { getErrorMessage } from '../utils/errorMessage';
import { useAuth } from '../context/AuthContext';
import { isSuperAdmin } from '../utils/roles';
import type { User, Priority } from '../types';
import { useProjects } from '../hooks/useProjects';
import { projectTaskApi } from '../api/projectTaskApi';
import { createDemoTask, updateDemoTaskDetails } from '../context/demoTasks';

export type PersonalWorkType = DailyTodo['workType'];

const WORK_TYPES: Array<{ key: PersonalWorkType; label: string; help: string; icon: typeof ListChecks }> = [
  { key: 'TASK', label: 'Task', help: 'Something to finish', icon: ListChecks },
  { key: 'MEETING', label: 'Meeting', help: 'A scheduled conversation', icon: CalendarClock },
  { key: 'UPDATE', label: 'Update', help: 'Publish or share progress', icon: FileText },
];

const DOMAIN_OPTIONS: Array<{ value: DailyTodo['domainType']; label: string }> = [
  { value: 'DEVELOPMENT', label: 'Development' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'SALES', label: 'Sales' },
  { value: 'OPERATIONS', label: 'Leadership & operations' },
  { value: 'PERSONAL', label: 'Personal' },
];

const RECURRENCE_OPTIONS: Array<{ value: DailyTodo['recurrence']; label: string }> = [
  { value: 'NONE', label: 'Does not repeat' },
  { value: 'DAILY', label: 'Every day' },
  { value: 'WEEKDAYS', label: 'Every weekday' },
  { value: 'WEEKLY', label: 'Every week' },
];

const toIso = (date: string, time: string) => date && time ? new Date(`${date}T${time}:00`).toISOString() : null;
const localTime = (value: string | null | undefined) => value ? new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';

const TodoFormModal = ({
  members,
  initialWorkType = 'TASK',
  existing,
  onClose,
  onSuccess,
}: {
  members: User[];
  initialWorkType?: PersonalWorkType;
  existing?: DailyTodo | null;
  onClose: () => void;
  onSuccess: (task: DailyTodo) => void | Promise<void>;
}) => {
  const { user, isDemo } = useAuth();
  const { projects } = useProjects();
  const canAssignOthers = isSuperAdmin(user?.role);
  const today = new Date().toLocaleDateString('en-CA');
  const startingType = existing?.workType || initialWorkType;
  const [form, setForm] = useState({
    title: existing?.title || '',
    description: existing?.description || '',
    dueDate: existing?.dueDate || today,
    priority: existing?.priority || 'Medium' as Priority,
    assignedTo: existing?.assignedTo?._id || user?._id || '',
    projectId: '',
    domainType: existing?.domainType || (startingType === 'UPDATE' ? 'MARKETING' : startingType === 'MEETING' ? 'OPERATIONS' : 'DEVELOPMENT') as DailyTodo['domainType'],
    workType: startingType,
    recurrence: existing?.recurrence || 'NONE' as DailyTodo['recurrence'],
    startTime: localTime(existing?.scheduledStart) || (startingType === 'MEETING' ? '10:00' : startingType === 'UPDATE' ? '17:30' : ''),
    endTime: localTime(existing?.scheduledEnd) || (startingType === 'MEETING' ? '10:30' : ''),
    meetingWith: existing?.meetingWith || '',
    channel: existing?.channel || (startingType === 'UPDATE' ? 'LinkedIn' : ''),
  });
  const [showDetails, setShowDetails] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setWorkType = (workType: PersonalWorkType) => setForm((current) => ({
    ...current,
    workType,
    projectId: workType === 'TASK' ? current.projectId : '',
    domainType: workType === 'UPDATE' ? 'MARKETING' : workType === 'MEETING' ? 'OPERATIONS' : current.domainType,
    startTime: workType === 'MEETING' ? current.startTime || '10:00' : workType === 'UPDATE' ? current.startTime || '17:30' : '',
    endTime: workType === 'MEETING' ? current.endTime || '10:30' : '',
    channel: workType === 'UPDATE' ? current.channel || 'LinkedIn' : current.channel,
  }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const project = form.workType === 'TASK' ? projects.find((item) => item._id === form.projectId) || null : null;
      const scheduledStart = toIso(form.dueDate, form.startTime);
      const scheduledEnd = form.workType === 'MEETING' ? toIso(form.dueDate, form.endTime) : null;
      let task: DailyTodo;
      const personalPayload = {
        title: form.title, description: form.description || undefined, dueDate: form.dueDate, priority: form.priority,
        assignedTo: form.assignedTo, domainType: form.domainType, workType: form.workType, recurrence: form.recurrence,
        scheduledStart, scheduledEnd, meetingWith: form.meetingWith || null, channel: form.channel || null,
      };
      if (existing && isDemo) {
        task = updateDemoTaskDetails(existing._id, personalPayload) || existing;
      } else if (existing) {
        task = await todoApi.update(existing._id, personalPayload);
      } else if (isDemo) {
        task = createDemoTask({
          title: form.title,
          description: form.description,
          dueDate: form.dueDate,
          priority: form.priority,
          project: project ? { _id: project._id, name: project.name, department: project.department } : null,
          assignedTo: user ? { _id: user._id, name: user.name } : null,
          domainType: project ? undefined : form.domainType,
          workType: form.workType,
          recurrence: form.recurrence,
          scheduledStart,
          scheduledEnd,
          meetingWith: form.meetingWith || null,
          channel: form.channel || null,
        });
      } else if (project) {
        const created = await projectTaskApi.create(project._id, {
          title: form.title,
          description: form.description,
          dueDate: form.dueDate,
          priority: form.priority,
          assignedTo: form.assignedTo,
        }, files);
        task = {
          ...created,
          domainType: (project.department || '').toUpperCase() === 'MARKETING' ? 'MARKETING' : (project.department || '').toUpperCase() === 'SALES' ? 'SALES' : 'DEVELOPMENT',
          workType: 'TASK', recurrence: 'NONE', scheduledStart: null, scheduledEnd: null, meetingWith: null, channel: null,
          subtasks: [], originalDueDate: created.dueDate, carryForwardCount: 0, daysOverdue: 0,
          source: 'PROJECT', project: { _id: project._id, name: project.name, department: project.department },
        };
      } else {
        task = await todoApi.create(personalPayload, files);
      }
      await onSuccess(task);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, `Failed to save ${form.workType.toLowerCase()}.`));
    } finally {
      setLoading(false);
    }
  };

  const selectedType = WORK_TYPES.find((item) => item.key === form.workType)!;
  const TypeIcon = selectedType.icon;
  const titlePlaceholder = form.workType === 'MEETING'
    ? 'e.g. Weekly delivery review'
    : form.workType === 'UPDATE'
      ? 'e.g. Publish today’s LinkedIn post'
      : 'e.g. Review Operations Studio task board';

  return (
    <div className="modal-backdrop">
      <div className="modal-container work-item-modal">
        <div className="modal-header">
          <div>
            <div className="modal-title"><TypeIcon size={18} /> {existing ? 'Edit' : 'Add'} {selectedType.label.toLowerCase()}</div>
            <div className="modal-subtitle">{existing ? 'Update the schedule, work area or notes.' : 'Capture it quickly now. You can add details only when they help.'}</div>
          </div>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body work-item-form">
            <div className="work-type-picker" aria-label="Work item type">
              {WORK_TYPES.map(({ key, label, help, icon: Icon }) => (
                <button type="button" key={key} className={form.workType === key ? 'active' : ''} onClick={() => setWorkType(key)}>
                  <Icon size={17} /><span><strong>{label}</strong><small>{help}</small></span>
                </button>
              ))}
            </div>

            <div className="form-group">
              <label className="form-label">{form.workType === 'MEETING' ? 'Meeting name' : form.workType === 'UPDATE' ? 'What will you share?' : 'What needs to be done?'} *</label>
              <input autoFocus type="text" className="form-input" required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder={titlePlaceholder} />
            </div>

            {form.workType === 'TASK' && (
              <div className="form-group">
                <label className="form-label">Project <span className="form-optional">optional</span></label>
                <select className="form-select" value={form.projectId} onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value }))}>
                  <option value="">No project · keep in my work</option>
                  {projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}
                </select>
              </div>
            )}

            <div className="work-form-grid">
              {!form.projectId && <div className="form-group"><label className="form-label">Work area</label><select className="form-select" value={form.domainType} onChange={(event) => setForm((current) => ({ ...current, domainType: event.target.value as DailyTodo['domainType'] }))}>{DOMAIN_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>}
              {form.workType === 'UPDATE' && <div className="form-group"><label className="form-label">Channel</label><select className="form-select" value={form.channel} onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value }))}>{['LinkedIn', 'Twitter / X', 'Reddit', 'Instagram', 'Email', 'LinkedIn + Instagram', 'Internal team'].map((channel) => <option key={channel}>{channel}</option>)}</select></div>}
              {form.workType === 'MEETING' && <div className="form-group"><label className="form-label">Meeting with</label><input className="form-input" value={form.meetingWith} onChange={(event) => setForm((current) => ({ ...current, meetingWith: event.target.value }))} placeholder="Person or team" /></div>}
            </div>

            <div className="work-form-grid schedule-grid">
              <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} /></div>
              {form.workType !== 'TASK' && <div className="form-group"><label className="form-label">{form.workType === 'MEETING' ? 'Starts' : 'Publish at'}</label><input type="time" className="form-input" value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} /></div>}
              {form.workType === 'MEETING' && <div className="form-group"><label className="form-label">Ends</label><input type="time" className="form-input" value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} /></div>}
              <div className="form-group"><label className="form-label">Repeats</label><select className="form-select" value={form.recurrence} onChange={(event) => setForm((current) => ({ ...current, recurrence: event.target.value as DailyTodo['recurrence'] }))}>{RECURRENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
            </div>

            <button className="work-more-toggle" type="button" onClick={() => setShowDetails((current) => !current)} aria-expanded={showDetails}><ChevronDown size={15} className={showDetails ? 'open' : ''}/> More details <span>notes, priority, assignee and files</span></button>
            {showDetails && <div className="work-more-panel">
              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" rows={2} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Outcome, talking points, context or links" /></div>
              <div className="work-form-grid">
                <div className="form-group"><label className="form-label">Priority</label><select className="form-select" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as Priority }))}>{['Low', 'Medium', 'High', 'Critical'].map((priority) => <option key={priority}>{priority}</option>)}</select></div>
                {canAssignOthers && <div className="form-group"><label className="form-label">Owner</label><select className="form-select" value={form.assignedTo} onChange={(event) => setForm((current) => ({ ...current, assignedTo: event.target.value }))}>{user && <option value={user._id}>Myself ({user.name})</option>}{members.filter((member) => member._id !== user?._id && member.status !== 'Inactive').map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}</select></div>}
              </div>
              {!existing && <div className="form-group"><label className="form-label">Attachments</label><div className="upload-zone compact" onClick={() => fileRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (event.dataTransfer.files.length) setFiles((current) => [...current, ...Array.from(event.dataTransfer.files)].slice(0, 5)); }}><input ref={fileRef} type="file" multiple hidden onChange={(event) => event.target.files && setFiles((current) => [...current, ...Array.from(event.target.files!)].slice(0, 5))}/><Paperclip size={17}/><p>{files.length ? `${files.length} file${files.length > 1 ? 's' : ''} selected` : 'Add files'}</p></div></div>}
            </div>}
            {form.recurrence !== 'NONE' && <div className="recurrence-note"><RefreshCw size={14}/><span>When completed, this item will return on its next scheduled day.</span></div>}
            {error && <p className="form-error">{error}</p>}
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button><button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : existing ? 'Save changes' : `Add ${selectedType.label}`}</button></div>
        </form>
      </div>
    </div>
  );
};

export default TodoFormModal;
