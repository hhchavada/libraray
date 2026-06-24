import mongoose from 'mongoose';
import { AdminDateFilter, PlanCategory } from '../constants/enums';

export const toValidObjectIds = (ids: string[]): mongoose.Types.ObjectId[] =>
  ids
    .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

export interface AdminFilters {
  dateFilter: AdminDateFilter;
  dateFrom?: Date;
  dateTo?: Date;
  state?: string;
  city?: string;
  planCategory?: PlanCategory;
  executiveId?: string;
  /** Human-readable library code, e.g. BRD-0001 */
  libraryCode?: string;
  search?: string;
  page: number;
  limit: number;
}

export const getAdminDateRange = (
  filter: AdminDateFilter,
  customFrom?: Date,
  customTo?: Date
): { from: Date; to: Date } => {
  const now = new Date();

  if (filter === AdminDateFilter.CUSTOM_RANGE && customFrom && customTo) {
    const from = new Date(customFrom);
    from.setHours(0, 0, 0, 0);
    const to = new Date(customTo);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  let from: Date;
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  switch (filter) {
    case AdminDateFilter.TODAY:
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
      break;
    case AdminDateFilter.THIS_WEEK: {
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      from = new Date(now);
      from.setDate(now.getDate() - diffToMonday);
      from.setHours(0, 0, 0, 0);
      break;
    }
    case AdminDateFilter.THIS_YEAR:
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      break;
    case AdminDateFilter.THIS_MONTH:
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      break;
  }

  return { from, to };
};

export const parseAdminFilters = (query: Record<string, unknown>): AdminFilters => {
  const validDateFilters = Object.values(AdminDateFilter);
  const rawFilter = String(query.filter ?? AdminDateFilter.THIS_MONTH);
  const dateFilter = validDateFilters.includes(rawFilter as AdminDateFilter)
    ? (rawFilter as AdminDateFilter)
    : AdminDateFilter.THIS_MONTH;

  const dateFrom = query.dateFrom ? new Date(String(query.dateFrom)) : undefined;
  const dateTo = query.dateTo ? new Date(String(query.dateTo)) : undefined;

  const validPlans = Object.values(PlanCategory);
  const rawPlan = query.planCategory ? String(query.planCategory) : undefined;
  const planCategory =
    rawPlan && validPlans.includes(rawPlan as PlanCategory)
      ? (rawPlan as PlanCategory)
      : undefined;

  return {
    dateFilter,
    dateFrom: dateFrom && !isNaN(dateFrom.getTime()) ? dateFrom : undefined,
    dateTo: dateTo && !isNaN(dateTo.getTime()) ? dateTo : undefined,
    state: query.state ? String(query.state).trim() : undefined,
    city: query.city ? String(query.city).trim() : undefined,
    planCategory,
    executiveId: (() => {
      const raw = query.executiveId ? String(query.executiveId).trim() : '';
      return raw && mongoose.Types.ObjectId.isValid(raw) ? raw : undefined;
    })(),
    libraryCode: query.libraryCode ? String(query.libraryCode).trim().toUpperCase() : undefined,
    search: query.search ? String(query.search).trim() : undefined,
    page: Math.max(1, Number(query.page) || 1),
    limit: Math.min(100, Math.max(1, Number(query.limit) || 20)),
  };
};

export const planCategoryFromSeats = (totalSeats: number): PlanCategory => {
  if (totalSeats <= 50) return PlanCategory.SMALL;
  if (totalSeats <= 100) return PlanCategory.MEDIUM;
  if (totalSeats <= 150) return PlanCategory.LARGE;
  return PlanCategory.MEGA;
};
