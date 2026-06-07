export type DateFilter = 'today' | 'this_week' | 'this_month' | 'last_month';

export const getDateRange = (filter: DateFilter): { from: Date; to: Date } => {
  const now = new Date();

  let from: Date;
  let to: Date;

  switch (filter) {
    case 'today':
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
      to = new Date(now);
      to.setHours(23, 59, 59, 999);
      break;

    case 'this_week': {
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      from = new Date(now);
      from.setDate(now.getDate() - diffToMonday);
      from.setHours(0, 0, 0, 0);
      to = new Date(now);
      to.setHours(23, 59, 59, 999);
      break;
    }

    case 'this_month':
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      to = new Date(now);
      to.setHours(23, 59, 59, 999);
      break;

    case 'last_month':
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
  }

  return { from, to };
};
