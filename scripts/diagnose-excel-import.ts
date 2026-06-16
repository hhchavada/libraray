/**
 * Diagnose member import Excel files without writing to DB.
 * Usage: npx ts-node scripts/diagnose-excel-import.ts <file1> [file2] [libraryId]
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { connectDB } from '../src/config/db';
import { Library } from '../src/models/library.model';
import { Seat } from '../src/models/seat.model';

const normalizeHeader = (h: string) =>
  h.trim().toLowerCase().replace(/\s+/g, '').replace(/_/g, '');

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
  remarks: 'remarks',
  type: 'type',
  membertype: 'type',
};

const REQUIRED = ['fullName', 'mobileNumber', 'shiftType', 'startDate', 'type'];

const cellDisplay = (v: unknown): string => {
  if (v === null || v === undefined) return '(empty)';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object' && v !== null && 'text' in v) return String((v as { text: string }).text);
  if (typeof v === 'object' && v !== null && 'result' in v) return String((v as { result: unknown }).result);
  return String(v);
};

async function diagnoseFile(filePath: string, libraryId?: string) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    console.log(`\n❌ File not found: ${abs}`);
    return;
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`FILE: ${path.basename(filePath)}`);
  console.log(`${'='.repeat(70)}`);

  const buffer = fs.readFileSync(abs);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  console.log(`Worksheets: ${workbook.worksheets.map((s) => s.name).join(', ')}`);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    console.log('❌ No worksheet found');
    return;
  }

  const headerRow = sheet.getRow(1);
  const rawHeaders: string[] = [];
  const colIndex: Record<string, number> = {};

  headerRow.eachCell((cell, col) => {
    const raw = String(cell.value ?? '').trim();
    rawHeaders.push(raw);
    const mapped = headerMap[normalizeHeader(raw)];
    if (mapped) colIndex[mapped] = col;
  });

  console.log('\n--- Row 1 headers (raw) ---');
  rawHeaders.forEach((h, i) => {
    const mapped = headerMap[normalizeHeader(h)];
    console.log(`  Col ${i + 1}: "${h}" → ${mapped ?? '⚠️ UNMAPPED'}`);
  });

  const missingRequired = REQUIRED.filter((c) => !colIndex[c]);
  if (missingRequired.length) {
    console.log(`\n❌ MISSING REQUIRED COLUMNS: ${missingRequired.join(', ')}`);
  } else {
    console.log('\n✅ All required columns present');
  }

  const seatNumbersInLib = new Set<number>();
  if (libraryId) {
    const seats = await Seat.find({ library: libraryId }).select('seatNumber').lean();
    seats.forEach((s) => seatNumbersInLib.add(s.seatNumber));
    console.log(`\nLibrary ${libraryId} has ${seatNumbersInLib.size} seats`);
  }

  let dataRows = 0;
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const get = (key: string) => {
      const idx = colIndex[key];
      if (!idx) return undefined;
      return row.getCell(idx).value;
    };

    const fullName = String(get('fullName') ?? '').trim();
    const mobile = String(get('mobileNumber') ?? '').trim();
    if (!fullName && !mobile) continue;

    dataRows++;
    const issues: string[] = [];
    const rowData: Record<string, string> = {};

    for (const key of Object.keys(colIndex)) {
      rowData[key] = cellDisplay(get(key));
    }

    if (!fullName) issues.push('fullName is empty');
    if (!mobile) issues.push('mobileNumber is empty');

    const typeRaw = String(get('type') ?? '').trim();
    const typeNorm = typeRaw.toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
    if (!typeRaw) issues.push('type is empty');
    else if (!['permanent', 'demo', 'without-seat', 'withoutseat'].includes(typeNorm)) {
      issues.push(`Invalid type "${typeRaw}" (use permanent, demo, without-seat)`);
    }

    const shift = String(get('shiftType') ?? '').trim();
    const shiftKey = shift.toLowerCase().replace(/\s+/g, '_');
    if (!shift) issues.push('shiftType is empty');
    else if (!['morning', 'evening', 'full_day', 'fullday'].includes(shiftKey)) {
      issues.push(`Invalid shiftType "${shift}"`);
    }

    const startVal = get('startDate');
    if (!startVal) issues.push('startDate is empty');
    else if (!(startVal instanceof Date) && isNaN(Date.parse(String(startVal)))) {
      issues.push(`Invalid startDate: ${cellDisplay(startVal)}`);
    }

    const memberType = typeNorm === 'withoutseat' ? 'without-seat' : typeNorm;

    if (memberType !== 'demo') {
      const plan = String(get('membershipPlan') ?? '').trim();
      if (!plan) issues.push('membershipPlan required for permanent/without-seat');
      const fee = get('feePerMonth');
      if (fee === undefined || fee === null || fee === '') {
        issues.push('feePerMonth required for permanent/without-seat');
      }
      const paid = get('amountPaid');
      if (paid === undefined || paid === null || paid === '') {
        issues.push('amountPaid required for permanent/without-seat');
      }
    }

    const payStatus = String(get('paymentStatus') ?? '').trim();
    if (payStatus && !['paid', 'partial', 'unpaid'].includes(payStatus.toLowerCase())) {
      issues.push(`Invalid paymentStatus "${payStatus}"`);
    }

    const payMode = String(get('paymentMode') ?? '').trim();
    if (payMode && !['cash', 'online', 'upi'].includes(payMode.toLowerCase())) {
      issues.push(`Invalid paymentMode "${payMode}"`);
    }

    const seatNum = get('seatNumber');
    if (seatNum !== undefined && seatNum !== null && seatNum !== '') {
      const n = Number(seatNum);
      if (!Number.isInteger(n) || n < 1) issues.push(`Invalid seatNumber: ${cellDisplay(seatNum)}`);
      else if (memberType === 'without-seat') issues.push('without-seat cannot have seatNumber');
      else if (libraryId && !seatNumbersInLib.has(n)) {
        issues.push(`Seat ${n} not found in library`);
      }
    }

    console.log(`\n--- Row ${r} ---`);
    console.log(JSON.stringify(rowData, null, 2));
    if (issues.length) {
      console.log('ISSUES:');
      issues.forEach((i) => console.log(`  ❌ ${i}`));
    } else {
      console.log('  ✅ Row looks valid (dry-run, no DB write)');
    }
  }

  if (dataRows === 0) {
    console.log('\n❌ No data rows found (only header or empty sheet)');
  } else {
    console.log(`\nTotal data rows: ${dataRows}`);
  }
}

const run = async () => {
  const files = process.argv.slice(2).filter((a) => a.endsWith('.xlsx') || a.endsWith('.xls'));
  const libraryIdArg = process.argv.slice(2).find((a) => /^[a-f0-9]{24}$/i.test(a));

  let libraryId = libraryIdArg;
  if (!libraryId) {
    await connectDB();
    const lib = await Library.findOne().sort({ createdAt: -1 });
    libraryId = lib?._id.toString();
    console.log(`Using library: ${lib?.libraryName} (${libraryId})`);
  } else {
    await connectDB();
  }

  const toAnalyze =
    files.length > 0
      ? files
      : ['member-import-template (1).xlsx', 'member-import-template Drishti.xlsx'];

  for (const f of toAnalyze) {
    await diagnoseFile(f, libraryId);
  }

  process.exit(0);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
