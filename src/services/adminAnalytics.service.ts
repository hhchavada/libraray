import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import { Library } from '../models/library.model';
import { Member } from '../models/member.model';
import { Seat } from '../models/seat.model';
import { Subscription } from '../models/subscription.model';
import { SalesExecutive } from '../models/salesExecutive.model';
import { LibraryResourceUsage } from '../models/libraryResourceUsage.model';
import {
  LibraryLifecycleStatus,
  LibrarySubscriptionStatus,
  MemberStatus,
  PlanCategory,
  PlanDurationType,
  SeatStatus,
  SubscriptionPaymentStatus,
} from '../constants/enums';
import { AdminFilters, getAdminDateRange, planCategoryFromSeats, resolveOwnerId, toValidObjectIds } from '../utils/adminFilter.util';
import {
  isPaidSubscription,
  resolveLibraryLifecycleStatus,
} from '../utils/libraryLifecycle.util';
import { calculateGstBreakdown } from '../utils/gst.util';
import { PLAN_CATEGORY_LABELS } from '../constants/subscriptionPlans.data';

type LibraryLean = {
  _id: mongoose.Types.ObjectId;
  libraryCode?: string;
  libraryName: string;
  address: string;
  state?: string;
  city?: string;
  totalSeats: number;
  owner: mongoose.Types.ObjectId | { _id: mongoose.Types.ObjectId; fullName: string; email: string; mobileNumber: string; createdAt?: Date };
  isActive: boolean;
  createdAt: Date;
};

interface LibraryContext {
  libraryId: string;
  libraryCode: string;
  libraryName: string;
  state: string;
  city: string;
  totalSeats: number;
  planCategory: PlanCategory;
  activePlanName: string | null;
  planEndDate: Date | null;
  lifecycleStatus: LibraryLifecycleStatus;
  owner: { id: string; fullName: string; email: string; mobileNumber: string; registeredAt?: Date };
}

const durationLabel: Record<string, string> = {
  [PlanDurationType.MONTHLY]: 'Monthly',
  [PlanDurationType.QUARTERLY]: 'Quarterly',
  [PlanDurationType.HALF_YEARLY]: 'Half-Yearly',
  [PlanDurationType.YEARLY]: 'Annual',
};

export const buildLibraryQuery = async (filters: AdminFilters): Promise<mongoose.Types.ObjectId[]> => {
  const query: Record<string, unknown> = {};

  if (filters.state) query.state = filters.state;
  if (filters.city) query.city = filters.city;

  if (filters.executiveId && mongoose.Types.ObjectId.isValid(filters.executiveId)) {
    const exec = await SalesExecutive.findById(filters.executiveId).lean();
    if (exec?.assignedCities?.length) {
      query.city = { $in: exec.assignedCities };
    }
  }

  if (filters.planCategory) {
    const ranges: Record<PlanCategory, { min: number; max: number }> = {
      [PlanCategory.SMALL]: { min: 1, max: 50 },
      [PlanCategory.MEDIUM]: { min: 51, max: 100 },
      [PlanCategory.LARGE]: { min: 101, max: 150 },
      [PlanCategory.MEGA]: { min: 151, max: 10000 },
      [PlanCategory.TEST]: { min: 1, max: 10000 },
    };
    const r = ranges[filters.planCategory];
    query.totalSeats = { $gte: r.min, $lte: r.max };
  }

  if (filters.libraryCode) {
    query.libraryCode = { $regex: filters.libraryCode, $options: 'i' };
  }

  if (filters.search) {
    query.$or = [
      { libraryName: { $regex: filters.search, $options: 'i' } },
      { city: { $regex: filters.search, $options: 'i' } },
      { state: { $regex: filters.search, $options: 'i' } },
      { libraryCode: { $regex: filters.search, $options: 'i' } },
    ];
  }

  const libs = await Library.find(query).select('_id').lean();
  return libs.map((l) => l._id);
};

const buildLibraryContexts = async (libraryIds: mongoose.Types.ObjectId[]): Promise<LibraryContext[]> => {
  if (libraryIds.length === 0) return [];

  const libraries = await Library.find({ _id: { $in: libraryIds } })
    .populate('owner', 'fullName email mobileNumber createdAt')
    .lean<LibraryLean[]>();

  const ownerIds = toValidObjectIds(
    libraries.map((l) => resolveOwnerId(l.owner)).filter((id): id is string => id !== null)
  );

  const subscriptions =
    ownerIds.length === 0
      ? []
      : await Subscription.find({
          userId: { $in: ownerIds },
          paymentStatus: SubscriptionPaymentStatus.PAID,
        })
          .sort({ createdAt: -1 })
          .populate('planId')
          .lean();

  const subsByOwner = new Map<string, typeof subscriptions>();
  for (const sub of subscriptions) {
    const key = sub.userId.toString();
    if (!subsByOwner.has(key)) subsByOwner.set(key, []);
    subsByOwner.get(key)!.push(sub);
  }

  return libraries.map((lib) => {
    const ownerDoc =
      typeof lib.owner === 'object' && lib.owner && 'fullName' in lib.owner ? lib.owner : null;
    const ownerId = resolveOwnerId(lib.owner) ?? '';
    const ownerSubs = subsByOwner.get(ownerId) ?? [];
    const latestPaid = ownerSubs[0];
    const activePaid = ownerSubs.find(
      (s) =>
        s.status === LibrarySubscriptionStatus.ACTIVE &&
        s.endDate &&
        new Date(s.endDate) >= new Date()
    );

    const planDoc = latestPaid?.planId as { category?: PlanCategory; name?: string } | null;
    const planCategory =
      planDoc?.category ?? planCategoryFromSeats(lib.totalSeats);

    const lifecycleStatus = resolveLibraryLifecycleStatus({
      hasPaidSubscription: ownerSubs.some(isPaidSubscription),
      endDate: activePaid?.endDate ?? latestPaid?.endDate,
      status: activePaid?.status ?? latestPaid?.status,
    });

    return {
      libraryId: lib._id.toString(),
      libraryCode: lib.libraryCode ?? '—',
      libraryName: lib.libraryName,
      state: lib.state ?? 'Unknown',
      city: lib.city ?? 'Unknown',
      totalSeats: lib.totalSeats,
      planCategory,
      activePlanName: activePaid?.planId
        ? ((activePaid.planId as { name?: string }).name ?? planDoc?.name ?? null)
        : (planDoc?.name ?? null),
      planEndDate: activePaid?.endDate ?? latestPaid?.endDate ?? null,
      lifecycleStatus,
      owner: ownerDoc
        ? {
            id: ownerDoc._id.toString(),
            fullName: ownerDoc.fullName,
            email: ownerDoc.email,
            mobileNumber: ownerDoc.mobileNumber,
            registeredAt: ownerDoc.createdAt,
          }
        : { id: ownerId, fullName: '—', email: '', mobileNumber: '' },
    };
  });
};

const growthSeries = async (
  libraryIds: mongoose.Types.ObjectId[],
  from: Date,
  to: Date,
  granularity: 'day' | 'month' | 'year'
) => {
  const dateFormat =
    granularity === 'day' ? '%Y-%m-%d' : granularity === 'month' ? '%Y-%m' : '%Y';

  const [libraries, members, seats] = await Promise.all([
    Library.aggregate([
      { $match: { _id: { $in: libraryIds }, createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: { $dateToString: { format: dateFormat, date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Member.aggregate([
      { $match: { library: { $in: libraryIds }, createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: { $dateToString: { format: dateFormat, date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Seat.aggregate([
      { $match: { library: { $in: libraryIds }, createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: { $dateToString: { format: dateFormat, date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return { libraries, members, seats };
};

export const adminAnalyticsService = {
  async getFilterOptions() {
    const [states, cities, executives] = await Promise.all([
      Library.distinct('state', { state: { $exists: true, $ne: '' } }),
      Library.distinct('city', { city: { $exists: true, $ne: '' } }),
      SalesExecutive.find({ isActive: true }).select('fullName assignedCities assignedStates').lean(),
    ]);

    return {
      dateFilters: ['today', 'this_week', 'this_month', 'this_year', 'custom_range'],
      states: states.filter(Boolean).sort(),
      cities: cities.filter(Boolean).sort(),
      libraries: (
        await Library.find({ libraryCode: { $exists: true, $ne: '' } })
          .select('libraryCode libraryName')
          .sort({ libraryCode: 1 })
          .lean()
      ).map((l) => ({
        id: l._id.toString(),
        libraryCode: l.libraryCode ?? '',
        libraryName: l.libraryName,
      })),
      planCategories: Object.values(PlanCategory).map((c) => ({
        value: c,
        label: PLAN_CATEGORY_LABELS[c],
      })),
      executives: executives.map((e) => ({
        id: e._id.toString(),
        fullName: e.fullName,
        assignedCities: e.assignedCities,
        assignedStates: e.assignedStates,
      })),
    };
  },

  async getCitiesByState(state: string) {
    const cities = await Library.distinct('city', {
      state,
      city: { $exists: true, $ne: '' },
    });
    return cities.filter(Boolean).sort();
  },

  async getDashboardSummary(filters: AdminFilters) {
    const { from, to } = getAdminDateRange(filters.dateFilter, filters.dateFrom, filters.dateTo);
    const libraryIds = await buildLibraryQuery(filters);
    const contexts = await buildLibraryContexts(libraryIds);
    const ownerIds = contexts.map((c) => c.owner.id);

    const prevFrom = new Date(from);
    const prevTo = new Date(from);
    prevTo.setMilliseconds(-1);
    const rangeMs = to.getTime() - from.getTime();
    prevFrom.setTime(from.getTime() - rangeMs);

    const [
      paidInRange,
      paidPrevRange,
      activeSubs,
      expiredSubs,
      lifecycleCounts,
      memberRevenue,
    ] = await Promise.all([
      Subscription.aggregate([
        {
          $match: {
            userId: { $in: toValidObjectIds(ownerIds) },
            paymentStatus: SubscriptionPaymentStatus.PAID,
            createdAt: { $gte: from, $lte: to },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Subscription.aggregate([
        {
          $match: {
            userId: { $in: toValidObjectIds(ownerIds) },
            paymentStatus: SubscriptionPaymentStatus.PAID,
            createdAt: { $gte: prevFrom, $lte: prevTo },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Subscription.countDocuments({
        userId: { $in: toValidObjectIds(ownerIds) },
        status: LibrarySubscriptionStatus.ACTIVE,
        paymentStatus: SubscriptionPaymentStatus.PAID,
        endDate: { $gt: new Date() },
      }),
      Subscription.countDocuments({
        userId: { $in: toValidObjectIds(ownerIds) },
        status: LibrarySubscriptionStatus.EXPIRED,
      }),
      Promise.resolve(
        contexts.reduce(
          (acc, c) => {
            acc[c.lifecycleStatus] = (acc[c.lifecycleStatus] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        )
      ),
      Member.aggregate([
        { $match: { library: { $in: libraryIds } } },
        { $group: { _id: null, total: { $sum: '$amountPaid' }, due: { $sum: '$dueAmount' } } },
      ]),
    ]);

    const totalRevenue = paidInRange[0]?.total ?? 0;
    const prevRevenue = paidPrevRange[0]?.total ?? 0;
    const revenueGrowth =
      prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 10000) / 100 : 0;

    const mrrResult = await Subscription.aggregate([
      {
        $match: {
          userId: { $in: toValidObjectIds(ownerIds) },
          status: LibrarySubscriptionStatus.ACTIVE,
          paymentStatus: SubscriptionPaymentStatus.PAID,
          endDate: { $gt: new Date() },
        },
      },
      { $lookup: { from: 'subscriptionplans', localField: 'planId', foreignField: '_id', as: 'plan' } },
      { $unwind: '$plan' },
      {
        $group: {
          _id: null,
          mrr: {
            $sum: { $divide: ['$amount', '$plan.durationMonths'] },
          },
        },
      },
    ]);

    const mrr = Math.round(mrrResult[0]?.mrr ?? 0);
    const arr = mrr * 12;

    return {
      filters,
      dateRange: { from, to },
      kpis: {
        totalRevenue,
        monthlyRevenue: mrr,
        annualRevenue: arr,
        activeSubscriptions: activeSubs,
        expiredSubscriptions: expiredSubs,
        revenueGrowthPercent: revenueGrowth,
        subscriptionGrowthPercent: 0,
        memberFeeRevenue: memberRevenue[0]?.total ?? 0,
        memberFeeDue: memberRevenue[0]?.due ?? 0,
      },
      libraryStatus: {
        demo: lifecycleCounts[LibraryLifecycleStatus.DEMO] ?? 0,
        active: lifecycleCounts[LibraryLifecycleStatus.ACTIVE] ?? 0,
        gracePeriod: lifecycleCounts[LibraryLifecycleStatus.GRACE_PERIOD] ?? 0,
        terminated: lifecycleCounts[LibraryLifecycleStatus.TERMINATED] ?? 0,
      },
      totalLibraries: contexts.length,
    };
  },

  async getRevenueAnalytics(filters: AdminFilters) {
    const { from, to } = getAdminDateRange(filters.dateFilter, filters.dateFrom, filters.dateTo);
    const libraryIds = await buildLibraryQuery(filters);
    const contexts = await buildLibraryContexts(libraryIds);
    const ownerIds = toValidObjectIds(contexts.map((c) => c.owner.id));

    const paidSubs = await Subscription.find({
      userId: { $in: ownerIds },
      paymentStatus: SubscriptionPaymentStatus.PAID,
      createdAt: { $gte: from, $lte: to },
    })
      .populate('planId')
      .lean();

    const byDuration: Record<string, { subscriptions: number; revenue: number }> = {};
    for (const dt of Object.values(PlanDurationType)) {
      byDuration[durationLabel[dt]] = { subscriptions: 0, revenue: 0 };
    }

    const byLocation: Record<string, Record<string, number>> = {};

    for (const sub of paidSubs) {
      const plan = sub.planId as { durationType?: string } | null;
      const label = plan?.durationType ? durationLabel[plan.durationType] ?? plan.durationType : 'Other';
      if (!byDuration[label]) byDuration[label] = { subscriptions: 0, revenue: 0 };
      byDuration[label].subscriptions += 1;
      byDuration[label].revenue += sub.amount;

      const ctx = contexts.find((c) => c.owner.id === sub.userId.toString());
      if (ctx) {
        if (!byLocation[ctx.state]) byLocation[ctx.state] = {};
        byLocation[ctx.state][ctx.city] = (byLocation[ctx.state][ctx.city] ?? 0) + sub.amount;
      }
    }

    const revenueByLocation = Object.entries(byLocation).map(([state, cities]) => ({
      state,
      cities: Object.entries(cities).map(([city, revenue]) => ({ city, revenue })),
      totalRevenue: Object.values(cities).reduce((s, v) => s + v, 0),
    }));

    return {
      filters,
      dateRange: { from, to },
      bySubscriptionType: Object.entries(byDuration).map(([type, data]) => ({
        type,
        ...data,
      })),
      revenueByLocation: revenueByLocation.sort((a, b) => b.totalRevenue - a.totalRevenue),
    };
  },

  async getGrowthAnalytics(filters: AdminFilters) {
    const { from, to } = getAdminDateRange(filters.dateFilter, filters.dateFrom, filters.dateTo);
    const libraryIds = await buildLibraryQuery(filters);

    const [totalLibraries, activeLibraries, totalMembers, activeMembers, totalSeats, bookedSeats] =
      await Promise.all([
        Library.countDocuments({ _id: { $in: libraryIds } }),
        Library.countDocuments({ _id: { $in: libraryIds }, isActive: true }),
        Member.countDocuments({ library: { $in: libraryIds } }),
        Member.countDocuments({ library: { $in: libraryIds }, status: MemberStatus.ACTIVE }),
        Seat.countDocuments({ library: { $in: libraryIds } }),
        Seat.countDocuments({ library: { $in: libraryIds }, status: SeatStatus.BOOKED }),
      ]);

    const [daily, monthly, yearly] = await Promise.all([
      growthSeries(libraryIds, from, to, 'day'),
      growthSeries(libraryIds, from, to, 'month'),
      growthSeries(
        libraryIds,
        new Date(new Date().getFullYear() - 4, 0, 1),
        to,
        'year'
      ),
    ]);

    const subscriptionTrend = await Subscription.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          paymentStatus: SubscriptionPaymentStatus.PAID,
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          newSubscriptions: { $sum: 1 },
          revenue: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      filters,
      dateRange: { from, to },
      libraryGrowth: {
        total: totalLibraries,
        active: activeLibraries,
        charts: { daily: daily.libraries, monthly: monthly.libraries, yearly: yearly.libraries },
      },
      studentGrowth: {
        total: totalMembers,
        active: activeMembers,
        charts: { daily: daily.members, monthly: monthly.members, yearly: yearly.members },
      },
      seatGrowth: {
        total: totalSeats,
        occupied: bookedSeats,
        vacant: totalSeats - bookedSeats,
        charts: { daily: daily.seats, monthly: monthly.seats, yearly: yearly.seats },
      },
      subscriptionGrowth: {
        charts: { monthly: subscriptionTrend },
      },
    };
  },

  async getLibraryStatus(filters: AdminFilters) {
    const libraryIds = await buildLibraryQuery(filters);
    const contexts = await buildLibraryContexts(libraryIds);

    const grouped: Record<LibraryLifecycleStatus, LibraryContext[]> = {
      [LibraryLifecycleStatus.DEMO]: [],
      [LibraryLifecycleStatus.ACTIVE]: [],
      [LibraryLifecycleStatus.GRACE_PERIOD]: [],
      [LibraryLifecycleStatus.TERMINATED]: [],
    };

    for (const ctx of contexts) {
      grouped[ctx.lifecycleStatus].push(ctx);
    }

    return {
      summary: {
        demo: grouped[LibraryLifecycleStatus.DEMO].length,
        active: grouped[LibraryLifecycleStatus.ACTIVE].length,
        gracePeriod: grouped[LibraryLifecycleStatus.GRACE_PERIOD].length,
        terminated: grouped[LibraryLifecycleStatus.TERMINATED].length,
      },
      libraries: grouped,
    };
  },

  async getTransactions(filters: AdminFilters) {
    const { from, to } = getAdminDateRange(filters.dateFilter, filters.dateFrom, filters.dateTo);
    const libraryIds = await buildLibraryQuery(filters);
    const contexts = await buildLibraryContexts(libraryIds);
    const ownerMap = new Map(contexts.map((c) => [c.owner.id, c]));

    const query: Record<string, unknown> = {
      paymentStatus: SubscriptionPaymentStatus.PAID,
      createdAt: { $gte: from, $lte: to },
    };

    if (contexts.length > 0) {
      query.userId = { $in: toValidObjectIds(contexts.map((c) => c.owner.id)) };
    } else {
      return { transactions: [], totalCount: 0, totalPages: 0, currentPage: filters.page };
    }

    const skip = (filters.page - 1) * filters.limit;
    const [subs, totalCount] = await Promise.all([
      Subscription.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(filters.limit)
        .populate('planId')
        .populate('userId', 'fullName email')
        .lean(),
      Subscription.countDocuments(query),
    ]);

    const transactions = subs.map((sub) => {
      const ctx = ownerMap.get(sub.userId.toString());
      const plan = sub.planId as { name?: string } | null;
      const gst =
        sub.taxableAmount != null
          ? {
              taxableAmount: sub.taxableAmount,
              gstAmount: sub.gstAmount ?? 0,
              razorpayFee: sub.razorpayFee ?? 0,
              razorpayGst: sub.razorpayGst ?? 0,
              netSettlementAmount: sub.netSettlementAmount ?? 0,
            }
          : calculateGstBreakdown(sub.amount);

      return {
        transactionId: sub.razorpayPaymentId ?? sub.razorpayOrderId,
        libraryCode: ctx?.libraryCode ?? '—',
        libraryName: ctx?.libraryName ?? '—',
        ownerName: (sub.userId as { fullName?: string })?.fullName ?? '—',
        paymentDate: sub.createdAt,
        planName: plan?.name ?? '—',
        grossAmount: sub.amount,
        ...gst,
        paymentStatus: sub.paymentStatus,
      };
    });

    return {
      transactions,
      totalCount,
      totalPages: Math.ceil(totalCount / filters.limit),
      currentPage: filters.page,
    };
  },

  async getResourceUsage(filters: AdminFilters) {
    const libraryIds = await buildLibraryQuery(filters);
    const contexts = await buildLibraryContexts(libraryIds);

    const usageDocs = await LibraryResourceUsage.find({
      library: { $in: libraryIds },
    }).lean();
    const usageMap = new Map(usageDocs.map((u) => [u.library.toString(), u]));

    const memberCounts = await Member.aggregate([
      { $match: { library: { $in: libraryIds } } },
      { $group: { _id: '$library', count: { $sum: 1 } } },
    ]);
    const memberMap = new Map(memberCounts.map((m) => [m._id.toString(), m.count]));

    const rows = contexts.map((ctx) => {
      const usage = usageMap.get(ctx.libraryId);
      return {
        libraryCode: ctx.libraryCode,
        libraryName: ctx.libraryName,
        planType: ctx.activePlanName ?? PLAN_CATEGORY_LABELS[ctx.planCategory],
        studentsCount: memberMap.get(ctx.libraryId) ?? 0,
        seatsCount: ctx.totalSeats,
        smsSent: usage?.smsTotal ?? 0,
        whatsappMessagesSent: usage?.whatsappTotal ?? 0,
        databaseSize: usage?.storageBytes ?? 0,
        estimatedMonthlyCost: usage?.estimatedMonthlyCost ?? 0,
      };
    });

    return rows.sort((a, b) => b.estimatedMonthlyCost - a.estimatedMonthlyCost);
  },

  async getExecutivePerformance(_filters: AdminFilters) {
    const executives = await SalesExecutive.find({ isActive: true }).lean();
    const allLibraries = await Library.find().lean();
    const allContexts = await buildLibraryContexts(allLibraries.map((l) => l._id));

    const leaderboard = await Promise.all(
      executives.map(async (exec) => {
        const cities = exec.assignedCities ?? [];
        const matched = allContexts.filter((c) => cities.includes(c.city));
        const ownerIds = toValidObjectIds(matched.map((c) => c.owner.id));

        const paidRevenue = await Subscription.aggregate([
          {
            $match: {
              userId: { $in: ownerIds },
              paymentStatus: SubscriptionPaymentStatus.PAID,
            },
          },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);

        const demoCount = matched.filter((c) => c.lifecycleStatus === LibraryLifecycleStatus.DEMO).length;
        const paidCount = matched.filter((c) => c.lifecycleStatus === LibraryLifecycleStatus.ACTIVE).length;
        const conversionRate =
          demoCount + paidCount > 0
            ? Math.round((paidCount / (demoCount + paidCount)) * 10000) / 100
            : 0;

        const studentCount = await Member.countDocuments({
          library: { $in: toValidObjectIds(matched.map((c) => c.libraryId)) },
        });

        return {
          executiveId: exec._id.toString(),
          executiveName: exec.fullName,
          assignedCities: cities,
          activeLibraries: paidCount,
          revenueGenerated: paidRevenue[0]?.total ?? 0,
          conversionRate,
          renewalRate: 0,
          studentsManaged: studentCount,
          seatsManaged: matched.reduce((s, c) => s + c.totalSeats, 0),
        };
      })
    );

    return leaderboard.sort((a, b) => b.revenueGenerated - a.revenueGenerated);
  },

  async getRenewalForecast(filters: AdminFilters) {
    const libraryIds = await buildLibraryQuery(filters);
    const contexts = await buildLibraryContexts(libraryIds);
    const ownerIds = toValidObjectIds(contexts.map((c) => c.owner.id));
    const now = new Date();

    const activeSubs = await Subscription.find({
      userId: { $in: ownerIds },
      status: LibrarySubscriptionStatus.ACTIVE,
      paymentStatus: SubscriptionPaymentStatus.PAID,
      endDate: { $gt: now },
    })
      .populate('planId')
      .populate('userId', 'fullName email')
      .sort({ endDate: 1 })
      .lean();

    const windows = [7, 15, 30] as const;
    const cards: Record<string, { count: number; estimatedRevenue: number }> = {};

    for (const days of windows) {
      const deadline = new Date(now);
      deadline.setDate(deadline.getDate() + days);
      const due = activeSubs.filter((s) => s.endDate && new Date(s.endDate) <= deadline);
      cards[`next${days}Days`] = {
        count: due.length,
        estimatedRevenue: due.reduce((sum, s) => sum + s.amount, 0),
      };
    }

    const forecast = activeSubs.map((sub) => {
      const ctx = contexts.find((c) => c.owner.id === sub.userId.toString());
      const plan = sub.planId as { name?: string; durationType?: string } | null;
      const endDate = new Date(sub.endDate!);
      const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        libraryCode: ctx?.libraryCode ?? '—',
        libraryName: ctx?.libraryName ?? '—',
        ownerName: (sub.userId as { fullName?: string })?.fullName ?? '—',
        planType: plan?.name ?? '—',
        currentPlanAmount: sub.amount,
        expiryDate: endDate,
        daysRemaining,
      };
    });

    return { cards, forecast };
  },

  async exportTransactions(filters: AdminFilters, format: 'csv' | 'excel') {
    const allFilters = { ...filters, page: 1, limit: 10000 };
    const { transactions } = await this.getTransactions(allFilters);

    if (format === 'csv') {
      const headers = [
        'Transaction ID',
        'Library',
        'Owner',
        'Payment Date',
        'Plan',
        'Gross',
        'Taxable',
        'GST',
        'Razorpay Fee',
        'Razorpay GST',
        'Net Settlement',
        'Status',
      ];
      const rows = transactions.map((t) =>
        [
          t.transactionId,
          t.libraryName,
          t.ownerName,
          new Date(t.paymentDate).toISOString(),
          t.planName,
          t.grossAmount,
          t.taxableAmount,
          t.gstAmount,
          t.razorpayFee,
          t.razorpayGst,
          t.netSettlementAmount,
          t.paymentStatus,
        ].join(',')
      );
      return { contentType: 'text/csv', body: [headers.join(','), ...rows].join('\n') };
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Transactions');
    sheet.columns = [
      { header: 'Transaction ID', key: 'transactionId', width: 24 },
      { header: 'Library', key: 'libraryName', width: 24 },
      { header: 'Owner', key: 'ownerName', width: 20 },
      { header: 'Payment Date', key: 'paymentDate', width: 16 },
      { header: 'Plan', key: 'planName', width: 24 },
      { header: 'Gross Amount', key: 'grossAmount', width: 14 },
      { header: 'Taxable Amount', key: 'taxableAmount', width: 14 },
      { header: 'GST Amount', key: 'gstAmount', width: 12 },
      { header: 'Razorpay Fee', key: 'razorpayFee', width: 12 },
      { header: 'Razorpay GST', key: 'razorpayGst', width: 12 },
      { header: 'Net Settlement', key: 'netSettlementAmount', width: 14 },
      { header: 'Status', key: 'paymentStatus', width: 10 },
    ];
    transactions.forEach((t) => sheet.addRow(t));
    const buffer = await workbook.xlsx.writeBuffer();
    return {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: buffer,
    };
  },

  // Sales executive CRUD (minimal)
  async listExecutives() {
    return SalesExecutive.find().sort({ fullName: 1 });
  },

  async createExecutive(data: {
    fullName: string;
    email: string;
    mobileNumber: string;
    assignedStates?: string[];
    assignedCities?: string[];
  }) {
    return SalesExecutive.create(data);
  },
};
