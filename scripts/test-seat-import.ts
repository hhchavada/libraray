import 'dotenv/config';
import fs from 'fs';
import ExcelJS from 'exceljs';
import { connectDB } from '../src/config/db';
import { adminImportService } from '../src/services/adminImport.service';
import { Member } from '../src/models/member.model';

const libId = '6a09f88d9ef929b7cf8dab96';

(async () => {
  await connectDB();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(
    fs.readFileSync('member-import-template Drishti.xlsx') as unknown as ExcelJS.Buffer
  );
  const s = wb.worksheets[0];
  s.getRow(1).getCell(16).value = 'seatNumber';
  for (let r = 2; r <= 4; r++) s.getRow(r).getCell(16).value = r - 1;
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  const r = await adminImportService.importMembersFromExcel(libId, buf);
  console.log('warnings:', r.warnings);
  console.log('seatsAssigned:', r.seatsAssigned);
  const names = ['Mahesh', 'Ramkishor', 'Durgaram Dewasi'];
  const members = await Member.find({ library: libId, fullName: { $in: names } })
    .populate('seat', 'seatNumber')
    .sort({ createdAt: -1 })
    .limit(3);
  for (const m of members) {
    const seat = m.seat as { seatNumber?: number } | null;
    console.log(m.fullName, 'seat:', seat?.seatNumber ?? 'none');
  }
  process.exit(0);
})();
