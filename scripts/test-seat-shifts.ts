/**
 * Run: npx ts-node scripts/test-seat-shifts.ts
 * Verifies shift booking rules without MongoDB.
 */
import { ShiftType } from '../src/constants/enums';
import {
  countMemberShiftOccupancy,
  isSeatAvailableForShift,
} from '../src/utils/seatShift.util';

let passed = 0;
let failed = 0;

const assert = (name: string, condition: boolean) => {
  if (condition) {
    passed++;
    console.log(`  OK  ${name}`);
  } else {
    failed++;
    console.error(`  FAIL ${name}`);
  }
};

console.log('\n--- Shift availability rules ---\n');

assert('empty seat → morning available', isSeatAvailableForShift([], ShiftType.MORNING));
assert('empty seat → evening available', isSeatAvailableForShift([], ShiftType.EVENING));
assert('morning booked → evening still available', isSeatAvailableForShift([ShiftType.MORNING], ShiftType.EVENING));
assert('morning booked → morning not available', !isSeatAvailableForShift([ShiftType.MORNING], ShiftType.MORNING));
assert('evening booked → morning still available', isSeatAvailableForShift([ShiftType.EVENING], ShiftType.MORNING));
assert('morning+evening → neither shift available', !isSeatAvailableForShift([ShiftType.MORNING, ShiftType.EVENING], ShiftType.MORNING));
assert('full_day → blocks morning', !isSeatAvailableForShift([ShiftType.FULL_DAY], ShiftType.MORNING));

console.log('\n--- User scenario: 3 students, 2 seats ---\n');
console.log('  Seat 1: morning | Seat 2: morning + evening\n');

const members = [
  { shiftType: ShiftType.MORNING },
  { shiftType: ShiftType.MORNING },
  { shiftType: ShiftType.EVENING },
];

const occupancy = countMemberShiftOccupancy(members);

assert('morning occupied = 2', occupancy.morningSlots === 2);
assert('evening occupied = 1', occupancy.eveningSlots === 1);
assert('full_day occupied = 0', occupancy.fullDay === 0);

const seat1Shifts = [ShiftType.MORNING];
const seat2Shifts = [ShiftType.MORNING, ShiftType.EVENING];

let morningAvailableSeats = 0;
let eveningAvailableSeats = 0;

if (isSeatAvailableForShift(seat1Shifts, ShiftType.MORNING)) morningAvailableSeats++;
if (isSeatAvailableForShift(seat1Shifts, ShiftType.EVENING)) eveningAvailableSeats++;
if (isSeatAvailableForShift(seat2Shifts, ShiftType.MORNING)) morningAvailableSeats++;
if (isSeatAvailableForShift(seat2Shifts, ShiftType.EVENING)) eveningAvailableSeats++;

assert('morning available seats = 0', morningAvailableSeats === 0);
assert('evening available seats = 1 (seat 1 evening free)', eveningAvailableSeats === 1);

console.log(`\n--- Result: ${passed} passed, ${failed} failed ---\n`);

if (failed > 0) {
  process.exit(1);
}
