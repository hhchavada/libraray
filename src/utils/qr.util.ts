import crypto from 'crypto';
import QRCode from 'qrcode';
import { ENV } from '../config/env';

export interface LibraryQrData {
  qrCodeId: string;
  qrCodePayload: string;
  qrCodeScanUrl: string;
  qrCodeImageUrl: string;
  qrCodeImage: string;
}

export const buildLibraryScanUrl = (libraryId: string, qrCodeId: string): string =>
  `${ENV.LIBRARY_QR_BASE_URL}?libraryId=${libraryId}&qrCodeId=${qrCodeId}`;

export const buildLibraryQrImageUrl = (libraryId: string, qrCodeId: string): string =>
  `${ENV.APP_BASE_URL}/api/v1/public/scan/qr-image?libraryId=${libraryId}&qrCodeId=${qrCodeId}`;

export const dataUrlToPngBuffer = (dataUrl: string): Buffer => {
  const base64 = dataUrl.replace(/\s/g, '').replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64, 'base64');
};

export const generateLibraryQrCode = async (
  libraryId: string,
  libraryName: string
): Promise<LibraryQrData> => {
  const qrCodeId = `LQR-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  const qrCodeScanUrl = buildLibraryScanUrl(libraryId, qrCodeId);

  const qrCodePayload = JSON.stringify({
    type: 'library',
    libraryId,
    qrCodeId,
    libraryName,
    scanUrl: qrCodeScanUrl,
  });

  // Encode the URL (not JSON) so phone cameras open the registration page on scan.
  let qrCodeImage = await QRCode.toDataURL(qrCodeScanUrl, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 320,
    color: {
      dark: '#1e3a8a',
      light: '#ffffff',
    },
  });

  qrCodeImage = qrCodeImage.replace(/\s/g, '');

  const qrCodeImageUrl = buildLibraryQrImageUrl(libraryId, qrCodeId);

  return { qrCodeId, qrCodePayload, qrCodeScanUrl, qrCodeImageUrl, qrCodeImage };
};
