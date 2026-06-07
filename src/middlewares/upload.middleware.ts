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
