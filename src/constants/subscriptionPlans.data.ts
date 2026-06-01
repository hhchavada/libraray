import { PlanCategory, PlanDurationType } from './enums';

export interface SubscriptionPlanSeed {
  name: string;
  category: PlanCategory;
  seatsMin: number;
  seatsMax: number;
  durationType: PlanDurationType;
  durationMonths: number;
  amount: number;
}

/** 16 library subscription plans (4 categories × 4 billing periods). */
export const SUBSCRIPTION_PLANS_SEED: SubscriptionPlanSeed[] = [
  // Small Library (up to 50 seats)
  {
    name: 'Small Library — Monthly',
    category: PlanCategory.SMALL,
    seatsMin: 1,
    seatsMax: 50,
    durationType: PlanDurationType.MONTHLY,
    durationMonths: 1,
    amount: 199,
  },
  {
    name: 'Small Library — Quarterly',
    category: PlanCategory.SMALL,
    seatsMin: 1,
    seatsMax: 50,
    durationType: PlanDurationType.QUARTERLY,
    durationMonths: 3,
    amount: 499,
  },
  {
    name: 'Small Library — Half Yearly',
    category: PlanCategory.SMALL,
    seatsMin: 1,
    seatsMax: 50,
    durationType: PlanDurationType.HALF_YEARLY,
    durationMonths: 6,
    amount: 899,
  },
  {
    name: 'Small Library — Annually',
    category: PlanCategory.SMALL,
    seatsMin: 1,
    seatsMax: 50,
    durationType: PlanDurationType.YEARLY,
    durationMonths: 12,
    amount: 1699,
  },
  // Medium Library (51–100 seats)
  {
    name: 'Medium Library — Monthly',
    category: PlanCategory.MEDIUM,
    seatsMin: 51,
    seatsMax: 100,
    durationType: PlanDurationType.MONTHLY,
    durationMonths: 1,
    amount: 259,
  },
  {
    name: 'Medium Library — Quarterly',
    category: PlanCategory.MEDIUM,
    seatsMin: 51,
    seatsMax: 100,
    durationType: PlanDurationType.QUARTERLY,
    durationMonths: 3,
    amount: 649,
  },
  {
    name: 'Medium Library — Half Yearly',
    category: PlanCategory.MEDIUM,
    seatsMin: 51,
    seatsMax: 100,
    durationType: PlanDurationType.HALF_YEARLY,
    durationMonths: 6,
    amount: 1199,
  },
  {
    name: 'Medium Library — Annually',
    category: PlanCategory.MEDIUM,
    seatsMin: 51,
    seatsMax: 100,
    durationType: PlanDurationType.YEARLY,
    durationMonths: 12,
    amount: 2199,
  },
  // Large Library (101–150 seats)
  {
    name: 'Large Library — Monthly',
    category: PlanCategory.LARGE,
    seatsMin: 101,
    seatsMax: 150,
    durationType: PlanDurationType.MONTHLY,
    durationMonths: 1,
    amount: 349,
  },
  {
    name: 'Large Library — Quarterly',
    category: PlanCategory.LARGE,
    seatsMin: 101,
    seatsMax: 150,
    durationType: PlanDurationType.QUARTERLY,
    durationMonths: 3,
    amount: 899,
  },
  {
    name: 'Large Library — Half Yearly',
    category: PlanCategory.LARGE,
    seatsMin: 101,
    seatsMax: 150,
    durationType: PlanDurationType.HALF_YEARLY,
    durationMonths: 6,
    amount: 1599,
  },
  {
    name: 'Large Library — Annually',
    category: PlanCategory.LARGE,
    seatsMin: 101,
    seatsMax: 150,
    durationType: PlanDurationType.YEARLY,
    durationMonths: 12,
    amount: 2999,
  },
  // Mega Library (more than 150 seats)
  {
    name: 'Mega Library — Monthly',
    category: PlanCategory.MEGA,
    seatsMin: 151,
    seatsMax: 999999,
    durationType: PlanDurationType.MONTHLY,
    durationMonths: 1,
    amount: 449,
  },
  {
    name: 'Mega Library — Quarterly',
    category: PlanCategory.MEGA,
    seatsMin: 151,
    seatsMax: 999999,
    durationType: PlanDurationType.QUARTERLY,
    durationMonths: 3,
    amount: 1099,
  },
  {
    name: 'Mega Library — Half Yearly',
    category: PlanCategory.MEGA,
    seatsMin: 151,
    seatsMax: 999999,
    durationType: PlanDurationType.HALF_YEARLY,
    durationMonths: 6,
    amount: 1999,
  },
  {
    name: 'Mega Library — Annually',
    category: PlanCategory.MEGA,
    seatsMin: 151,
    seatsMax: 999999,
    durationType: PlanDurationType.YEARLY,
    durationMonths: 12,
    amount: 3599,
  },
];

export const PLAN_CATEGORY_LABELS: Record<PlanCategory, string> = {
  [PlanCategory.SMALL]: 'Small',
  [PlanCategory.MEDIUM]: 'Medium',
  [PlanCategory.LARGE]: 'Large',
  [PlanCategory.MEGA]: 'Mega',
};
