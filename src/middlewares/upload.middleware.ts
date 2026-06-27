import multer from 'multer';
import { ApiError } from '../utils/ApiError';

const storage = multer.memoryStorage();

const excelFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowed = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
  ];
  if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only Excel (.xlsx, .xls) or CSV files are allowed'));
  }
};

export const uploadExcel = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: excelFilter,
}).single('file');

const documentFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowed = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/jpg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (
    allowed.includes(file.mimetype) ||
    file.originalname.match(/\.(jpe?g|png|webp|pdf|docx?)$/i)
  ) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only image, PDF, or Word documents are allowed'));
  }
};

export const uploadDocument = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: documentFilter,
}).single('document');

const profilePictureFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (allowed.includes(file.mimetype) || file.originalname.match(/\.(jpe?g|png|webp)$/i)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only JPEG, PNG, or WebP images are allowed for profile pictures'));
  }
};

export const uploadProfilePicture = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: profilePictureFilter,
}).single('profilePicture');
