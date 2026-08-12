import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../auth.ts';
import { HttpError } from '../utils.ts';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'server/uploads';

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop() || 'png';
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    cb(null, fileName);
  }
});

const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

export const screenshotsRouter = Router();

screenshotsRouter.post('/', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) throw new HttpError(400, 'No file uploaded');
  res.json({ url: `/uploads/${req.file.filename}` });
});
