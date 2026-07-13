import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

// On Vercel the filesystem is read-only except /tmp, and /tmp isn't shared
// or durable across invocations — attachments written there can vanish
// before a later download request lands on a different container. This
// avoids an outright crash (EROFS) but attachments are not reliable on
// serverless deployments; a persistent deployment or object storage (S3 etc.)
// is needed for that to actually work.
const UPLOAD_DIR = process.env.UPLOAD_DIR || (process.env.VERCEL ? '/tmp/uploads' : 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}.enc`),
});

// The file bytes are already nacl.box ciphertext by the time they reach the
// server, so a 15MB cap on the *encrypted* payload comfortably covers
// reasonably sized attachments.
export const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
});

export function resolveUploadPath(storagePath) {
  return path.resolve(UPLOAD_DIR, path.basename(storagePath));
}

export { UPLOAD_DIR };
