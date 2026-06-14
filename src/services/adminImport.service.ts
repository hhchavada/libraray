import ExcelJS from 'exceljs';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import { memberService, CreateMemberType } from './member.service';
import {
  PaymentMode,
  PaymentStatus,
  ShiftType,
  normalizeMembershipPlan,
} from '../constants/enums';

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
  remarks: 'remarks',
  type: 'type',
  membertype: 'type',
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
      ['membershipPlan', 'Conditional', '1 Month, 2 Months, 3 Months, 6 Months, 1 Year'],
      ['feePerMonth', 'Conditional', 'Required for permanent & without-seat'],
      ['discount', 'No', 'Flat discount amount'],
      ['amountPaid', 'Conditional', 'Required for permanent & without-seat'],
      ['paymentStatus', 'Conditional', 'paid, partial, unpaid'],
      ['paymentMode', 'Conditional', 'cash, online, upi'],
      ['remarks', 'No', 'Optional notes'],
      ['type', 'Yes', 'permanent, demo, without-seat (not student)'],
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
    const colIndex: Record<string, number> = {};
    headerRow.eachCell((cell, col) => {
      const raw = String(cell.value ?? '').trim();
      const mapped = headerMap[normalizeHeader(raw)];
      if (mapped) colIndex[mapped] = col;
    });

    for (const col of REQUIRED_COLUMNS) {
      if (!colIndex[col]) {
        throw new ApiError(400, `Missing required column: ${col}`);
      }
    }

    const results: { row: number; success: boolean; memberId?: string; error?: string }[] = [];

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
        const type = parseMemberType(get('type'));
        const shiftType = parseShift(String(get('shiftType')));
        const startDate = parseDate(get('startDate'));
        const endDateVal = get('endDate');
        const endDate = endDateVal ? parseDate(endDateVal) : undefined;

        const planRaw = get('membershipPlan');
        const membershipPlan = planRaw
          ? normalizeMembershipPlan(String(planRaw)) ?? undefined
          : undefined;

        if (type !== 'demo' && planRaw && !membershipPlan) {
          throw new Error(
            `Invalid membershipPlan "${planRaw}". Use 1 Month, 2 Months, 3 Months, 6 Months, or 1 Year`
          );
        }

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
          feePerMonth: parseOptionalNumber(get('feePerMonth')),
          discount: parseOptionalNumber(get('discount')),
          amountPaid: parseOptionalNumber(get('amountPaid')),
          paymentMode: get('paymentMode')
            ? parsePaymentMode(get('paymentMode'))
            : PaymentMode.CASH,
          paymentStatus: get('paymentStatus')
            ? parsePaymentStatus(get('paymentStatus'))
            : PaymentStatus.UNPAID,
          remarks: parseOptionalString(get('remarks')),
        };

        const member = await memberService.createMember(payload, libraryId);
        results.push({
          row: r,
          success: true,
          memberId: (member as { memberId?: string }).memberId,
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
      results,
      message: MESSAGES.MEMBER_IMPORT_COMPLETED,
    };
  },
};
