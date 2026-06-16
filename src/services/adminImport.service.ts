import ExcelJS from 'exceljs';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import { memberService, CreateMemberType } from './member.service';
import { seatService } from './seat.service';
import mongoose from 'mongoose';
import {
  PaymentMode,
  PaymentStatus,
  ShiftType,
  MembershipPlan,
  MEMBERSHIP_PLAN_MONTHS,
  normalizeMembershipPlan,
} from '../constants/enums';
import { addMonths } from '../utils/subscription.util';

const REQUIRED_COLUMNS = ['fullName', 'mobileNumber', 'shiftType', 'startDate', 'type'] as const;

export const MEMBER_IMPORT_COLUMNS = [
  'fullName',
  'mobileNumber',
  'email',
  'courseName',
  'shiftType',
  'startDate',
  'endDate',
  'membershipPlan',
  'feePerMonth',
  'discount',
  'amountPaid',
  'paymentStatus',
  'paymentMode',
  'seatNumber',
  'remarks',
  'type',
] as const;

const SAMPLE_ROWS: Record<(typeof MEMBER_IMPORT_COLUMNS)[number], string | number>[] = [
  {
    fullName: 'Rahul Sharma',
    mobileNumber: '9876543210',
    email: 'rahul@example.com',
    courseName: 'UPSC',
    shiftType: 'Morning',
    startDate: '2026-06-01',
    endDate: '2026-07-01',
    membershipPlan: '1 Month',
    feePerMonth: 500,
    discount: 0,
    amountPaid: 500,
    paymentStatus: 'paid',
    paymentMode: 'cash',
    seatNumber: 19,
    remarks: '',
    type: 'permanent',
  },
  {
    fullName: 'Priya Patel',
    mobileNumber: '9876543211',
    email: 'priya@example.com',
    courseName: 'NEET',
    shiftType: 'Evening',
    startDate: '2026-06-01',
    endDate: '2026-06-08',
    membershipPlan: '',
    feePerMonth: '',
    discount: '',
    amountPaid: '',
    paymentStatus: '',
    paymentMode: '',
    seatNumber: 5,
    remarks: 'Demo student',
    type: 'demo',
  },
  {
    fullName: 'Amit Kumar',
    mobileNumber: '9876543212',
    email: '',
    courseName: 'JEE',
    shiftType: 'Full Day',
    startDate: '2026-06-01',
    endDate: '2026-09-01',
    membershipPlan: '3 Months',
    feePerMonth: 600,
    discount: 50,
    amountPaid: 1650,
    paymentStatus: 'partial',
    paymentMode: 'upi',
    seatNumber: '',
    remarks: '',
    type: 'without-seat',
  },
];

const normalizeHeader = (h: string) =>
  h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/_/g, '');

const headerMap: Record<string, string> = {
  fullname: 'fullName',
  name: 'fullName',
  mobilenumber: 'mobileNumber',
  mobile: 'mobileNumber',
  phone: 'mobileNumber',
  email: 'email',
  coursename: 'courseName',
  course: 'courseName',
  shifttype: 'shiftType',
  shift: 'shiftType',
  startdate: 'startDate',
  enddate: 'endDate',
  membershipplan: 'membershipPlan',
  plan: 'membershipPlan',
  feepermonth: 'feePerMonth',
  fee: 'feePerMonth',
  discount: 'discount',
  amountpaid: 'amountPaid',
  paid: 'amountPaid',
  paymentmode: 'paymentMode',
  paymentstatus: 'paymentStatus',
  seatnumber: 'seatNumber',
  seat: 'seatNumber',
  seatno: 'seatNumber',
  seatnum: 'seatNumber',
  seatid: 'seatNumber',
  sno: 'seatNumber',
  remarks: 'remarks',
  type: 'type',
  membertype: 'type',
};

const mapImportColumns = (headerRow: ExcelJS.Row): Record<string, number> => {
  const colIndex: Record<string, number> = {};

  headerRow.eachCell((cell, col) => {
    const raw = String(cell.value ?? '').trim();
    const mapped = headerMap[normalizeHeader(raw)];
    if (mapped) colIndex[mapped] = col;
  });

  // Fuzzy match: "Seat Number", "Seat No", etc. when exact key missing
  if (!colIndex.seatNumber) {
    headerRow.eachCell((cell, col) => {
      const raw = String(cell.value ?? '').trim();
      if (raw && /seat/i.test(raw)) {
        colIndex.seatNumber = col;
      }
    });
  }

  return colIndex;
};

const ensureImportedMemberSeat = async (
  member: { _id: mongoose.Types.ObjectId; seat?: mongoose.Types.ObjectId },
  libraryId: string,
  seatId: string,
  shiftType: ShiftType
) => {
  if (member.seat) return;

  const seat = await seatService.getSeatById(seatId);
  if (seat.library.toString() !== libraryId) {
    throw new Error('Seat does not belong to this library');
  }

  await seatService.assignSeat(seatId, member._id.toString(), shiftType);
  await mongoose.model('Member').updateOne(
    { _id: member._id },
    { $set: { seat: new mongoose.Types.ObjectId(seatId) } }
  );
  await seatService.syncSeatFromMembers(seatId);
};

const parseShift = (v: string): ShiftType => {
  const key = v.trim().toLowerCase().replace(/\s+/g, '_');
  const map: Record<string, ShiftType> = {
    morning: ShiftType.MORNING,
    evening: ShiftType.EVENING,
    full_day: ShiftType.FULL_DAY,
    fullday: ShiftType.FULL_DAY,
  };
  const shift = map[key];
  if (!shift) throw new Error(`Invalid shiftType: ${v}`);
  return shift;
};

const parseMemberType = (v: unknown): CreateMemberType => {
  const raw = String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/_/g, '-');

  if (!raw) {
    throw new Error('type is required. Use permanent, demo, or without-seat');
  }
  if (raw === 'student') {
    throw new Error('Invalid type "student". Use permanent, demo, or without-seat');
  }
  if (raw === 'permanent') return 'permanent';
  if (raw === 'demo') return 'demo';
  if (raw === 'without-seat' || raw === 'withoutseat') return 'without-seat';
  throw new Error(`Invalid type "${v}". Use permanent, demo, or without-seat`);
};

/** Blank type defaults to permanent (common in bulk spreadsheets). */
const parseMemberTypeWithDefault = (v: unknown): CreateMemberType => {
  const raw = String(v ?? '').trim();
  if (!raw) return 'permanent';
  return parseMemberType(v);
};

const resolveMembershipPlan = (
  planRaw: unknown,
  type: CreateMemberType
): MembershipPlan | undefined => {
  if (type === 'demo') {
    const raw = String(planRaw ?? '').trim();
    if (!raw) return undefined;
    const normalized = normalizeMembershipPlan(raw);
    if (!normalized) {
      throw new Error(
        `Invalid membershipPlan "${raw}". Use 1 Month, 2 Months, 3 Months, 6 Months, or 1 Year`
      );
    }
    return normalized;
  }

  const raw = String(planRaw ?? '').trim();
  if (!raw) return MembershipPlan.ONE_MONTH;

  const normalized = normalizeMembershipPlan(raw);
  if (!normalized) {
    throw new Error(
      `Invalid membershipPlan "${raw}". Use 1 Month, 2 Months, 3 Months, 6 Months, or 1 Year`
    );
  }
  return normalized;
};

const resolveEndDate = (
  startDate: Date,
  endDate: Date | undefined,
  membershipPlan: MembershipPlan | undefined,
  type: CreateMemberType
): Date | undefined => {
  if (endDate) return endDate;
  if (type === 'demo') return undefined;
  const months = membershipPlan ? MEMBERSHIP_PLAN_MONTHS[membershipPlan] : 1;
  return addMonths(startDate, months);
};

const resolveImportNumbers = (
  type: CreateMemberType,
  feePerMonthRaw: unknown,
  discountRaw: unknown,
  amountPaidRaw: unknown
) => {
  if (type === 'demo') {
    return {
      feePerMonth: parseOptionalNumber(feePerMonthRaw),
      discount: parseOptionalNumber(discountRaw) ?? 0,
      amountPaid: parseOptionalNumber(amountPaidRaw) ?? 0,
    };
  }

  return {
    feePerMonth: parseOptionalNumber(feePerMonthRaw) ?? 0,
    discount: parseOptionalNumber(discountRaw) ?? 0,
    amountPaid: parseOptionalNumber(amountPaidRaw) ?? 0,
  };
};

const parsePaymentStatus = (v: unknown): PaymentStatus => {
  const key = String(v ?? '')
    .trim()
    .toLowerCase();
  const map: Record<string, PaymentStatus> = {
    paid: PaymentStatus.PAID,
    partial: PaymentStatus.PARTIAL,
    unpaid: PaymentStatus.UNPAID,
  };
  const status = map[key];
  if (!status) throw new Error(`Invalid paymentStatus: ${v}`);
  return status;
};

const parsePaymentMode = (v: unknown): PaymentMode => {
  const key = String(v ?? '')
    .trim()
    .toLowerCase();
  const map: Record<string, PaymentMode> = {
    cash: PaymentMode.CASH,
    online: PaymentMode.ONLINE,
    upi: PaymentMode.UPI,
  };
  const mode = map[key];
  if (!mode) throw new Error(`Invalid paymentMode: ${v}`);
  return mode;
};

const parseDate = (v: unknown): Date => {
  if (v instanceof Date) return v;
  const d = new Date(String(v));
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${v}`);
  return d;
};

const parseOptionalString = (v: unknown): string | undefined => {
  const value = String(v ?? '').trim();
  return value || undefined;
};

const parseOptionalNumber = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const num = Number(v);
  if (Number.isNaN(num)) throw new Error(`Invalid number: ${v}`);
  return num;
};

const parseSeatNumber = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const num = Number(v);
  if (!Number.isInteger(num) || num < 1) {
    throw new Error(`Invalid seatNumber: ${v}`);
  }
  return num;
};

const resolveSeatIdForImport = async (
  libraryId: string,
  seatNumber: number
): Promise<string> => {
  try {
    const seat = await seatService.getSeatByNumber(libraryId, seatNumber);
    return seat._id.toString();
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) {
      throw new Error(`Seat number ${seatNumber} not found in this library`);
    }
    throw err;
  }
};

export const adminImportService = {
  async generateMemberImportTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Members');

    sheet.addRow([...MEMBER_IMPORT_COLUMNS]);
    for (const row of SAMPLE_ROWS) {
      sheet.addRow(MEMBER_IMPORT_COLUMNS.map((col) => row[col]));
    }

    sheet.getRow(1).font = { bold: true };
    sheet.columns = MEMBER_IMPORT_COLUMNS.map((col) => ({
      key: col,
      width: Math.max(col.length + 4, 14),
    }));

    const notes = workbook.addWorksheet('Instructions');
    notes.addRow(['Column', 'Required', 'Allowed values / notes']);
    notes.getRow(1).font = { bold: true };
    const instructions: [string, string, string][] = [
      ['fullName', 'Yes', 'Member full name'],
      ['mobileNumber', 'Yes', '10 digit mobile number'],
      ['email', 'No', 'Optional email'],
      ['courseName', 'No', 'Course / exam name'],
      ['shiftType', 'Yes', 'Morning, Evening, Full Day'],
      ['startDate', 'Yes', 'YYYY-MM-DD'],
      ['endDate', 'No', 'Required for permanent & without-seat'],
      ['membershipPlan', 'Conditional', 'Defaults to 1 Month if blank (permanent/without-seat)'],
      ['feePerMonth', 'Conditional', 'Defaults to 0 if blank'],
      ['discount', 'No', 'Defaults to 0 if blank'],
      ['amountPaid', 'Conditional', 'Defaults to 0 if blank (unpaid members)'],
      ['paymentStatus', 'Conditional', 'Defaults to unpaid if blank'],
      ['paymentMode', 'Conditional', 'Defaults to cash if blank'],
      ['seatNumber', 'No', 'Seat number in this library (permanent/demo only)'],
      ['remarks', 'No', 'Optional notes'],
      ['type', 'No', 'Defaults to permanent if blank'],
    ];
    for (const row of instructions) {
      notes.addRow(row);
    }
    notes.columns = [{ width: 18 }, { width: 12 }, { width: 52 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  },

  async importMembersFromExcel(libraryId: string, fileBuffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new ApiError(400, 'Excel file has no worksheets');
    }

    const headerRow = sheet.getRow(1);
    const colIndex = mapImportColumns(headerRow);
    const warnings: string[] = [];

    if (!colIndex.seatNumber) {
      warnings.push(
        'seatNumber column not found in Excel — members were imported but no seats were assigned. Download a fresh template and add a column named seatNumber.'
      );
    }

    for (const col of REQUIRED_COLUMNS) {
      if (!colIndex[col]) {
        throw new ApiError(400, `Missing required column: ${col}`);
      }
    }

    const results: {
      row: number;
      success: boolean;
      memberId?: string;
      seatNumber?: number;
      seatAssigned?: boolean;
      error?: string;
    }[] = [];
    let seatsAssigned = 0;

    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const get = (key: string) => {
        const idx = colIndex[key];
        if (!idx) return undefined;
        const cell = row.getCell(idx);
        return cell.value;
      };

      const fullName = String(get('fullName') ?? '').trim();
      const mobileNumber = String(get('mobileNumber') ?? '').trim();
      if (!fullName && !mobileNumber) continue;

      try {
        const type = parseMemberTypeWithDefault(get('type'));
        const shiftType = parseShift(String(get('shiftType')));
        const startDate = parseDate(get('startDate'));
        const membershipPlan = resolveMembershipPlan(get('membershipPlan'), type);
        const endDate = resolveEndDate(
          startDate,
          get('endDate') ? parseDate(get('endDate')) : undefined,
          membershipPlan,
          type
        );

        const seatNumber = parseSeatNumber(get('seatNumber'));
        if (seatNumber !== undefined && type === 'without-seat') {
          throw new Error('without-seat members cannot have a seatNumber');
        }

        let seatId: string | undefined;
        if (seatNumber !== undefined) {
          seatId = await resolveSeatIdForImport(libraryId, seatNumber);
        }

        const { feePerMonth, discount, amountPaid } = resolveImportNumbers(
          type,
          get('feePerMonth'),
          get('discount'),
          get('amountPaid')
        );

        const payload = {
          type,
          fullName,
          mobileNumber,
          email: parseOptionalString(get('email')),
          courseName: parseOptionalString(get('courseName')),
          shiftType,
          startDate,
          endDate,
          membershipPlan,
          feePerMonth,
          discount,
          amountPaid,
          paymentMode: get('paymentMode')
            ? parsePaymentMode(get('paymentMode'))
            : PaymentMode.CASH,
          paymentStatus: get('paymentStatus')
            ? parsePaymentStatus(get('paymentStatus'))
            : PaymentStatus.UNPAID,
          seatId,
          remarks: parseOptionalString(get('remarks')),
        };

        let member = await memberService.createMember(payload, libraryId);

        if (seatId) {
          const hadSeat = Boolean(member.seat);
          if (!hadSeat) {
            await ensureImportedMemberSeat(member, libraryId, seatId, shiftType);
            member = await memberService.getMemberById(member._id.toString());
          }
          if (member.seat) seatsAssigned += 1;
        }

        results.push({
          row: r,
          success: true,
          memberId: (member as { memberId?: string }).memberId,
          ...(seatNumber !== undefined ? { seatNumber, seatAssigned: Boolean(member.seat) } : {}),
        });
      } catch (err) {
        results.push({
          row: r,
          success: false,
          error: err instanceof Error ? err.message : 'Import failed',
        });
      }
    }

    const imported = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    await memberService.syncExpiredMembers(libraryId);

    return {
      totalRows: results.length,
      imported,
      failed,
      seatsAssigned,
      warnings,
      results,
      message: MESSAGES.MEMBER_IMPORT_COMPLETED,
    };
  },
};
