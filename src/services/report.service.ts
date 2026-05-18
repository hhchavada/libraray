import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Member } from '../models/member.model';
import { Library } from '../models/library.model';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import { ReportType, ReportSortOrder } from '../constants/enums';
import { IMemberDocument } from '../models/member.model';

const REPORT_COLUMNS = [
  'Member ID',
  'Full Name',
  'Mobile',
  'Shift',
  'Plan',
  'Start Date',
  'End Date',
  'Seat Number',
  'Total Fee',
  'Amount Paid',
  'Due Amount',
  'Status',
] as const;

const formatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const mapMemberToRow = (member: IMemberDocument): (string | number)[] => {
  const seat = member.seat as { seatNumber?: number } | null | undefined;
  return [
    member.memberId,
    member.fullName,
    member.mobileNumber,
    member.shiftType,
    member.membershipPlan ?? '-',
    formatDate(member.startDate),
    formatDate(member.endDate),
    seat?.seatNumber ?? '-',
    member.totalFee ?? 0,
    member.amountPaid,
    member.dueAmount,
    member.status,
  ];
};

const buildDateFilter = (reportType: ReportType): Record<string, unknown> | null => {
  const now = new Date();

  switch (reportType) {
    case ReportType.THIS_MONTH: {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { startDate: { $gte: start, $lte: end } };
    }
    case ReportType.LAST_MONTH: {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { startDate: { $gte: start, $lte: end } };
    }
    case ReportType.ALL:
    default:
      return null;
  }
};

const buildSort = (sortOrder: ReportSortOrder): Record<string, 1 | -1> => {
  return sortOrder === ReportSortOrder.OLDEST_FIRST ? { createdAt: 1 } : { createdAt: -1 };
};

export const reportService = {
  async getMemberReport(
    libraryId: string,
    reportType: ReportType,
    sortOrder: ReportSortOrder,
    format: 'json' | 'excel' | 'pdf'
  ) {
    const library = await Library.findById(libraryId);
    if (!library) {
      throw new ApiError(404, MESSAGES.LIBRARY_NOT_FOUND);
    }

    const query: Record<string, unknown> = { library: libraryId };
    const dateFilter = buildDateFilter(reportType);
    if (dateFilter) {
      Object.assign(query, dateFilter);
    }

    const members = await Member.find(query)
      .populate('seat', 'seatNumber')
      .sort(buildSort(sortOrder));

    if (format === 'json') {
      return members;
    }

    const rows = members.map((m) => mapMemberToRow(m));

    if (format === 'excel') {
      return this.generateExcelBuffer(rows);
    }

    return this.generatePdfBuffer(rows, library.libraryName);
  },

  async generateExcelBuffer(rows: (string | number)[][]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Members');

    sheet.addRow([...REPORT_COLUMNS]);

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 22;

    for (const row of rows) {
      sheet.addRow(row);
    }

    sheet.columns.forEach((column) => {
      let maxLength = 12;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const cellValue = cell.value ? String(cell.value) : '';
        maxLength = Math.max(maxLength, cellValue.length + 2);
      });
      column.width = Math.min(maxLength, 40);
    });

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  },

  async generatePdfBuffer(rows: (string | number)[][], libraryName: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(16).font('Helvetica-Bold').text(`Member Report — ${libraryName}`, {
        align: 'center',
      });
      doc.moveDown(1);

      const colWidths = [55, 70, 65, 50, 50, 60, 60, 45, 50, 55, 50, 45];
      const startX = 40;
      let y = doc.y;

      const drawRow = (cells: string[], isHeader = false) => {
        let x = startX;
        if (isHeader) {
          doc.font('Helvetica-Bold').fontSize(8);
        } else {
          doc.font('Helvetica').fontSize(7);
        }

        cells.forEach((cell, i) => {
          doc.text(String(cell), x, y, { width: colWidths[i], align: 'left' });
          x += colWidths[i];
        });

        y += isHeader ? 16 : 14;

        if (y > doc.page.height - 60) {
          doc.addPage();
          y = 40;
        }
      };

      drawRow([...REPORT_COLUMNS], true);

      for (const row of rows) {
        drawRow(row.map(String));
      }

      doc.end();
    });
  },
};
