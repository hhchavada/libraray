import { Request, Response } from 'express';
import { expenseService } from '../services/expense.service';
import { libraryService } from '../services/library.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { MESSAGES } from '../constants/messages';
import { ExpenseCategory, RevenueDateFilter } from '../constants/enums';
import { DateFilter } from '../utils/dateFilter';
import { ApiError } from '../utils/ApiError';
import { getAuthUserId } from '../utils/auth.util';

const verifyLibraryOwnership = async (libraryId: string, userId: string): Promise<void> => {
  const library = await libraryService.getLibraryByOwner(userId);
  if (library._id.toString() !== libraryId) {
    throw new ApiError(403, MESSAGES.FORBIDDEN);
  }
};

const parseExpenseFilter = (filter?: string): DateFilter => {
  const validFilters = Object.values(RevenueDateFilter);
  if (filter && validFilters.includes(filter as RevenueDateFilter)) {
    return filter as DateFilter;
  }
  return RevenueDateFilter.THIS_MONTH;
};

export const expenseController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const { libraryId, expenseDate, description, amount, category } = req.body;
    await verifyLibraryOwnership(libraryId, getAuthUserId(req));

    const expense = await expenseService.createExpense(
      { expenseDate, description, amount, category },
      libraryId,
      getAuthUserId(req)
    );

    res.status(201).json(new ApiResponse(201, MESSAGES.EXPENSE_CREATED, expense));
  }),

  getAll: asyncHandler(async (req: Request, res: Response) => {
    const libraryId = req.query.libraryId as string;
    if (!libraryId) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }
    await verifyLibraryOwnership(libraryId, getAuthUserId(req));

    const filters = {
      category: req.query.category as ExpenseCategory | undefined,
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
      search: req.query.search as string | undefined,
    };

    const pagination = {
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 10,
    };

    const result = await expenseService.getAllExpenses(libraryId, filters, pagination);
    res.status(200).json(new ApiResponse(200, MESSAGES.EXPENSES_FETCHED, result));
  }),

  getSummary: asyncHandler(async (req: Request, res: Response) => {
    const libraryId = req.query.libraryId as string;
    if (!libraryId) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }
    await verifyLibraryOwnership(libraryId, getAuthUserId(req));

    const filter = parseExpenseFilter(req.query.filter as string);
    const summary = await expenseService.getExpenseSummary(libraryId, filter);
    res.status(200).json(new ApiResponse(200, MESSAGES.EXPENSE_SUMMARY_FETCHED, summary));
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const libraryId = req.query.libraryId as string;
    if (!libraryId) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }
    await verifyLibraryOwnership(libraryId, getAuthUserId(req));

    const expense = await expenseService.getExpenseById(req.params.id, libraryId);
    res.status(200).json(new ApiResponse(200, MESSAGES.EXPENSE_FETCHED, expense));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const libraryId = req.query.libraryId as string;
    if (!libraryId) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }
    await verifyLibraryOwnership(libraryId, getAuthUserId(req));

    const expense = await expenseService.updateExpense(req.params.id, libraryId, req.body);
    res.status(200).json(new ApiResponse(200, MESSAGES.EXPENSE_UPDATED, expense));
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    const libraryId = req.query.libraryId as string;
    if (!libraryId) {
      throw new ApiError(400, MESSAGES.VALIDATION_ERROR);
    }
    await verifyLibraryOwnership(libraryId, getAuthUserId(req));

    await expenseService.deleteExpense(req.params.id, libraryId);
    res.status(200).json(new ApiResponse(200, MESSAGES.EXPENSE_DELETED, null));
  }),
};
