import type ExcelJS from 'exceljs';
import { reportStatusRows, reportIssueRows, type ReportCompleteness } from './report-facts';

/** First-sheet status remains visible even when the reader starts from Excel
 * rather than the website. Unknown amounts stay null in the detail journal. */
export function addReportFactsWorksheets(workbook: ExcelJS.Workbook, facts: ReportCompleteness, manualRows: Array<Record<string, unknown>>) {
  const status = workbook.addWorksheet('报表完整度');
  status.columns = [{ header: '项目', key: 'key', width: 24 }, { header: '说明', key: 'value', width: 100 }];
  for (const row of reportStatusRows(facts)) status.addRow({ key: row.key, value: row.value });
  const issues = workbook.addWorksheet('待核实事实');
  issues.columns = [{ header: '来源', key: 'source', width: 22 }, { header: '记录编号', key: 'recordIds', width: 45 },
    { header: '订单编号', key: 'orderIds', width: 30 }, { header: '待核实原因', key: 'reason', width: 90 }];
  reportIssueRows(facts).forEach(row => issues.addRow(row));
  const manual = workbook.addWorksheet('人工钱包调整');
  const keys = [...new Set(manualRows.flatMap(row => Object.keys(row)))];
  if (keys.length) {
    manual.columns = keys.map(key => ({ header: key, key, width: 28 }));
    manualRows.forEach(row => manual.addRow(row));
  } else manual.addRow(['本期无已核实人工钱包调整；待核实记录见完整度页。']);
  for (const sheet of [status, issues, manual]) { sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: 'frozen', ySplit: 1 }]; }
}
