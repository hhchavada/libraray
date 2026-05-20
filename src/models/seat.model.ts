import mongoose, { Document, Schema, Types } from 'mongoose';
import { SeatStatus, ShiftType } from '../constants/enums';

export interface ISeat {
  library: Types.ObjectId;
  seatNumber: number;
  /** Excel-style column label e.g. A, D */
  gridColumn?: string | null;
  /** Excel-style row label e.g. 3, C */
  gridRow?: string | null;
  gridColumnIndex?: number | null;
  gridRowIndex?: number | null;
  /** Display label e.g. A-C, D-B */
  cellLabel?: string | null;
  status: SeatStatus;
  assignedTo?: Types.ObjectId | null;
  shiftType?: ShiftType | null;
  lockedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISeatDocument extends ISeat, Document {}

const seatSchema = new Schema<ISeatDocument>(
  {
    library: {
      type: Schema.Types.ObjectId,
      ref: 'Library',
      required: true,
    },
    seatNumber: {
      type: Number,
      required: true,
    },
    gridColumn: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    gridRow: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    gridColumnIndex: {
      type: Number,
      default: null,
    },
    gridRowIndex: {
      type: Number,
      default: null,
    },
    cellLabel: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(SeatStatus),
      default: SeatStatus.AVAILABLE,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      default: null,
    },
    shiftType: {
      type: String,
      enum: [...Object.values(ShiftType), null],
      default: null,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

seatSchema.index({ library: 1, seatNumber: 1 }, { unique: true });
seatSchema.index(
  { library: 1, gridColumn: 1, gridRow: 1 },
  {
    unique: true,
    partialFilterExpression: { gridColumn: { $type: 'string' }, gridRow: { $type: 'string' } },
  }
);

export const Seat = mongoose.model<ISeatDocument>('Seat', seatSchema);
