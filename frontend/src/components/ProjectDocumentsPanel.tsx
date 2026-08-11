import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, FileText, FileUp, Link2, Plus, UploadCloud } from 'lucide-react';
import { agentWorkflowApi, type KnowledgeDocument } from '../api/agentWorkflowApi';
import { projectApi } from '../api/projectApi';
import type { Project } from '../types';
import { getErrorMessage } from '../utils/errorMessage';

const normalizedUrl = (value: string) => /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
const hostnameOf = (value: string) => {
  try { return new URL(value).hostname; }
  catch { return value; }
};

const ProjectDocumentsPanel = ({ project, canManage, onRefresh }: {
  project: Project;
  canManage: boolean;
  onRefresh: () => void | Promise<void>;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [knowledgeDocuments, setKnowledgeDocuments] = useState<KnowledgeDocument[]>([]);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setKnowledgeDocuments(await agentWorkflowApi.listDocuments(project._id)); }
    catch (reason) { setError(getErrorMessage(reason, 'Project links could not be loaded.')); }
  }, [project._id]);

  useEffect(() => { void load(); }, [load]);

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length || saving) return;
    setSaving(true); setError('');
    try {
      await projectApi.addDocuments(project._id, Array.from(files).slice(0, 5));
      await onRefresh();
    } catch (reason) { setError(getErrorMessage(reason, 'The documents could not be uploaded.')); }
    finally { setSaving(false); if (inputRef.current) inputRef.current.value = ''; }
  };

  const addLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!linkTitle.trim() || !linkUrl.trim() || saving) return;
    setSaving(true); setError('');
    try {
      const url = normalizedUrl(linkUrl);
      new URL(url);
      await agentWorkflowApi.createDocument(project._id, { documentType: `LINK:${Date.now()}`, title: linkTitle.trim(), content: url });
      setLinkTitle(''); setLinkUrl('');
      await load();
      await onRefresh();
    } catch (reason) { setError(getErrorMessage(reason, 'Enter a valid link and try again.')); }
    finally { setSaving(false); }
  };

  const links = knowledgeDocuments
    .filter((document) => document.documentType.startsWith('LINK:'))
    .map((document) => ({ document, url: document.versions[0]?.content || '' }))
    .filter((item) => item.url);

  return <section className="project-documents-panel section-card">
    <header className="project-documents-head">
      <div><FileText size={17}/><span><strong>Project documents</strong><small>Keep files and reference links in one shared place.</small></span></div>
      <b>{project.documents.length + links.length}</b>
    </header>

    {error && <div className="project-documents-error" role="alert">{error}</div>}

    {canManage && <div className="project-document-actions">
      <button type="button" className="project-upload-action" disabled={saving} onClick={() => inputRef.current?.click()}>
        <span><UploadCloud size={19}/></span><div><strong>{saving ? 'Saving…' : 'Upload documents'}</strong><small>PDF, Word, images, or project files · up to 5 at once</small></div><Plus size={15}/>
      </button>
      <input ref={inputRef} type="file" multiple hidden onChange={(event) => void uploadFiles(event.target.files)}/>

      <form className="project-link-action" onSubmit={addLink}>
        <span><Link2 size={18}/></span>
        <label><small>Link name</small><input value={linkTitle} onChange={(event) => setLinkTitle(event.target.value)} placeholder="Design file or shared folder"/></label>
        <label><small>URL</small><input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://…" inputMode="url"/></label>
        <button disabled={saving || !linkTitle.trim() || !linkUrl.trim()}>Add link</button>
      </form>
    </div>}

    <div className="project-document-list">
      {project.documents.map((document) => <a href={document.url} target="_blank" rel="noreferrer" key={`${document.name}-${document.uploadedAt || document.url}`}>
        <span className="file"><FileUp size={15}/></span><div><strong>{document.name}</strong><small>{document.uploadedAt ? `Uploaded ${new Date(document.uploadedAt).toLocaleDateString()}` : 'Uploaded file'}</small></div><ExternalLink size={14}/>
      </a>)}
      {links.map(({ document, url }) => <a href={url} target="_blank" rel="noreferrer" key={document._id}>
        <span className="link"><Link2 size={15}/></span><div><strong>{document.title}</strong><small>{hostnameOf(url)}</small></div><ExternalLink size={14}/>
      </a>)}
      {!project.documents.length && !links.length && <div className="project-documents-empty"><FileText size={22}/><strong>No documents yet</strong><span>Upload a file or add the first shared link.</span></div>}
    </div>
  </section>;
};

export default ProjectDocumentsPanel;
