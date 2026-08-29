import api, { expectArray } from './index';

export interface DocumentsLinksDocument {
  id: string;
  fileName: string;
  fileType?: string;
  url: string;
  createdAt: string;
}

export interface DocumentsLinksProject {
  id: string;
  serialNumber: number;
  projectName: string;
  liveLink: string;
  documents: DocumentsLinksDocument[];
  createdAt: string;
  updatedAt: string;
}

const formDataOf = (projectName: string, liveLink: string, files: File[]) => {
  const data = new FormData();
  data.append('projectName', projectName);
  data.append('liveLink', liveLink);
  files.forEach((file) => data.append('documents', file));
  return data;
};

export const documentsLinksApi = {
  list: () => api.get<DocumentsLinksProject[]>('/projects/documents-links')
    .then((response) => expectArray<DocumentsLinksProject>(response.data)),
  create: (projectName: string, liveLink: string, files: File[]) =>
    api.post<DocumentsLinksProject>('/projects/documents-links', formDataOf(projectName, liveLink, files), {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((response) => response.data),
  update: (id: string, projectName: string, liveLink: string) =>
    api.put<DocumentsLinksProject>(`/projects/documents-links/${id}`, { projectName, liveLink })
      .then((response) => response.data),
  addDocuments: (id: string, files: File[]) => {
    const data = new FormData();
    files.forEach((file) => data.append('documents', file));
    return api.post<DocumentsLinksProject>(`/projects/documents-links/${id}/documents`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((response) => response.data);
  },
  deleteDocument: (projectId: string, documentId: string) =>
    api.delete(`/projects/documents-links/${projectId}/documents/${documentId}`),
  remove: (id: string) => api.delete(`/projects/documents-links/${id}`),
};
