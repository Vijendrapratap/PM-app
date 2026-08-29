import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle, CheckCircle2, ExternalLink, FileText, FolderOpen, Link2,
  Paperclip, Pencil, Plus, Trash2, UploadCloud, X,
} from 'lucide-react';
import { documentsLinksApi, type DocumentsLinksProject } from '../api/documentsLinksApi';
import { useAuth } from '../context/AuthContext';
import { canManageDocumentsLinks } from '../utils/roles';
import { getErrorMessage } from '../utils/errorMessage';
import ConfirmDialog from '../components/ConfirmDialog';
import './DocumentsLinks.css';

interface FormState {
  projectName: string;
  liveLink: string;
  privateNotes: string;
  files: File[];
  removedDocumentIds: string[];
}

const emptyForm = (): FormState => ({ projectName: '', liveLink: '', privateNotes: '', files: [], removedDocumentIds: [] });

const ProjectForm = ({ project, saving, onClose, onSave }: {
  project: DocumentsLinksProject | null;
  saving: boolean;
  onClose: () => void;
  onSave: (form: FormState) => Promise<void>;
}) => {
  const [form, setForm] = useState<FormState>(() => project ? {
    projectName: project.projectName,
    liveLink: project.liveLink,
    privateNotes: project.privateNotes || '',
    files: [],
    removedDocumentIds: [],
  } : emptyForm());
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      const url = new URL(form.liveLink);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    } catch {
      setError('Enter a valid live link beginning with http:// or https://.');
      return;
    }
    try {
      await onSave({ ...form, projectName: form.projectName.trim(), liveLink: form.liveLink.trim() });
    } catch (reason) {
      setError(getErrorMessage(reason, 'The project could not be saved. Please try again.'));
    }
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setForm((current) => ({ ...current, files: [...current.files, ...Array.from(list)] }));
    if (fileRef.current) fileRef.current.value = '';
  };

  const visibleDocuments = project?.documents.filter((document) => !form.removedDocumentIds.includes(document.id)) || [];

  return <div className="modal-backdrop" onMouseDown={() => !saving && onClose()}>
    <form className="modal-container documents-links-modal" onSubmit={(event) => void submit(event)} onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-header">
        <div><span className="documents-modal-kicker">Documents &amp; Links</span><h2 className="modal-title">{project ? 'Edit project' : 'Add project'}</h2></div>
        <button type="button" className="icon-btn" onClick={onClose} disabled={saving} aria-label="Close"><X size={18}/></button>
      </div>
      <div className="modal-body documents-links-form">
        {error && <div className="documents-links-message error" role="alert"><AlertCircle size={15}/>{error}</div>}
        <label className="form-group">
          <span className="form-label">Project Name *</span>
          <input className="form-input" required maxLength={160} autoFocus value={form.projectName} onChange={(event) => setForm((current) => ({ ...current, projectName: event.target.value }))} placeholder="e.g. AptuShire"/>
        </label>
        <label className="form-group">
          <span className="form-label">Live Link *</span>
          <span className="documents-link-input"><Link2 size={16}/><input className="form-input" required type="url" value={form.liveLink} onChange={(event) => setForm((current) => ({ ...current, liveLink: event.target.value }))} placeholder="https://example.com"/></span>
        </label>
        <section className="documents-form-files">
          <label className="form-group">
            <span className="form-label">Private IDs / Passwords</span>
            <textarea className="form-input documents-private-notes" maxLength={5000} rows={5} value={form.privateNotes} onChange={(event) => setForm((current) => ({ ...current, privateNotes: event.target.value }))} placeholder="Write IDs, passwords, or other private notes here"/>
            <small className="documents-private-hint">Visible only to CEO, Founder, and Super Admin.</small>
          </label>
          <div className="documents-form-label"><span><Paperclip size={15}/>Documents</span><small>PDF, Office, images, text or ZIP · max 10MB each</small></div>
          <input ref={fileRef} hidden type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.jpg,.jpeg,.png,.gif,.txt" onChange={(event) => addFiles(event.target.files)}/>
          <button type="button" className="documents-upload-button" onClick={() => fileRef.current?.click()} disabled={saving}><UploadCloud size={18}/><span><strong>Add Documents</strong><small>Select one or more files</small></span><Plus size={15}/></button>
          {(visibleDocuments.length > 0 || form.files.length > 0) && <div className="documents-selected-list">
            {visibleDocuments.map((document) => <div key={document.id}><FileText size={16}/><a href={document.url} target="_blank" rel="noreferrer">{document.fileName}</a><button type="button" onClick={() => setForm((current) => ({ ...current, removedDocumentIds: [...current.removedDocumentIds, document.id] }))} disabled={saving}>Remove</button></div>)}
            {form.files.map((file, index) => <div key={`${file.name}-${file.lastModified}-${index}`}><FileText size={16}/><span>{file.name}</span><button type="button" onClick={() => setForm((current) => ({ ...current, files: current.files.filter((_, itemIndex) => itemIndex !== index) }))} disabled={saving}>Remove</button></div>)}
          </div>}
        </section>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving || !form.projectName.trim() || !form.liveLink.trim()}>{saving ? 'Saving…' : 'Save Project'}</button>
      </div>
    </form>
  </div>;
};

const DocumentsLinks = () => {
  const { user } = useAuth();
  const canEdit = canManageDocumentsLinks(user?.role, user?.platformRole);
  const [projects, setProjects] = useState<DocumentsLinksProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<DocumentsLinksProject | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<DocumentsLinksProject | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setProjects(await documentsLinksApi.list()); }
    catch (reason) { setError(getErrorMessage(reason, 'Documents & Links could not be loaded.')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async (form: FormState) => {
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await documentsLinksApi.update(editing.id, form.projectName, form.liveLink, form.privateNotes);
        await Promise.all(form.removedDocumentIds.map((id) => documentsLinksApi.deleteDocument(editing.id, id)));
        if (form.files.length) await documentsLinksApi.addDocuments(editing.id, form.files);
        setNotice('Project updated successfully.');
      } else {
        await documentsLinksApi.create(form.projectName, form.liveLink, form.privateNotes, form.files);
        setNotice('Project added successfully.');
      }
      setEditing(undefined);
      await load();
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    setError('');
    try {
      await documentsLinksApi.remove(deleting.id);
      setDeleting(null);
      setNotice('Project and its documents were deleted.');
      await load();
    } catch (reason) { setError(getErrorMessage(reason, 'The project could not be deleted.')); }
    finally { setSaving(false); }
  };

  return <div className="documents-links-page animate-fade-in">
    <header className="documents-links-header">
      <div><span className="page-eyebrow">Project resources</span><h1 className="page-title">Documents &amp; Links</h1><p className="page-subtitle">A shared directory for project websites, specifications, proposals and working files.</p></div>
      {canEdit && <button type="button" className="btn btn-primary" onClick={() => setEditing(null)}><Plus size={16}/>Add Project</button>}
    </header>

    {notice && <div className="documents-links-message success" role="status"><CheckCircle2 size={15}/><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss"><X size={14}/></button></div>}
    {error && <div className="documents-links-message error" role="alert"><AlertCircle size={15}/><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss"><X size={14}/></button></div>}

    {loading ? <section className="documents-links-loading" aria-label="Loading projects"><div className="skeleton"/><div className="skeleton"/><div className="skeleton"/></section> : projects.length === 0 ? <section className="section-card empty-state">
      <span className="empty-state-icon"><FolderOpen size={28}/></span><h2 className="empty-state-title">No Projects Added Yet</h2><p className="empty-state-desc">Add your first project with its live link and documents.</p>
      {canEdit && <button type="button" className="btn btn-primary" onClick={() => setEditing(null)}><Plus size={16}/>Add Project</button>}
    </section> : <section className="section-card documents-links-table-wrap">
      <table className="data-table documents-links-table">
        <thead><tr><th>S.No</th><th>Project Name</th><th>Live Link</th><th>Documents</th>{canEdit && <th>Private Info</th>}{canEdit && <th>Actions</th>}</tr></thead>
        <tbody>{projects.map((project) => <tr key={project.id}>
          <td data-label="S.No"><span className="documents-serial">{project.serialNumber}</span></td>
          <td data-label="Project Name"><strong className="documents-project-name">{project.projectName}</strong></td>
          <td data-label="Live Link"><a className="documents-live-link" href={project.liveLink} target="_blank" rel="noopener noreferrer">Open Link<ExternalLink size={14}/></a></td>
          <td data-label="Documents">{project.documents.length ? <details className="documents-cell"><summary><Paperclip size={14}/>{project.documents.length} Document{project.documents.length === 1 ? '' : 's'}</summary><div>{project.documents.map((document) => <a key={document.id} href={document.url} target="_blank" rel="noreferrer"><FileText size={14}/><span>{document.fileName}</span><ExternalLink size={12}/></a>)}</div></details> : <span className="documents-none">No documents</span>}</td>
          {canEdit && <td data-label="Private Info"><span className="documents-private-value">{project.privateNotes || 'No private info'}</span></td>}
          {canEdit && <td data-label="Actions"><div className="documents-actions"><button type="button" onClick={() => setEditing(project)}><Pencil size={14}/>Edit</button><button type="button" className="danger" onClick={() => setDeleting(project)}><Trash2 size={14}/>Delete</button></div></td>}
        </tr>)}</tbody>
      </table>
    </section>}

    {editing !== undefined && <ProjectForm project={editing} saving={saving} onClose={() => setEditing(undefined)} onSave={save}/>} 
    {deleting && <ConfirmDialog title="Delete project?" message="Are you sure you want to delete this project? This will also remove its associated documents." confirmLabel="Delete" danger loading={saving} onClose={() => setDeleting(null)} onConfirm={() => void remove()}/>} 
  </div>;
};

export default DocumentsLinks;
