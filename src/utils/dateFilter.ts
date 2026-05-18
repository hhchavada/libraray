export type DateFilter = 'today' | 'this_week' | 'this_month';

export const getDateRange = (filter: DateFilter): { from: Date; to: Date } => {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  let from = new Date(now);

  switch (filter) {
    case 'today':
      from.setHours(0, 0, 0, 0);
      break;
    case 'this_week': {
      const dayOfWeek = from.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      from.setDate(from.getDate() - diffToMonday);
      from.setHours(0, 0, 0, 0);
      break;
    }
    case 'this_month':
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      break;
  }

  return { from, to };
};
