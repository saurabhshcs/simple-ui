import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import multer from 'multer';
import { db } from '../config/database';
import { requireAuth } from '../middleware/auth';
import { config } from '../config/index';

const router = Router();

const ALLOWED_MIMETYPES = new Set([
  'application/pdf',
  'image/jpeg', 'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

const storage = multer.diskStorage({
  destination: path.join(config.uploadDir, 'chat'),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_MIMETYPES.has(file.mimetype));
  },
});

async function extractText(filePath: string, mimeType: string): Promise<string | null> {
  try {
    if (mimeType === 'application/pdf') {
      const pdfParse = (await import('pdf-parse')).default;
      const buffer = await fs.readFile(filePath);
      const result = await pdfParse(buffer);
      return result.text;
    }
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/msword') {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mimeType === 'application/vnd.ms-excel') {
      const XLSX = await import('xlsx');
      const workbook = XLSX.readFile(filePath);
      return workbook.SheetNames
        .map((name: string) => XLSX.utils.sheet_to_csv(workbook.Sheets[name]))
        .join('\n\n');
    }
  } catch {
    // Return null if extraction fails — file still usable as attachment
  }
  return null;
}

// POST /api/files/upload
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file provided or file type not allowed' });
    return;
  }

  const extractedText = await extractText(req.file.path, req.file.mimetype);

  const id = uuidv4();
  await db('files').insert({
    id,
    user_id: req.user!.userId,
    filename: req.file.originalname,
    path: req.file.path,
    mime_type: req.file.mimetype,
    size: req.file.size,
    extracted_text: extractedText,
    created_at: Date.now(),
  });

  res.status(201).json({
    fileId: id,
    filename: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
});

// DELETE /api/files/:fileId
router.delete('/:fileId', requireAuth, async (req, res) => {
  const file = await db('files')
    .where({ id: req.params['fileId'], user_id: req.user!.userId })
    .first();
  if (!file) { res.status(404).json({ error: 'File not found' }); return; }

  try { await fs.unlink(file.path); } catch { /* already deleted */ }
  await db('files').where({ id: file.id }).delete();
  res.json({ message: 'File deleted' });
});

// Cleanup job: delete files older than 24 hours every hour
setInterval(async () => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const old = await db('files').where('created_at', '<', cutoff).select('id', 'path');
  for (const f of old) {
    try { await fs.unlink(f.path); } catch { /* already deleted */ }
    await db('files').where({ id: f.id }).delete();
  }
}, 60 * 60 * 1000);

export default router;
