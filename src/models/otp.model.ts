import mongoose, { Document, Schema } from 'mongoose';
import { OtpType } from '../constants/enums';

export interface IOtp {
  email: string;
  otpHash: string;
  type: OtpType;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOtpDocument extends IOtp, Document {}

const otpSchema = new Schema<IOtpDocument>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    otpHash: {
      type: String,
      required: true,
      select: false,
    },
    type: {
      type: String,
      enum: Object.values(OtpType),
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

otpSchema.index({ email: 1, type: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Otp = mongoose.model<IOtpDocument>('Otp', otpSchema);
