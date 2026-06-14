/**
 * Test Excel bulk member import end-to-end.
 * Usage: npx ts-node scripts/test-bulk-import.ts
 */
import 'dotenv/config';
import ExcelJS from 'exceljs';
import { MEMBER_IMPORT_COLUMNS } from '../src/services/adminImport.service';

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5000';
const API = `${BASE_URL}/api/v1`;
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@library.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'Admin@12345';

const uniqueSuffix = Date.now().toString().slice(-7);

const testRows = [
  {
    fullName: `Bulk Test Permanent ${uniqueSuffix}`,
    mobileNumber: `9${uniqueSuffix.padStart(9, '0').slice(0, 9)}`,
    email: `permanent.${uniqueSuffix}@test.com`,
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
    remarks: 'Bulk import test',
    type: 'permanent',
  },
  {
    fullName: `Bulk Test Demo ${uniqueSuffix}`,
    mobileNumber: `8${uniqueSuffix.padStart(9, '0').slice(0, 9)}`,
    email: `demo.${uniqueSuffix}@test.com`,
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
    remarks: 'Demo row',
    type: 'demo',
  },
  {
    fullName: `Bulk Test Expired ${uniqueSuffix}`,
    mobileNumber: `7${uniqueSuffix.padStart(9, '0').slice(0, 9)}`,
    email: '',
    courseName: 'JEE',
    shiftType: 'Full Day',
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    membershipPlan: '1 Month',
    feePerMonth: 400,
    discount: 0,
    amountPaid: 400,
    paymentStatus: 'paid',
    paymentMode: 'upi',
    remarks: 'Should become expired',
    type: 'without-seat',
  },
];

async function buildExcelBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Members');
  sheet.addRow([...MEMBER_IMPORT_COLUMNS]);
  for (const row of testRows) {
    sheet.addRow(MEMBER_IMPORT_COLUMNS.map((col) => row[col as keyof typeof row]));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

async function login(): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const json = (await res.json()) as {
    success: boolean;
    data?: { accessToken?: string };
    message?: string;
  };
  if (!res.ok || !json.data?.accessToken) {
    throw new Error(`Login failed: ${json.message || res.status}`);
  }
  return json.data.accessToken;
}

async function getFirstLibraryId(token: string): Promise<string> {
  const res = await fetch(`${API}/admin/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as {
    data?: { libraries?: Array<{ libraryId: string; libraryName: string }> };
    message?: string;
  };
  if (!res.ok) {
    throw new Error(`Dashboard failed: ${json.message || res.status}`);
  }
  const libraryId = json.data?.libraries?.[0]?.libraryId;
  if (!libraryId) {
    throw new Error('No library found in dashboard. Create a library first.');
  }
  return libraryId;
}

async function importMembers(token: string, libraryId: string, fileBuffer: Buffer) {
  const form = new FormData();
  form.append(
    'file',
    new Blob([fileBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    'bulk-import-test.xlsx'
  );

  const res = await fetch(`${API}/admin/libraries/${libraryId}/import-members`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = (await res.json()) as {
    success: boolean;
    message?: string;
    data?: {
      imported: number;
      failed: number;
      results: Array<{ row: number; success: boolean; memberId?: string; error?: string }>;
    };
  };
  return { status: res.status, json };
}

async function run() {
  console.log('=== Bulk Import Test ===');
  console.log(`API: ${API}`);

  const token = await login();
  console.log('Login: OK');

  const libraryId = await getFirstLibraryId(token);
  console.log(`Library: ${libraryId}`);

  const fileBuffer = await buildExcelBuffer();
  console.log(`Excel rows prepared: ${testRows.length}`);

  const { status, json } = await importMembers(token, libraryId, fileBuffer);
  console.log(`Import HTTP status: ${status}`);
  console.log('Import response:', JSON.stringify(json, null, 2));

  if (!json.success || !json.data) {
    throw new Error('Import API failed');
  }

  const { imported, failed, results } = json.data;
  if (imported !== testRows.length) {
    console.error('Expected all rows to import successfully.');
    process.exit(1);
  }
  if (failed > 0) {
    console.error('Some rows failed:', results.filter((r) => !r.success));
    process.exit(1);
  }

  console.log(`SUCCESS: ${imported}/${testRows.length} members imported`);
  for (const row of results) {
    console.log(`  Row ${row.row}: ${row.memberId}`);
  }
}

run().catch((err) => {
  console.error('TEST FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
