import { randomUUID } from 'crypto';
import { supabase } from '../config/supabase';

const BUCKET = 'project-files';

export interface UploadedFile {
  name: string;
  storagePath: string;
  url: string;
}

export const uploadFile = async (
  folder: string,
  file: Express.Multer.File
): Promise<UploadedFile> => {
  // A plain Date.now() prefix collides whenever two files in the same
  // upload request share a filename (same millisecond -> same path), which
  // makes the second upsert:false write fail as "already exists". A UUID
  // guarantees uniqueness per file regardless of name or timing.
  const storagePath = `${folder}/${randomUUID()}-${file.originalname}`;

  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });

  if (error) {
    throw new Error(`Failed to upload file "${file.originalname}": ${error.message}`);
  }

  return { name: file.originalname, storagePath, url: getPublicUrl(storagePath) };
};

export const uploadFiles = (folder: string, files: Express.Multer.File[]): Promise<UploadedFile[]> =>
  Promise.all(files.map((file) => uploadFile(folder, file)));

export const getPublicUrl = (storagePath: string): string =>
  supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;

export const deleteFile = async (storagePath: string): Promise<void> => {
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) {
    throw new Error(`Failed to delete file "${storagePath}": ${error.message}`);
  }
};
