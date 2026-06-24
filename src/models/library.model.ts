import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ILibrary {
  /** Human-readable platform ID, e.g. BRD-0001 (not MongoDB _id). */
  libraryCode?: string;
  libraryName: string;
  address: string;
  state?: string;
  city?: string;
  totalSeats: number;
  hasCustomSeatMap: boolean;
  /** Grid width for seat map UI (0-based indices 0..seatMapColumns-1) */
  seatMapColumns?: number;
  /** Grid height for seat map UI */
  seatMapRows?: number;
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
    libraryCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
    },
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
    state: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
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
    seatMapColumns: {
      type: Number,
      min: 1,
      max: 26,
      default: 12,
    },
    seatMapRows: {
      type: Number,
      min: 1,
      max: 26,
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
librarySchema.index({ libraryCode: 1 }, { unique: true, sparse: true });

export const Library = mongoose.model<ILibraryDocument>('Library', librarySchema);
