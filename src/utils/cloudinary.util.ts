import { v2 as cloudinary } from 'cloudinary';
import { ApiError } from './ApiError';

interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  resource_type?: string;
}

// Hardcoded so production does not depend on .env loading for QR uploads.
const CLOUDINARY_CONFIG = {
  cloud_name: 'damwrwuh4',
  api_key: '668189856678445',
  api_secret: 'MzMEZ7YhOaVWQjpoj1B1QBWj15M',
};

cloudinary.config(CLOUDINARY_CONFIG);

export interface UploadResult {
  secure_url: string;
  public_id: string;
  resource_type: string;
}

export const uploadBufferToCloudinary = async (
  buffer: Buffer,
  folder: string,
  fileName: string,
  options?: { format?: string; resourceType?: 'image' | 'raw' | 'auto' }
): Promise<UploadResult> => {
  try {
    const result = await new Promise<UploadResult>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder,
            public_id: fileName,
            resource_type: options?.resourceType ?? 'image',
            ...(options?.format ? { format: options.format } : {}),
            overwrite: true,
            invalidate: false,
          },
          (error: Error | undefined, result: CloudinaryUploadResponse | undefined) => {
            if (error) {
              reject(error);
            } else if (!result) {
              reject(new Error('Cloudinary upload returned no result'));
            } else {
              resolve({
                secure_url: result.secure_url,
                public_id: result.public_id,
                resource_type: result.resource_type ?? options?.resourceType ?? 'image',
              });
            }
          }
        )
        .end(buffer);
    });

    return result;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new ApiError(500, 'Failed to upload file to Cloudinary');
  }
};

export const deleteFromCloudinary = async (
  publicId: string,
  resourceType: string = 'image'
): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new ApiError(500, 'Failed to delete file from Cloudinary');
  }
};
