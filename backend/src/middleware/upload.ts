import multer from 'multer';
import path from 'path';
import { badRequest } from '../utils/httpError';

// Vercel serverless functions have no writable shared disk, so files are buffered
// in memory here and then pushed to Supabase Storage by the service layer.
const storage = multer.memoryStorage();

const ALLOWED_EXTENSIONS = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|jpg|jpeg|png|gif|txt)$/i;

// Browsers/OSes report inconsistent mimetypes for the same extension (e.g.
// .doc as application/msword, but some send application/octet-stream), so
// the extension is the only reliable signal here - checking mimetype too
// used to reject legitimate .doc/.xls/.ppt/.txt uploads outright.
const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (ALLOWED_EXTENSIONS.test(path.extname(file.originalname))) {
    cb(null, true);
  } else {
    cb(badRequest('Invalid file type'));
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});
