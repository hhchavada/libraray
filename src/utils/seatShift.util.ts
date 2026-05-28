import { ShiftType } from '../constants/enums';

/**
 * Shift booking rules:
 * - FULL_DAY blocks morning, evening, and full_day on that seat
 * - MORNING + EVENING can share the same seat (max 2 members)
 */
export const isSeatAvailableForShift = (
  bookedShifts: ShiftType[],
  requestedShift: ShiftType
): boolean => {
  if (bookedShifts.includes(ShiftType.FULL_DAY)) {
    return false;
  }

  if (requestedShift === ShiftType.FULL_DAY) {
    return bookedShifts.length === 0;
  }

  if (requestedShift === ShiftType.MORNING) {
    return !bookedShifts.includes(ShiftType.MORNING);
  }

  if (requestedShift === ShiftType.EVENING) {
    return !bookedShifts.includes(ShiftType.EVENING);
  }

  return bookedShifts.length < 2;
};

export interface ShiftOccupancyCounts {
  morning: number;
  evening: number;
  fullDay: number;
}

/** Count active member bookings per shift (full_day counts toward morning + evening slots). */
export const countMemberShiftOccupancy = (
  members: Array<{ shiftType: ShiftType }>
): ShiftOccupancyCounts & { morningSlots: number; eveningSlots: number } => {
  let morning = 0;
  let evening = 0;
  let fullDay = 0;

  for (const member of members) {
    if (member.shiftType === ShiftType.MORNING) {
      morning++;
    } else if (member.shiftType === ShiftType.EVENING) {
      evening++;
    } else if (member.shiftType === ShiftType.FULL_DAY) {
      fullDay++;
    }
  }

  return {
    morning,
    evening,
    fullDay,
    morningSlots: morning + fullDay,
    eveningSlots: evening + fullDay,
  };
};

export interface ShiftSeatStats {
  totalSeats: number;
  morning: { available: number; occupied: number };
  evening: { available: number; occupied: number };
  fullDay: { available: number; occupied: number };
}
