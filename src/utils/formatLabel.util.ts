/** API display: `1_month` → `1 month`, `without_seat` → `without seat` */
export const formatEnumLabel = (value?: string | null): string | undefined => {
  if (value == null || value === '') {
    return value ?? undefined;
  }
  return value.replace(/_/g, ' ');
};

const MEMBER_LABEL_FIELDS = [
  'memberType',
  'membershipPlan',
  'shiftType',
  'paymentStatus',
  'paymentMode',
  'status',
] as const;

const SEAT_LABEL_FIELDS = ['shiftType', 'status'] as const;

export const formatMemberLabels = <T extends Record<string, unknown>>(obj: T): T => {
  const out = { ...obj } as Record<string, unknown>;

  for (const field of MEMBER_LABEL_FIELDS) {
    if (typeof out[field] === 'string') {
      out[field] = formatEnumLabel(out[field] as string);
    }
  }

  if (out.seat && typeof out.seat === 'object' && out.seat !== null && !Array.isArray(out.seat)) {
    out.seat = formatSeatLabels(out.seat as Record<string, unknown>);
  }

  return out as T;
};

export const formatSeatLabels = <T extends Record<string, unknown>>(obj: T): T => {
  const out = { ...obj } as Record<string, unknown>;

  for (const field of SEAT_LABEL_FIELDS) {
    if (typeof out[field] === 'string') {
      out[field] = formatEnumLabel(out[field] as string);
    }
  }

  if (Array.isArray(out.bookings)) {
    out.bookings = out.bookings.map((booking) =>
      formatMemberLabels(booking as Record<string, unknown>)
    );
  }

  if (Array.isArray(out.bookedShifts)) {
    out.bookedShifts = (out.bookedShifts as string[]).map((s) => formatEnumLabel(s));
  }

  return out as T;
};

export const formatMemberListLabels = <T extends Record<string, unknown>>(items: T[]): T[] =>
  items.map((item) => formatMemberLabels(item));
