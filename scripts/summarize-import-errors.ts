import 'dotenv/config';
import fs from 'fs';
import { connectDB } from '../src/config/db';
import { adminImportService } from '../src/services/adminImport.service';

const libId = process.argv[2] || '6a09f88d9ef929b7cf8dab96';

(async () => {
  await connectDB();
  for (const file of ['member-import-template (1).xlsx', 'member-import-template Drishti.xlsx']) {
    const buf = fs.readFileSync(file);
    const r = await adminImportService.importMembersFromExcel(libId, buf as Buffer);
    console.log(`\n=== ${file} ===`);
    console.log(`imported: ${r.imported} failed: ${r.failed} total: ${r.totalRows}`);
    const failReasons: Record<string, number> = {};
    for (const row of r.results.filter((x) => !x.success)) {
      const key = row.error || 'unknown';
      failReasons[key] = (failReasons[key] || 0) + 1;
    }
    console.log('Failure reasons:', JSON.stringify(failReasons, null, 2));
    const failed = r.results.filter((x) => !x.success);
    if (failed.length <= 25) {
      failed.forEach((f) => console.log(`  row ${f.row}: ${f.error}`));
    }
  }
  process.exit(0);
})();
