import mongoose, { Document, Schema, Types } from 'mongoose';
import { SeatStatus, ShiftType } from '../constants/enums';

export interface ISeat {
  library: Types.ObjectId;
  seatNumber: number;
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

export const Seat = mongoose.model<ISeatDocument>('Seat', seatSchema);
