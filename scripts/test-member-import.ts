/**
 * Test bulk member import with seatNumber.
 * Usage: npx ts-node scripts/test-member-import.ts [libraryId]
 */
import 'dotenv/config';
import ExcelJS from 'exceljs';
import { connectDB } from '../src/config/db';
import { Library } from '../src/models/library.model';
import { Seat } from '../src/models/seat.model';
import { Member } from '../src/models/member.model';
import { adminImportService } from '../src/services/adminImport.service';

const run = async () => {
  await connectDB();

  let libraryId = process.argv[2];
  if (!libraryId) {
    const lib = await Library.findOne().sort({ createdAt: -1 }).select('_id libraryName');
    if (!lib) {
      throw new Error('No library found in database');
    }
    libraryId = lib._id.toString();
    console.log(`Using library: ${lib.libraryName} (${libraryId})`);
  }

  const seats = await Seat.find({ library: libraryId })
    .sort({ seatNumber: 1 })
    .select('seatNumber status')
    .lean();

  if (seats.length < 3) {
    throw new Error(`Library needs at least 3 seats, found ${seats.length}`);
  }

  const pickSeats = [seats[0].seatNumber, seats[1].seatNumber, seats[2].seatNumber];
  console.log('Seat numbers for test:', pickSeats);

  const beforeCount = await Member.countDocuments({ library: libraryId });
  console.log('Members before import:', beforeCount);

  const ts = Date.now();
  const rows = [
    {
      fullName: `Import Test A ${ts}`,
      mobileNumber: `91${String(ts).slice(-8)}`,
      email: `import.a.${ts}@test.com`,
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
      seatNumber: pickSeats[0],
      remarks: 'bulk import test',
      type: 'permanent',
    },
    {
      fullName: `Import Test B ${ts}`,
      mobileNumber: `92${String(ts).slice(-8)}`,
      email: `import.b.${ts}@test.com`,
      courseName: 'NEET',
      shiftType: 'Evening',
      startDate: '2026-06-01',
      endDate: '2026-07-01',
      membershipPlan: '',
      feePerMonth: '',
      discount: '',
      amountPaid: '',
      paymentStatus: '',
      paymentMode: '',
      seatNumber: pickSeats[1],
      remarks: 'demo import test',
      type: 'demo',
    },
    {
      fullName: `Import Test C ${ts}`,
      mobileNumber: `93${String(ts).slice(-8)}`,
      email: `import.c.${ts}@test.com`,
      courseName: 'JEE',
      shiftType: 'Full Day',
      startDate: '2026-06-01',
      endDate: '2026-09-01',
      membershipPlan: '3 Months',
      feePerMonth: 600,
      discount: 0,
      amountPaid: 1800,
      paymentStatus: 'paid',
      paymentMode: 'upi',
      seatNumber: pickSeats[2],
      remarks: '',
      type: 'permanent',
    },
    {
      fullName: `Import Test D ${ts}`,
      mobileNumber: `94${String(ts).slice(-8)}`,
      email: '',
      courseName: 'CA',
      shiftType: 'Morning',
      startDate: '2026-06-01',
      endDate: '2026-08-01',
      membershipPlan: '2 Months',
      feePerMonth: 400,
      discount: 0,
      amountPaid: 800,
      paymentStatus: 'paid',
      paymentMode: 'cash',
      seatNumber: '',
      remarks: 'without seat',
      type: 'without-seat',
    },
  ];

  const columns = [
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

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Members');
  sheet.addRow([...columns]);
  for (const row of rows) {
    sheet.addRow(columns.map((col) => row[col]));
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const result = await adminImportService.importMembersFromExcel(libraryId, buffer);

  console.log('\n--- Import API result ---');
  console.log(JSON.stringify(result, null, 2));

  const afterCount = await Member.countDocuments({ library: libraryId });
  console.log('\nMembers after import:', afterCount, `(+${afterCount - beforeCount})`);

  const importedMembers = await Member.find({
    library: libraryId,
    fullName: { $regex: `Import Test [ABCD] ${ts}` },
  })
    .populate('seat', 'seatNumber')
    .sort({ fullName: 1 })
    .lean();

  console.log('\n--- Database verification ---');
  for (const m of importedMembers) {
    const seat = m.seat as { seatNumber?: number } | null | undefined;
    console.log({
      memberId: m.memberId,
      fullName: m.fullName,
      mobileNumber: m.mobileNumber,
      memberType: m.memberType,
      seatNumber: seat?.seatNumber ?? null,
      status: m.status,
    });
  }

  if (result.imported !== 4 || importedMembers.length !== 4) {
    console.error('\nTEST FAILED: expected 4 imported members in DB');
    process.exit(1);
  }

  console.log('\nTEST PASSED: 4 members created in database with seat assignments.');
  process.exit(0);
};

run().catch((err) => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
