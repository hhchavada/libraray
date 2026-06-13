import crypto from 'crypto';
import QRCode from 'qrcode';
import { ENV } from '../config/env';
import { uploadBufferToCloudinary } from './cloudinary.util';

const CLOUDINARY_QR_FOLDER = 'library-qr-codes';

const QR_RENDER_OPTIONS = {
  errorCorrectionLevel: 'H' as const,
  margin: 2,
  width: 320,
  color: {
    dark: '#1e3a8a',
    light: '#ffffff',
  },
};

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

export const buildLibraryQrShareUrl = (libraryId: string, qrCodeId: string): string =>
  `${ENV.APP_BASE_URL}/scan/qr?libraryId=${libraryId}&qrCodeId=${qrCodeId}`;

export const buildLibraryQrSvgUrl = (libraryId: string, qrCodeId: string): string =>
  `${ENV.APP_BASE_URL}/api/v1/public/scan/qr-svg?libraryId=${libraryId}&qrCodeId=${qrCodeId}`;

/** QR is permanent — only generate once when library has no QR yet. */
export const libraryQrNeedsRegeneration = (
  qrCodeId: string | undefined,
  qrCodePayload: string | undefined
): boolean => !qrCodeId || !qrCodePayload;

export const generateQrScanPngBuffer = async (scanUrl: string): Promise<Buffer> =>
  QRCode.toBuffer(scanUrl, QR_RENDER_OPTIONS);

export const generateQrScanSvg = async (scanUrl: string): Promise<string> =>
  QRCode.toString(scanUrl, { ...QR_RENDER_OPTIONS, type: 'svg' });

export const dataUrlToPngBuffer = (dataUrl: string): Buffer => {
  const base64 = dataUrl.replace(/\s/g, '').replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64, 'base64');
};

export const resolveQrImageBuffer = async (qrCodeImage: string): Promise<Buffer> => {
  if (qrCodeImage.startsWith('data:')) {
    return dataUrlToPngBuffer(qrCodeImage);
  }

  const response = await fetch(qrCodeImage);
  if (!response.ok) {
    throw new Error(`Failed to fetch QR image: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
};

export const generateLibraryQrCode = async (
  libraryId: string,
  libraryName: string,
  options?: { qrCodeId?: string }
): Promise<LibraryQrData> => {
  const qrCodeId =
    options?.qrCodeId ?? `LQR-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  const qrCodeScanUrl = buildLibraryScanUrl(libraryId, qrCodeId);

  const qrCodePayload = JSON.stringify({
    type: 'library',
    libraryId,
    qrCodeId,
    libraryName,
    scanUrl: qrCodeScanUrl,
  });

  // Encode the URL (not JSON) so phone cameras open the registration page on scan.
  const pngBuffer = await generateQrScanPngBuffer(qrCodeScanUrl);

  let cloudinaryUrl: string | undefined;
  try {
    const uploadResult = await uploadBufferToCloudinary(
      pngBuffer,
      CLOUDINARY_QR_FOLDER,
      qrCodeId
    );
    cloudinaryUrl = uploadResult.secure_url;
  } catch (error) {
    console.error('Cloudinary QR upload failed, continuing without remote storage:', error);
  }

  const qrCodeImageUrl = buildLibraryQrImageUrl(libraryId, qrCodeId);

  return {
    qrCodeId,
    qrCodePayload,
    qrCodeScanUrl,
    qrCodeImageUrl,
    qrCodeImage: cloudinaryUrl ?? '',
  };
};
