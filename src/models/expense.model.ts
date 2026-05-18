import mongoose, { Document, Schema, Types } from 'mongoose';
import { ExpenseCategory } from '../constants/enums';

export interface IExpense {
  library: Types.ObjectId;
  expenseDate: Date;
  description: string;
  amount: number;
  category: ExpenseCategory;
  addedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IExpenseDocument extends IExpense, Document {}

const expenseSchema = new Schema<IExpenseDocument>(
  {
    library: {
      type: Schema.Types.ObjectId,
      ref: 'Library',
      required: true,
    },
    expenseDate: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    category: {
      type: String,
      enum: Object.values(ExpenseCategory),
      required: true,
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

expenseSchema.index({ library: 1, expenseDate: -1 });

export const Expense = mongoose.model<IExpenseDocument>('Expense', expenseSchema);
