import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Clock, Paperclip, CheckCircle2, Plus,
  ExternalLink, Users, Calendar, TrendingUp, Send, ChevronRight, Download, Lock, FileCheck2, Code2, Video
} from 'lucide-react';
import AddUpdateModal from '../components/AddUpdateModal';
import FinishProjectModal from '../components/FinishProjectModal';
import ProjectTaskList from '../components/ProjectTaskList';
import { useProjectDetails } from '../hooks/useProjectDetails';
import { projectApi } from '../api/projectApi';
import { getErrorMessage } from '../utils/errorMessage';
import { useAuth } from '../context/AuthContext';
import { isSuperAdmin } from '../utils/roles';

const STATUSES = ['Planning', 'In Progress', 'Review', 'Testing', 'Blocked', 'On Hold'];

const getStatusBadge = (status: string) => {
  const map: Record<string, string> = {
    'Completed': 'badge-success',
    'Draft': 'badge-neutral',
    'In Progress': 'badge-primary',
    'Review': 'badge-warning',
    'Testing': 'badge-purple',
    'Planning': 'badge-info',
    'Blocked': 'badge-danger',
    'On Hold': 'badge-danger',
  };
  return map[status] ?? 'badge-neutral';
};

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { project, updates, dailyReports, loading, error, refetch } = useProjectDetails(id);
  const [isAddUpdateOpen, setIsAddUpdateOpen] = useState(false);
  const [isFinishOpen, setIsFinishOpen] = useState(false);
  const [reportDrafts, setReportDrafts] = useState<Record<string, { description: string; files: File[] }>>({});
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Quick update form state
  const [quickStatus, setQuickStatus] = useState('In Progress');
  const [quickDoneBy, setQuickDoneBy] = useState('');
  const [quickReport, setQuickReport] = useState('');
  const [quickLink, setQuickLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const documentTypeRef = useRef('project-document');

  const uploadProjectDocuments = async (files: FileList | null) => {
    if (!id || !files?.length) return;
    setUploadingDocs(true);
    try {
      const renamed = Array.from(files).slice(0, 5).map((file) => new File([file], `${documentTypeRef.current}-${file.name}`, { type: file.type }));
      await projectApi.addDocuments(id, renamed);
      await refetch();
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to upload project documents.'));
    } finally {
      setUploadingDocs(false);
      if (documentInputRef.current) documentInputRef.current.value = '';
    }
  };

  const chooseDocument = (type: string) => { documentTypeRef.current = type; documentInputRef.current?.click(); };
  const updateDeliveryLink = async (kind: 'github' | 'demoVideo', current?: string | null) => {
    if (!id) return;
    const label = kind === 'github' ? 'GitHub repository URL' : 'Demo video URL';
    const value = window.prompt(label, current || '');
    if (value === null) return;
    try { await projectApi.update(id, { [kind]: value }); await refetch(); } catch (error) { alert(getErrorMessage(error, `Failed to update ${label}.`)); }
  };

  useEffect(() => {
    if (!project) return;
    setQuickStatus(project.status !== 'Completed' ? project.status : 'In Progress');
    const dates = buildProjectDates(project);
    setSelectedDate(prev => (prev && dates.includes(prev) ? prev : dates[0] ?? ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  const formatDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const buildProjectDates = (projectData = project) => {
    if (!projectData?.startDate) return [];

    const start = new Date(projectData.startDate);
    start.setHours(0, 0, 0, 0);

    const end = projectData.status === 'Completed' && projectData.completionDate
      ? new Date(projectData.completionDate)
      : new Date();
    end.setHours(0, 0, 0, 0);

    if (end < start) return [];

    const dates: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      dates.push(formatDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  };

  const getProjectDates = () => buildProjectDates();

  const groupedReports = dailyReports.reduce((acc: Record<string, typeof dailyReports>, report) => {
    const key = formatDateKey(new Date(report.workDate || report.reportDate));
    if (!acc[key]) acc[key] = [];
    acc[key].push(report);
    return acc;
  }, {});

  const updateDraft = (key: string, next: Partial<{ description: string; files: File[] }>) => {
    setReportDrafts(prev => ({
      ...prev,
      [key]: {
        description: prev[key]?.description ?? '',
        files: prev[key]?.files ?? [],
        ...next,
      },
    }));
  };

  const handleReportFiles = (key: string, files: FileList | null) => {
    if (!files) return;
    updateDraft(key, { files: Array.from(files).slice(0, 5) });
  };

  const saveDailyReport = async (dateKey: string, memberId: string, existingDescription = '') => {
    if (!id) return;
    const key = `${dateKey}-${memberId}`;
    const draft = reportDrafts[key] ?? { description: existingDescription, files: [] };
    if (!draft.description.trim()) {
      alert('Add a description before saving the daily report.');
      return;
    }

    try {
      const data = new FormData();
      data.append('reportDate', dateKey);
      data.append('memberId', memberId);
      data.append('description', draft.description);
      if (draft.files[0]) {
        data.append('documents', draft.files[0]);
      }

      await projectApi.saveDailyReport(id, data);

      setReportDrafts(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

      refetch();
    } catch (err) {
      console.error('Failed to save daily report', err);
      alert(getErrorMessage(err, 'Failed to save daily report. Please try again.'));
    }
  };

  const handleQuickSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickReport.trim() || !id) return;
    setSaving(true);
    try {
      const data = new FormData();
      data.append('title', `Status Update: ${quickStatus}`);
      data.append('description', quickReport);
      data.append('progress', String(project?.progress ?? 0));
      data.append('status', quickStatus);
      data.append('comments', `Done by: ${quickDoneBy || 'Team Member'}`);
      if (quickLink.trim()) {
        data.append('links', JSON.stringify([{ label: 'Reference', url: quickLink }]));
      }
      await projectApi.addUpdate(id, data);
      setQuickReport('');
      setQuickLink('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      refetch();
    } catch (err) {
      console.error('Failed to save update', err);
      alert(getErrorMessage(err, 'Failed to save update. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="skeleton" style={{ height: '2rem', width: '300px', marginBottom: '1rem' }}></div>
        <div className="skeleton" style={{ height: '1rem', width: '200px', marginBottom: '2rem' }}></div>
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 skeleton" style={{ height: '400px', borderRadius: '16px' }}></div>
          <div className="skeleton" style={{ height: '400px', borderRadius: '16px' }}></div>
        </div>
      </div>
    );
  }

  if (!project) return (
    <div className="animate-fade-in" style={{ textAlign: 'center', padding: '4rem' }}>
      <p style={{ color: 'var(--text-muted)' }}>{error ?? 'Project not found.'}</p>
    </div>
  );

  const isCompleted = project.status === 'Completed';
  // Every authenticated user can view every project (transparent portal) -
  // only a Super Admin or an assigned member may edit it. The backend
  // enforces this too (projectService.assertProjectEditAccess) - this is
  // just for the UI, never the only gate.
  const canEdit = isSuperAdmin(user?.role) || project.assignedMembers?.some((m) => m._id === user?._id);
  const currentDateReports = dailyReports.filter(report => formatDateKey(new Date(report.workDate || report.reportDate)) === selectedDate);
  const documentNames = (project.documents || []).map((document) => document.name.toLowerCase());
  const documentationChecklist = [
    { label: 'BRD', help: 'Business requirements, scope and acceptance criteria', done: documentNames.some((name) => /brd|requirement|scope|spec|prd/.test(name)), required: true, type: 'brd' },
    { label: 'Project Overview', help: 'Problem, users, proposed solution and expected outcome', done: documentNames.some((name) => /project-overview|overview/.test(name)), required: true, type: 'project-overview' },
    { label: 'Technical Doc', help: 'Architecture, setup, API and implementation notes', done: documentNames.some((name) => /technical|architecture|readme|api|design|documentation/.test(name)), required: true, type: 'technical-doc' },
    { label: 'GitHub', help: 'Source repository for collaboration and handover', done: Boolean(project.finalLinks?.github), required: false, type: 'github' },
    { label: 'Demo video', help: 'Optional walkthrough for stakeholders', done: Boolean(project.finalLinks?.demoVideo), required: false, type: 'demoVideo' },
  ];
  const documentationDone = documentationChecklist.filter((item) => item.done).length;

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, minWidth: 0, marginRight: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <h1 className="page-title" style={{ fontSize: '1.5rem' }}>{project.name}</h1>
              <span className={`badge ${getStatusBadge(project.status)}`}>{project.status}</span>
              {isCompleted && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--success)', fontWeight: 500 }}>
                  <CheckCircle2 size={14} /> Read-only
                </span>
              )}
            </div>
            <p className="page-subtitle">{project.description || 'No description.'}</p>
          </div>
          {!isCompleted && canEdit && (
            <div style={{ display: 'flex', gap: '0.625rem', flexShrink: 0 }}>
              <button className="btn btn-secondary" onClick={() => setIsAddUpdateOpen(true)}>
                <Plus size={15} /> Advanced Update
              </button>
              <button
                className="btn btn-success"
                onClick={() => setIsFinishOpen(true)}
              >
                <CheckCircle2 size={15} /> Finish Project
              </button>
            </div>
          )}
        </div>
        {!isCompleted && !canEdit && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.875rem', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.625rem 0.875rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            <Lock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            You have read-only access. Only assigned members can edit this project.
          </div>
        )}
      </div>

      {/* Owner visibility: the live work board is always the first project section. */}
      <div className="project-board-primary">
        <ProjectTaskList projectId={project._id} members={project.assignedMembers} canManage={isSuperAdmin(user?.role)} currentUserId={user?._id} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 340px', gap: '1.5rem' }}>
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Quick Update Form */}
          {!isCompleted && canEdit && (
            <div className="section-card">
              <div className="section-card-header">
                <div className="section-card-title">
                  <Send size={16} style={{ color: 'var(--accent-cyan)' }} />
                  Update Project Status
                </div>
              </div>
              <form onSubmit={handleQuickSave} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Project Status</label>
                    <select
                      className="form-select"
                      value={quickStatus}
                      onChange={e => setQuickStatus(e.target.value)}
                    >
                      {STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Done By</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Your name or team member..."
                      value={quickDoneBy}
                      onChange={e => setQuickDoneBy(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Report</label>
                  <textarea
                    className="form-textarea"
                    placeholder="What was completed? What changed? Any blockers or notes..."
                    value={quickReport}
                    onChange={e => setQuickReport(e.target.value)}
                    rows={4}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Reference Link (Optional)</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://github.com/... or any valid URL"
                    value={quickLink}
                    onChange={e => setQuickLink(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {saveSuccess ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--success)', fontWeight: 500 }}>
                      <CheckCircle2 size={15} /> Update saved successfully!
                    </div>
                  ) : <div />}
                  <div style={{ display: 'flex', gap: '0.625rem' }}>
                    <button type="submit" className="btn btn-primary" disabled={saving || !quickReport.trim()}>
                      <Send size={14} />
                      {saving ? 'Saving...' : 'Save Update'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={() => setIsFinishOpen(true)}
                    >
                      <CheckCircle2 size={14} />
                      Finish Project
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          <div className="section-card">
            <div className="section-card-header">
              <div className="section-card-title">
                <Calendar size={16} style={{ color: 'var(--accent-blue)' }} />
                Daily Activity
                <span className="badge badge-neutral" style={{ marginLeft: '0.5rem' }}>{getProjectDates().length}</span>
              </div>
            </div>
            <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1rem' }}>
              {!project.startDate ? (
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                  <div className="empty-state-icon"><Calendar size={22} /></div>
                  <div className="empty-state-title">Project dates are missing</div>
                  <div className="empty-state-desc">Add a start date and expected completion date to enable daily reports.</div>
                </div>
              ) : project.assignedMembers?.length === 0 ? (
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                  <div className="empty-state-icon"><Users size={22} /></div>
                  <div className="empty-state-title">No assigned team members</div>
                  <div className="empty-state-desc">Assign team members to collect daily reports.</div>
                </div>
              ) : getProjectDates().length === 0 ? (
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                  <div className="empty-state-icon"><Calendar size={22} /></div>
                  <div className="empty-state-title">Daily report window is not available yet</div>
                  <div className="empty-state-desc">The project start date is after the current reporting window.</div>
                </div>
              ) : (
                <>
                  <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--surface-1)' }}>
                    <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-2)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Dates
                    </div>
                    <div style={{ maxHeight: '720px', overflowY: 'auto' }}>
                      {getProjectDates().map(dateKey => {
                        const dateLabel = new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        const reportsForDate = groupedReports[dateKey] ?? [];
                        const completeCount = (project.assignedMembers ?? []).filter((member) => reportsForDate.some((report) => report.teamMemberId === member._id || report.member?._id === member._id)).length;
                        const active = selectedDate === dateKey;

                        return (
                          <button
                            key={dateKey}
                            type="button"
                            onClick={() => setSelectedDate(dateKey)}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '0.875rem 1rem',
                              border: 'none',
                              borderBottom: '1px solid var(--border-subtle)',
                              background: active ? 'rgba(59,130,246,0.08)' : 'transparent',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{dateLabel}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{completeCount}/{project.assignedMembers?.length ?? 0} submitted</div>
                            </div>
                            <ChevronRight size={14} style={{ color: active ? 'var(--accent-blue)' : 'var(--text-muted)' }} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--surface-1)' }}>
                    <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {selectedDate ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Select a date'}
                      </div>
                      <span className="badge badge-neutral">{currentDateReports.length} reports</span>
                    </div>

                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                      {selectedDate && (project.assignedMembers ?? []).map((member) => {
                        const key = `${selectedDate}-${member._id}`;
                        const existingReport = currentDateReports.find((report) => report.teamMemberId === member._id || report.member?._id === member._id);
                        const draft = reportDrafts[key] ?? {
                          description: existingReport?.description ?? '',
                          files: [],
                        };

                        return (
                          <div key={key} className={`daily-activity-entry ${existingReport ? 'submitted' : ''}`}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{member.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{member.role || 'Team Member'}</div>
                              </div>
                              <span className={`badge ${existingReport ? 'badge-success' : 'badge-warning'}`}>
                                {existingReport ? 'Submitted' : 'Pending'}
                              </span>
                            </div>

                            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                              <label className="form-label">Description</label>
                              <textarea
                                className="form-textarea"
                                rows={4}
                                placeholder={`What did ${member.name} complete today?`}
                                value={draft.description}
                                onChange={e => updateDraft(key, { description: e.target.value })}
                                disabled={isCompleted || !canEdit}
                              />
                            </div>

                            <div className="form-group daily-attachment" style={{ marginBottom: '0.75rem' }}>
                              <input
                                id={`report-file-${key}`}
                                type="file"
                                hidden
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip"
                                onChange={e => handleReportFiles(key, e.target.files)}
                                disabled={isCompleted || !canEdit}
                              />
                              {!isCompleted && canEdit && <label className="btn btn-secondary" htmlFor={`report-file-${key}`}><Paperclip size={13}/>{draft.files[0]?.name || 'Attach document'}</label>}
                            </div>

                            {existingReport?.documentUrl && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                                <Download size={13} />
                                <a href={existingReport.documentUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>
                                  Download attached document
                                </a>
                              </div>
                            )}

                            {existingReport && existingReport.documents?.length > 0 && !existingReport.documentUrl && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.75rem' }}>
                                {existingReport.documents.map((doc, index) => (
                                  <a
                                    key={index}
                                    href={doc.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ fontSize: '0.72rem', color: 'var(--accent-blue)', background: 'var(--surface-2)', borderRadius: 'var(--radius-full)', padding: '0.25rem 0.55rem', textDecoration: 'none' }}
                                  >
                                    {doc.name}
                                  </a>
                                ))}
                              </div>
                            )}

                            {!isCompleted && canEdit ? (
                              <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={() => saveDailyReport(selectedDate, member._id, existingReport?.description)}>
                                <Send size={14} />
                                {existingReport ? 'Update Report' : 'Save Report'}
                              </button>
                            ) : isCompleted && existingReport ? (
                              <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 500 }}>Read-only after completion</div>
                            ) : !canEdit ? (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Read-only - not an assigned member</div>
                            ) : (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No report submitted</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="section-card">
            <div className="section-card-header">
              <div className="section-card-title">
                <Clock size={16} style={{ color: 'var(--accent-purple)' }} />
                Update History
                <span className="badge badge-neutral" style={{ marginLeft: '0.5rem' }}>{updates.length}</span>
              </div>
            </div>
            <div style={{ padding: '1.5rem' }}>
              {updates.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem' }}>
                  <div className="empty-state-icon"><Clock size={24} /></div>
                  <div className="empty-state-title">No Updates Yet</div>
                  <div className="empty-state-desc">Save a status update to start building the project timeline.</div>
                </div>
              ) : (
                <div className="timeline">
                  {[...updates].reverse().map((update, idx) => (
                    <div key={update._id} className="timeline-item">
                      <div className={`timeline-dot ${idx === 0 ? '' : 'muted'}`}></div>
                      <div className="timeline-card">
                        <div className="timeline-card-header">
                          <div className="timeline-card-title">{update.title}</div>
                          <span className="badge badge-neutral">{update.progress}%</span>
                        </div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                          {update.description}
                        </p>
                        {update.comments && (
                          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontStyle: 'italic' }}>
                            {update.comments}
                          </p>
                        )}
                        {update.links?.length > 0 && (
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                            {update.links.map((link, i) => (
                              <a
                                key={i}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  fontSize: '0.75rem',
                                  color: 'var(--accent-blue)',
                                  background: 'rgba(59,130,246,0.08)',
                                  padding: '0.25rem 0.625rem',
                                  borderRadius: 'var(--radius-full)',
                                  textDecoration: 'none',
                                }}
                              >
                                <ExternalLink size={11} />
                                {link.label || 'Link'}
                              </a>
                            ))}
                          </div>
                        )}
                        {update.documents?.length > 0 && (
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.625rem' }}>
                            {update.documents.map((doc, i) => (
                              <a
                                key={i}
                                href={doc.url}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  fontSize: '0.75rem',
                                  color: 'var(--text-muted)',
                                  background: 'var(--surface-3)',
                                  padding: '0.25rem 0.625rem',
                                  borderRadius: 'var(--radius-full)',
                                  textDecoration: 'none',
                                }}
                              >
                                <Paperclip size={11} />
                                {doc.name}
                              </a>
                            ))}
                          </div>
                        )}
                        <div className="timeline-card-meta">
                          <span>{update.createdBy?.name ?? 'Team Member'}</span>
                          <span>·</span>
                          <span>{new Date(update.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Project created marker */}
                  <div className="timeline-item" style={{ marginBottom: 0 }}>
                    <div className="timeline-dot muted"></div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', paddingTop: '0.125rem' }}>
                      Project created · {new Date(project.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN – Details Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Project Info */}
          <div className="section-card">
            <div className="section-card-header">
              <div className="section-card-title">
                <TrendingUp size={15} style={{ color: 'var(--accent-blue)' }} />
                Project Info
              </div>
            </div>
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Progress */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>Overall Progress</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent-blue)' }}>{project.progress}%</span>
                </div>
                <div className="progress-bar" style={{ height: '6px' }}>
                  <div className="progress-fill" style={{ width: `${project.progress}%` }}></div>
                </div>
              </div>

              <div style={{ height: '1px', background: 'var(--border-subtle)' }}></div>

              {[
                { label: 'Current Status', value: project.status, color: project.status === 'Completed' ? 'var(--success)' : 'var(--accent-blue)' },
                { label: 'Start Date', value: project.startDate ? new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A', color: null },
                { label: 'Expected Completion', value: project.estimatedCompletionDate || project.deadline ? new Date(project.estimatedCompletionDate || project.deadline || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A', color: null },
                { label: 'Priority', value: project.priority, color: project.priority === 'Critical' ? 'var(--danger)' : project.priority === 'High' ? 'var(--priority-high)' : project.priority === 'Medium' ? 'var(--warning)' : 'var(--success)' },
                { label: 'Department', value: project.department || 'General', color: null },
                { label: 'Category', value: project.category || 'Uncategorized', color: null },
                { label: 'Budget', value: project.budget ? `$${project.budget.toLocaleString()}` : 'N/A', color: null },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{item.label}</span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: item.color ?? 'var(--text-secondary)' }}>
                    {item.value}
                  </span>
                </div>
              ))}

              {project.deadline && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Calendar size={13} /> Deadline
                  </span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {new Date(project.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              )}

              {project.completionDate && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <CheckCircle2 size={13} /> Completed
                  </span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--success)' }}>
                    {new Date(project.completionDate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Team Members */}
          <div className="section-card">
            <div className="section-card-header">
              <div className="section-card-title">
                <Users size={15} style={{ color: 'var(--accent-purple)' }} />
                Team
              </div>
              <span className="badge badge-neutral">{project.assignedMembers?.length ?? 0}</span>
            </div>
            <div style={{ padding: '1rem' }}>
              {!project.assignedMembers?.length ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                  No team members assigned.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {project.assignedMembers.map((m, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem', borderRadius: 'var(--radius-sm)', transition: 'background 0.15s' }}>
                      <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '0.75rem', flexShrink: 0 }}>
                        {m.name?.charAt(0) ?? '?'}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.role ?? 'Member'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Documents */}
          <div className="section-card documentation-card">
            <div className="section-card-header"><div className="section-card-title"><FileCheck2 size={15}/>Documents &amp; Links</div><div className="documentation-actions"><span className="badge badge-neutral">{documentationDone}/{documentationChecklist.length}</span></div></div>
            <input ref={documentInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.jpg,.jpeg,.png,.txt" hidden onChange={(event) => uploadProjectDocuments(event.target.files)}/>
            <div className="documentation-list">
              {documentationChecklist.map((item) => <div className={`documentation-item ${item.done ? 'done' : ''}`} key={item.label}>
                <span className="documentation-check">{item.done ? <CheckCircle2 size={14}/> : <span/>}</span><div><strong>{item.label}</strong><small>{item.help}</small></div><em>{item.required ? 'Required' : 'Optional'}</em>{canEdit && !isCompleted && <button className="documentation-add" disabled={uploadingDocs} title={`Add or update ${item.label}`} onClick={() => item.type === 'github' || item.type === 'demoVideo' ? updateDeliveryLink(item.type as 'github' | 'demoVideo', project.finalLinks?.[item.type as 'github' | 'demoVideo']) : chooseDocument(item.type)}><Plus size={13}/></button>}
              </div>)}
              {(project.finalLinks?.github || project.finalLinks?.demoVideo) && <div className="documentation-links">{project.finalLinks.github && <a href={project.finalLinks.github} target="_blank" rel="noreferrer"><Code2 size={13}/>Repository<ExternalLink size={11}/></a>}{project.finalLinks.demoVideo && <a href={project.finalLinks.demoVideo} target="_blank" rel="noreferrer"><Video size={13}/>Demo video<ExternalLink size={11}/></a>}</div>}
            </div>
          </div>

          {project.documents?.length > 0 && (
            <div className="section-card">
              <div className="section-card-header">
                <div className="section-card-title">
                  <Paperclip size={15} style={{ color: 'var(--accent-cyan)' }} />
                  Documents
                </div>
              </div>
              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {project.documents.map((doc, i) => (
                  <a
                    key={i}
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.625rem',
                      background: 'var(--surface-2)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8125rem',
                      color: 'var(--text-secondary)',
                      textDecoration: 'none',
                    }}
                  >
                    <Paperclip size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {!isCompleted && canEdit && (
        <div className="section-card" style={{ marginTop: '1.5rem' }}>
          <div className="section-card-header">
            <div className="section-card-title">
              <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
              Project Completion
            </div>
            <span className="badge badge-neutral">Final step</span>
          </div>
          <div style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
              Mark the project as completed when daily work is done. This will lock the register and move the project to Completed Projects.
            </div>
            <button className="btn btn-success" onClick={() => setIsFinishOpen(true)}>
              <CheckCircle2 size={15} /> Finish Project
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {isAddUpdateOpen && (
        <AddUpdateModal
          projectId={project._id}
          onClose={() => setIsAddUpdateOpen(false)}
          onSuccess={refetch}
        />
      )}
      {isFinishOpen && (
        <FinishProjectModal
          project={project}
          onClose={() => setIsFinishOpen(false)}
          onSuccess={() => {
            setIsFinishOpen(false);
            navigate('/completed');
          }}
        />
      )}
    </div>
  );
};

export default ProjectDetails;
