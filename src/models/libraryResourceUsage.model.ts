import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ILibraryResourceUsage {
  library: Types.ObjectId;
  smsTotal: number;
  smsThisMonth: number;
  whatsappTotal: number;
  whatsappThisMonth: number;
  storageBytes: number;
  estimatedMonthlyCost: number;
  updatedAt: Date;
}

export interface ILibraryResourceUsageDocument extends ILibraryResourceUsage, Document {}

const libraryResourceUsageSchema = new Schema<ILibraryResourceUsageDocument>(
  {
    library: {
      type: Schema.Types.ObjectId,
      ref: 'Library',
      required: true,
      unique: true,
    },
    smsTotal: { type: Number, default: 0, min: 0 },
    smsThisMonth: { type: Number, default: 0, min: 0 },
    whatsappTotal: { type: Number, default: 0, min: 0 },
    whatsappThisMonth: { type: Number, default: 0, min: 0 },
    storageBytes: { type: Number, default: 0, min: 0 },
    estimatedMonthlyCost: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export const LibraryResourceUsage = mongoose.model<ILibraryResourceUsageDocument>(
  'LibraryResourceUsage',
  libraryResourceUsageSchema
);
