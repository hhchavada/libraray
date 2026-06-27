import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  MemberType,
  MemberStatus,
  ShiftType,
  PaymentStatus,
  PaymentMode,
  MembershipPlan,
} from '../constants/enums';
import { formatMemberLabels } from '../utils/formatLabel.util';

export interface IMember {
  library: Types.ObjectId;
  memberId: string;
  fullName: string;
  email?: string;
  mobileNumber: string;
  courseName?: string;
  memberType: MemberType;
  membershipPlan?: MembershipPlan;
  shiftType: ShiftType;
  startDate: Date;
  endDate?: Date;
  feePerMonth?: number;
  discount: number;
  feesAfterDiscount?: number;
  totalFee?: number;
  amountPaid: number;
  dueAmount: number;
  paymentStatus: PaymentStatus;
  paymentMode?: PaymentMode;
  seat?: Types.ObjectId;
  status: MemberStatus;
  remarks?: string;
  document?: string;
  documentPublicId?: string;
  documentResourceType?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMemberDocument extends IMember, Document {}

const memberSchema = new Schema<IMemberDocument>(
  {
    library: {
      type: Schema.Types.ObjectId,
      ref: 'Library',
      required: true,
    },
    memberId: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    mobileNumber: {
      type: String,
      required: true,
      trim: true,
    },
    courseName: {
      type: String,
      trim: true,
    },
    memberType: {
      type: String,
      enum: Object.values(MemberType),
      required: true,
    },
    membershipPlan: {
      type: String,
      enum: Object.values(MembershipPlan),
    },
    shiftType: {
      type: String,
      enum: Object.values(ShiftType),
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      // Not required — demo members may not have an end date
    },
    feePerMonth: {
      type: Number,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    feesAfterDiscount: {
      type: Number,
      min: 0,
    },
    totalFee: {
      type: Number,
      min: 0,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    dueAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.UNPAID,
    },
    paymentMode: {
      type: String,
      enum: Object.values(PaymentMode),
    },
    seat: {
      type: Schema.Types.ObjectId,
      ref: 'Seat',
    },
    status: {
      type: String,
      enum: Object.values(MemberStatus),
      default: MemberStatus.ACTIVE,
    },
    remarks: {
      type: String,
      trim: true,
    },
    document: {
      type: String,
      trim: true,
    },
    documentPublicId: {
      type: String,
      trim: true,
    },
    documentResourceType: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const formatted = formatMemberLabels(ret as Record<string, unknown>);
        delete formatted.documentPublicId;
        delete formatted.documentResourceType;
        return formatted;
      },
    },
  }
);

memberSchema.index({ library: 1, memberId: 1 }, { unique: true });

export const Member = mongoose.model<IMemberDocument>('Member', memberSchema);
