import mongoose, { Document, Schema } from 'mongoose';
import { UserRole } from '../constants/enums';

export interface IUser {
  fullName: string;
  email: string;
  mobileNumber: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
  /** Set at registration; 7-day free trial counts from this timestamp. */
  freeTrialStartedAt?: Date;
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {}

const userSchema = new Schema<IUserDocument>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    mobileNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.LIBRARY_OWNER,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    freeTrialStartedAt: {
      type: Date,
    },
    refreshToken: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<IUserDocument>('User', userSchema);
