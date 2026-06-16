import ExcelJS from 'exceljs';
import fs from 'fs';

const file = process.argv[2] || 'member-import-template Drishti.xlsx';

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fs.readFileSync(file) as unknown as ExcelJS.Buffer);
  const s = wb.worksheets[0];
  const h: string[] = [];
  s.getRow(1).eachCell((c, i) => {
    h[i] = String(c.value ?? '');
  });
  console.log('Headers:', h.filter(Boolean).join(' | '));
  console.log('Has seatNumber header:', h.some((x) => /seat/i.test(x)));
  for (let r = 2; r <= 5; r++) {
    const vals: string[] = [];
    s.getRow(r).eachCell((c, i) => {
      if (h[i]) vals.push(`${h[i]}=${c.value}`);
    });
    console.log(`Row ${r}:`, vals.join(', '));
  }
  process.exit(0);
})();
