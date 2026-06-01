/**
 * Add calendar months to a date (handles month-end edge cases).
 */
export const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() < day) {
    result.setDate(0);
  }
  return result;
};

export const toRupeesPaise = (amountInRupees: number): number =>
  Math.round(amountInRupees * 100);
