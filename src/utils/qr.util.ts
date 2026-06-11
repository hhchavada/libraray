import crypto from 'crypto';
import QRCode from 'qrcode';
import { ENV } from '../config/env';
import { uploadBufferToCloudinary } from './cloudinary.util';

export interface LibraryQrData {
  qrCodeId: string;
  qrCodePayload: string;
  qrCodeImage: string;
}

export const generateLibraryQrCode = async (
  libraryId: string,
  libraryName: string
): Promise<LibraryQrData> => {
  const qrCodeId = `LQR-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

  const qrCodePayload = JSON.stringify({
    type: 'library',
    libraryId,
    qrCodeId,
    libraryName,
    scanUrl: `${ENV.APP_BASE_URL}/scan?libraryId=${libraryId}&qrCodeId=${qrCodeId}`,
  });

  const qrBuffer = await QRCode.toBuffer(qrCodePayload, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 320,
    color: {
      dark: '#1e3a8a',
      light: '#ffffff',
    },
  });

  const uploadResult = await uploadBufferToCloudinary(
    qrBuffer,
    'library-qr-codes',
    `qr-${qrCodeId}`
  );

  return { qrCodeId, qrCodePayload, qrCodeImage: uploadResult.secure_url };
};
