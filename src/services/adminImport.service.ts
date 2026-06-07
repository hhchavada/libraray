import ExcelJS from 'exceljs';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import { memberService } from './member.service';
import {
  PaymentMode,
  PaymentStatus,
  ShiftType,
  normalizeMembershipPlan,
} from '../constants/enums';

const REQUIRED_COLUMNS = ['fullName', 'mobileNumber', 'shiftType', 'startDate'] as const;

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

const parseDate = (v: unknown): Date => {
  if (v instanceof Date) return v;
  const d = new Date(String(v));
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${v}`);
  return d;
};

export const adminImportService = {
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
        const typeRaw = String(get('type') ?? 'without-seat').trim().toLowerCase();
        const type =
          typeRaw === 'permanent' || typeRaw === 'demo' || typeRaw === 'without-seat'
            ? typeRaw
            : 'without-seat';

        const shiftType = parseShift(String(get('shiftType')));
        const startDate = parseDate(get('startDate'));
        const endDateVal = get('endDate');
        const endDate = endDateVal ? parseDate(endDateVal) : undefined;

        const planRaw = get('membershipPlan');
        const membershipPlan = planRaw
          ? normalizeMembershipPlan(String(planRaw)) ?? undefined
          : undefined;

        const payload = {
          type: type as 'permanent' | 'demo' | 'without-seat',
          fullName,
          mobileNumber,
          email: get('email') ? String(get('email')).trim() : undefined,
          courseName: get('courseName') ? String(get('courseName')).trim() : undefined,
          shiftType,
          startDate,
          endDate,
          membershipPlan,
          feePerMonth: get('feePerMonth') ? Number(get('feePerMonth')) : undefined,
          discount: get('discount') ? Number(get('discount')) : undefined,
          amountPaid: get('amountPaid') ? Number(get('amountPaid')) : undefined,
          paymentMode: (get('paymentMode')
            ? String(get('paymentMode')).toLowerCase()
            : PaymentMode.CASH) as PaymentMode,
          paymentStatus: (get('paymentStatus')
            ? String(get('paymentStatus')).toLowerCase()
            : PaymentStatus.UNPAID) as PaymentStatus,
          remarks: get('remarks') ? String(get('remarks')).trim() : undefined,
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

    return {
      totalRows: results.length,
      imported,
      failed,
      results,
      message: MESSAGES.MEMBER_IMPORT_COMPLETED,
    };
  },
};
