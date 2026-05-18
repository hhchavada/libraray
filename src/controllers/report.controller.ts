import { Request, Response } from 'express';
import { reportService } from '../services/report.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { MESSAGES } from '../constants/messages';
import { ReportType, ReportSortOrder } from '../constants/enums';
const parseReportType = (type?: string): ReportType => {
  const values = Object.values(ReportType);
  if (type && values.includes(type as ReportType)) {
    return type as ReportType;
  }
  return ReportType.ALL;
};

const parseSortOrder = (sort?: string): ReportSortOrder => {
  const values = Object.values(ReportSortOrder);
  if (sort && values.includes(sort as ReportSortOrder)) {
    return sort as ReportSortOrder;
  }
  return ReportSortOrder.NEWEST_FIRST;
};

const parseFormat = (format?: string): 'json' | 'excel' | 'pdf' => {
  if (format === 'excel' || format === 'pdf' || format === 'json') {
    return format;
  }
  return 'json';
};

export const reportController = {
  getMemberReport: asyncHandler(async (req: Request, res: Response) => {
    const { libraryId } = req.params;
    const reportType = parseReportType(req.query.type as string);
    const sortOrder = parseSortOrder(req.query.sort as string);
    const format = parseFormat(req.query.format as string);

    const result = await reportService.getMemberReport(libraryId, reportType, sortOrder, format);

    if (format === 'excel') {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', 'attachment; filename=members.xlsx');
      res.send(result);
      return;
    }

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=members.pdf');
      res.send(result);
      return;
    }

    res.status(200).json(new ApiResponse(200, MESSAGES.REPORT_GENERATED, result));
  }),
};
