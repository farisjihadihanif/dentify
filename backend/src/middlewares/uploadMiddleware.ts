import multer from 'multer';
import { MAX_UPLOAD_BYTES } from '../constants/domain';

// Memory storage ONLY: user dental photos are never written to disk (AGENTS.md rule 8)
export const uploadScanImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
  },
}).single('image');
