import multer from 'multer';
import path from 'path';

// Vercel serverless functions have no writable shared disk, so files are buffered
// in memory here and then pushed to Supabase Storage by the service layer.
const storage = multer.memoryStorage();

const ALLOWED_EXTENSIONS = /pdf|doc|docx|xls|xlsx|ppt|pptx|zip|jpg|jpeg|png|gif|txt/;

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const extname = ALLOWED_EXTENSIONS.test(path.extname(file.originalname).toLowerCase());
  const mimetype = ALLOWED_EXTENSIONS.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'));
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});
