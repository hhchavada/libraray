import { v2 as cloudinary } from 'cloudinary';
import { ENV } from '../config/env';
import { ApiError } from './ApiError';

cloudinary.config({
  cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
  api_key: ENV.CLOUDINARY_API_KEY,
  api_secret: ENV.CLOUDINARY_API_SECRET,
});

export interface UploadResult {
  secure_url: string;
  public_id: string;
}

export const uploadBufferToCloudinary = async (
  buffer: Buffer,
  folder: string,
  fileName: string
): Promise<UploadResult> => {
  try {
    const result = await new Promise<UploadResult>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder,
            public_id: fileName,
            resource_type: 'image',
            format: 'png',
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve({
                secure_url: result!.secure_url,
                public_id: result!.public_id,
              });
            }
          }
        )
        .end(buffer);
    });

    return result;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new ApiError(500, 'Failed to upload image to Cloudinary');
  }
};

export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new ApiError(500, 'Failed to delete image from Cloudinary');
  }
};
