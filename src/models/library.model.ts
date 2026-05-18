import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ILibrary {
  libraryName: string;
  address: string;
  totalSeats: number;
  hasCustomSeatMap: boolean;
  owner: Types.ObjectId;
  isActive: boolean;
  qrCodeId: string;
  qrCodePayload: string;
  qrCodeImage: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILibraryDocument extends ILibrary, Document {}

const librarySchema = new Schema<ILibraryDocument>(
  {
    libraryName: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    totalSeats: {
      type: Number,
      required: true,
      min: 1,
    },
    hasCustomSeatMap: {
      type: Boolean,
      default: false,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    qrCodeId: {
      type: String,
      unique: true,
      sparse: true,
    },
    qrCodePayload: {
      type: String,
    },
    qrCodeImage: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

librarySchema.index({ qrCodeId: 1 }, { unique: true, sparse: true });

export const Library = mongoose.model<ILibraryDocument>('Library', librarySchema);
