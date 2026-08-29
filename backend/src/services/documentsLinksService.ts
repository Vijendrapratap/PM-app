import { documentsLinksRepository } from '../repositories/documentsLinksRepository';
import { deleteFile, getPublicUrl, uploadFile } from '../lib/storage';
import { badRequest, notFound } from '../utils/httpError';
import { logger } from '../config/logger';

interface Actor { id: string; organizationId?: string }

const organizationOf = (actor: Actor): string => {
  if (!actor.organizationId) throw badRequest('Your account is not assigned to an organization');
  return actor.organizationId;
};

const fieldsOf = (input: Record<string, unknown>) => {
  const projectName = typeof input.projectName === 'string' ? input.projectName.trim() : '';
  const liveLink = typeof input.liveLink === 'string' ? input.liveLink.trim() : '';
  if (!projectName) throw badRequest('Project name is required');
  try {
    const url = new URL(liveLink);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch {
    throw badRequest('Live link must be a valid http or https URL');
  }
  return { project_name: projectName, live_link: liveLink };
};

const mapProject = (row: any) => ({
  id: row.id,
  serialNumber: row.serial_number,
  projectName: row.project_name,
  liveLink: row.live_link,
  documents: (row.documents || []).map((document: any) => ({
    id: document.id,
    fileName: document.file_name,
    fileType: document.file_type,
    url: getPublicUrl(document.storage_path),
    createdAt: document.created_at,
  })),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const uploadDocuments = async (projectId: string, files: Express.Multer.File[]) => {
  const uploaded = [];
  try {
    for (const file of files) uploaded.push(await uploadFile(`documents-links/${projectId}`, file));
    await documentsLinksRepository.addDocuments(projectId, uploaded.map((file, index) => ({
      file_name: file.name,
      storage_path: file.storagePath,
      file_type: files[index].mimetype,
    })));
  } catch (error) {
    await Promise.allSettled(uploaded.map((file) => deleteFile(file.storagePath)));
    throw error;
  }
};

const findProject = async (id: string, actor: Actor) => {
  const project = await documentsLinksRepository.findById(id, organizationOf(actor));
  if (!project) throw notFound('Project not found');
  return project;
};

const removeStoredFiles = async (paths: string[]) => {
  const results = await Promise.allSettled(paths.map(deleteFile));
  results.forEach((result) => {
    if (result.status === 'rejected') logger.error('Failed to remove Documents & Links file', { error: result.reason });
  });
};

export const documentsLinksService = {
  async list(actor: Actor) {
    return (await documentsLinksRepository.list(organizationOf(actor))).map(mapProject);
  },

  async create(input: Record<string, unknown>, files: Express.Multer.File[], actor: Actor) {
    const project = await documentsLinksRepository.create({
      organization_id: organizationOf(actor),
      ...fieldsOf(input),
      created_by: actor.id,
    });
    try {
      await uploadDocuments(project.id, files);
    } catch (error) {
      await documentsLinksRepository.delete(project.id, organizationOf(actor));
      throw error;
    }
    return mapProject(await findProject(project.id, actor));
  },

  async update(id: string, input: Record<string, unknown>, actor: Actor) {
    await findProject(id, actor);
    return mapProject(await documentsLinksRepository.update(id, organizationOf(actor), fieldsOf(input)));
  },

  async addDocuments(id: string, files: Express.Multer.File[], actor: Actor) {
    await findProject(id, actor);
    if (!files.length) throw badRequest('Select at least one document');
    await uploadDocuments(id, files);
    return mapProject(await findProject(id, actor));
  },

  async deleteDocument(projectId: string, documentId: string, actor: Actor) {
    await findProject(projectId, actor);
    const document = await documentsLinksRepository.findDocument(documentId, projectId);
    if (!document) throw notFound('Document not found');
    await documentsLinksRepository.deleteDocument(documentId, projectId);
    await removeStoredFiles([document.storage_path]);
  },

  async delete(id: string, actor: Actor) {
    const project = await findProject(id, actor);
    const paths = (project.documents || []).map((document: any) => document.storage_path);
    await documentsLinksRepository.delete(id, organizationOf(actor));
    await removeStoredFiles(paths);
  },
};
