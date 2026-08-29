export interface DocumentsLinksActor {
  role?: string;
  platformRole?: string;
}

export const canManageDocumentsLinks = (actor: DocumentsLinksActor | undefined): boolean =>
  actor?.platformRole === 'CEO' ||
  ['CEO', 'FOUNDER', 'Founder', 'Super Admin'].includes(actor?.role || '');
