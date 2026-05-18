import mongoose from 'mongoose';
import { Expense, IExpenseDocument } from '../models/expense.model';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import { ExpenseCategory } from '../constants/enums';
import { getDateRange, DateFilter } from '../utils/dateFilter';

export interface ExpenseFilters {
  category?: ExpenseCategory;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export interface ExpensePagination {
  page?: number;
  limit?: number;
}

export interface CreateExpenseData {
  expenseDate: Date;
  description: string;
  amount: number;
  category: ExpenseCategory;
}

export const expenseService = {
  async createExpense(
    data: CreateExpenseData,
    libraryId: string,
    userId: string
  ): Promise<IExpenseDocument> {
    return Expense.create({
      ...data,
      library: libraryId,
      addedBy: userId,
    });
  },

  async getAllExpenses(
    libraryId: string,
    filters: ExpenseFilters = {},
    pagination: ExpensePagination = {}
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { library: libraryId };

    if (filters.category) {
      query.category = filters.category;
    }
    if (filters.dateFrom || filters.dateTo) {
      query.expenseDate = {};
      if (filters.dateFrom) {
        (query.expenseDate as Record<string, Date>).$gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        (query.expenseDate as Record<string, Date>).$lte = filters.dateTo;
      }
    }
    if (filters.search) {
      query.description = { $regex: filters.search, $options: 'i' };
    }

    const [expenses, totalCount] = await Promise.all([
      Expense.find(query)
        .populate('addedBy', 'fullName email')
        .sort({ expenseDate: -1 })
        .skip(skip)
        .limit(limit),
      Expense.countDocuments(query),
    ]);

    return {
      expenses,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  },

  async getExpenseById(expenseId: string, libraryId: string): Promise<IExpenseDocument> {
    if (!mongoose.Types.ObjectId.isValid(expenseId)) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }

    const expense = await Expense.findOne({ _id: expenseId, library: libraryId }).populate(
      'addedBy',
      'fullName email'
    );

    if (!expense) {
      throw new ApiError(404, MESSAGES.EXPENSE_NOT_FOUND);
    }

    return expense;
  },

  async updateExpense(
    expenseId: string,
    libraryId: string,
    data: Partial<CreateExpenseData>
  ): Promise<IExpenseDocument> {
    if (!mongoose.Types.ObjectId.isValid(expenseId)) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }

    const expense = await Expense.findOneAndUpdate(
      { _id: expenseId, library: libraryId },
      data,
      { new: true, runValidators: true }
    ).populate('addedBy', 'fullName email');

    if (!expense) {
      throw new ApiError(404, MESSAGES.EXPENSE_NOT_FOUND);
    }

    return expense;
  },

  async deleteExpense(expenseId: string, libraryId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(expenseId)) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }

    const expense = await Expense.findOneAndDelete({ _id: expenseId, library: libraryId });
    if (!expense) {
      throw new ApiError(404, MESSAGES.EXPENSE_NOT_FOUND);
    }
  },

  async getExpenseSummary(libraryId: string, filter: DateFilter) {
    const { from, to } = getDateRange(filter);
    const libraryObjectId = new mongoose.Types.ObjectId(libraryId);

    const [totalResult, categoryBreakdown] = await Promise.all([
      Expense.aggregate([
        {
          $match: {
            library: libraryObjectId,
            expenseDate: { $gte: from, $lte: to },
          },
        },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: '$amount' },
            expenseCount: { $sum: 1 },
          },
        },
      ]),
      Expense.aggregate([
        {
          $match: {
            library: libraryObjectId,
            expenseDate: { $gte: from, $lte: to },
          },
        },
        {
          $group: {
            _id: '$category',
            total: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    const byCategory: Record<string, number> = {};
    for (const category of Object.values(ExpenseCategory)) {
      byCategory[category] = 0;
    }
    for (const item of categoryBreakdown) {
      if (item._id) {
        byCategory[item._id as string] = item.total;
      }
    }

    return {
      totalExpenses: totalResult[0]?.totalExpenses ?? 0,
      expenseCount: totalResult[0]?.expenseCount ?? 0,
      byCategory,
      filter,
      dateRange: { from, to },
    };
  },
};
