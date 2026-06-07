import mongoose, { Document, Schema } from 'mongoose';

export interface ISalesExecutive {
  fullName: string;
  email: string;
  mobileNumber: string;
  assignedStates: string[];
  assignedCities: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISalesExecutiveDocument extends ISalesExecutive, Document {}

const salesExecutiveSchema = new Schema<ISalesExecutiveDocument>(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    mobileNumber: { type: String, required: true, trim: true },
    assignedStates: { type: [String], default: [] },
    assignedCities: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const SalesExecutive = mongoose.model<ISalesExecutiveDocument>(
  'SalesExecutive',
  salesExecutiveSchema
);
