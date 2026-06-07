import mongoose from 'mongoose';
import { Member } from '../models/member.model';
import { Expense } from '../models/expense.model';
import { PaymentMode, RevenueDateFilter } from '../constants/enums';
import { getDateRange, DateFilter } from '../utils/dateFilter';

const PLAN_LABELS: Record<string, string> = {
  '1_month': '1 Month',
  '2_months': '2 Months',
  '3_months': '3 Months',
  '6_months': '6 Months',
  '1_year': '1 Year',
};

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const revenueService = {
  async getRevenueSummary(libraryId: string, filter: DateFilter) {
    const { from, to } = getDateRange(filter);
    const libraryObjectId = new mongoose.Types.ObjectId(libraryId);

    const [revenueResult, expenseResult, planResult, recentMembers] = await Promise.all([
      // 1. Total revenue from members created in the period
      Member.aggregate([
        {
          $match: {
            library: libraryObjectId,
            createdAt: { $gte: from, $lte: to },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amountPaid' },
          },
        },
      ]),

      // 2. Total expenses from Expense collection in the period
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
            total: { $sum: '$amount' },
          },
        },
      ]),

      // 3. Revenue grouped by membership plan
      Member.aggregate([
        {
          $match: {
            library: libraryObjectId,
            createdAt: { $gte: from, $lte: to },
            membershipPlan: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: '$membershipPlan',
            memberCount: { $sum: 1 },
            revenue: { $sum: '$amountPaid' },
          },
        },
        { $sort: { revenue: -1 } },
      ]),

      // 4. Recent transactions — last 10 paid members, newest first
      Member.find({
        library: libraryObjectId,
        createdAt: { $gte: from, $lte: to },
        amountPaid: { $gt: 0 },
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('fullName paymentMode amountPaid createdAt'),
    ]);

    const totalRevenue = revenueResult[0]?.total ?? 0;
    const totalExpenses = expenseResult[0]?.total ?? 0;

    const revenueByPlan = planResult.map((p) => ({
      plan: p._id as string,
      planLabel: PLAN_LABELS[p._id as string] ?? p._id,
      memberCount: p.memberCount as number,
      revenue: p.revenue as number,
    }));

    const recentTransactions = recentMembers.map((m) => ({
      name: m.fullName,
      paymentMode: m.paymentMode ?? null,
      amount: m.amountPaid,
    }));

    return {
      revenue: totalRevenue,
      expenses: totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      revenueByPlan,
      recentTransactions,
      filter,
      dateRange: { from, to },
    };
  },

  async getRevenueByPaymentMode(libraryId: string, filter: DateFilter) {
    const { from, to } = getDateRange(filter);
    const libraryObjectId = new mongoose.Types.ObjectId(libraryId);

    const result = await Member.aggregate([
      {
        $match: {
          library: libraryObjectId,
          createdAt: { $gte: from, $lte: to },
          paymentMode: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$paymentMode',
          total: { $sum: '$amountPaid' },
        },
      },
    ]);

    const breakdown: Record<string, number> = {
      [PaymentMode.CASH]: 0,
      [PaymentMode.ONLINE]: 0,
      [PaymentMode.UPI]: 0,
    };

    for (const item of result) {
      if (item._id && breakdown[item._id as string] !== undefined) {
        breakdown[item._id as string] = item.total;
      }
    }

    return {
      cash: breakdown[PaymentMode.CASH],
      online: breakdown[PaymentMode.ONLINE],
      upi: breakdown[PaymentMode.UPI],
      filter,
      dateRange: { from, to },
    };
  },

  async getMonthlyRevenueTrend(libraryId: string) {
    const libraryObjectId = new mongoose.Types.ObjectId(libraryId);
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0);

    const result = await Member.aggregate([
      {
        $match: {
          library: libraryObjectId,
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          revenue: { $sum: '$amountPaid' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const trend: { month: string; revenue: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      const found = result.find((r) => r._id.year === year && r._id.month === month);

      trend.push({
        month: `${MONTH_NAMES[date.getMonth()]} ${year}`,
        revenue: found?.revenue ?? 0,
      });
    }

    return trend;
  },
};

export const parseRevenueFilter = (filter?: string): DateFilter => {
  const validFilters = Object.values(RevenueDateFilter);
  if (filter && validFilters.includes(filter as RevenueDateFilter)) {
    return filter as DateFilter;
  }
  return RevenueDateFilter.THIS_MONTH;
};
