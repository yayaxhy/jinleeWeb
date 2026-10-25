import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { addReportFactsWorksheets } from './admin/report-facts-workbook';
import { reportCompleteness, assertReportComplete, assertReportBalanced } from './admin/report-facts';

test('partial Excel retains structured gaps and unknown manual classification, rather than exporting zero', async () => {
  const facts = reportCompleteness([{ source: 'order', ids: ['A-BAD'], orderIds: ['BAD'], reason: '撤销缺少凭据' }]);
  const workbook = new ExcelJS.Workbook();
  addReportFactsWorksheets(workbook, facts, [{ id: 'M1', walletNetDelta: '25', profitDelta: '-25', grossDelta: null }]);
  const roundtrip = new ExcelJS.Workbook(); await roundtrip.xlsx.load(await workbook.xlsx.writeBuffer());
  assert.equal(roundtrip.worksheets[0].name, '报表完整度');
  assert.match(String(roundtrip.worksheets[0].getCell('B2').value), /不完整/);
  assert.equal(roundtrip.getWorksheet('待核实事实')!.getCell('B2').value, 'A-BAD');
  assert.equal(roundtrip.getWorksheet('人工钱包调整')!.getCell('C2').value, '-25');
  assert.equal(roundtrip.getWorksheet('人工钱包调整')!.getCell('D2').value, null);
  assert.throws(() => assertReportComplete(facts), /不能确认正式月报/);
  assert.doesNotThrow(() => assertReportComplete(reportCompleteness([])));
});

test('confirmed monthly Excel and snapshot are read as-is; forced regeneration and reconfirmation cannot overwrite them', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'partial-report-history-'));
  const oldDirectory = process.env.ADMIN_REVENUE_REPORT_DIR;
  process.env.ADMIN_REVENUE_REPORT_DIR = dir;
  try {
    const folder = path.join(dir, '2026-09'); await mkdir(folder);
    const snapshot = JSON.stringify({ version: 1, monthKey: '2026-09', confirmedAt: '2026-10-01T00:00:00Z', confirmedBy: 'admin', preview: { netProfit: '123.45', manualExpenses: [] } });
    const excel = Buffer.from('immutable financial original'); const admin = Buffer.from('immutable admin original');
    await writeFile(path.join(folder, 'confirmed-report.json'), snapshot);
    await writeFile(path.join(folder, '2026年9月财务报表.xlsx'), excel);
    await writeFile(path.join(folder, '2026年9月后台收益数据.xlsx'), admin);
    const reports = await import('./admin/monthly-financial-reports');
    const result = await reports.getMonthlyFinancialReportExcel('2026-09'); assert.deepEqual(result.buffer, excel);
    const existing = await reports.generateStoredMonthlyFinancialReports({ monthKey: '2026-09', force: false });
    assert.equal(existing.financialStatement.skipped, true); assert.equal(existing.adminData.skipped, true);
    await assert.rejects(reports.generateStoredMonthlyFinancialReports({ monthKey: '2026-09', force: true }), /不能重新生成或覆盖/);
    await assert.rejects(reports.confirmMonthlyFinancialReport('2026-09', 'admin'), /不能覆盖原报表/);
    assert.equal(await readFile(path.join(folder, 'confirmed-report.json'), 'utf8'), snapshot);
    assert.deepEqual(await readFile(path.join(folder, '2026年9月财务报表.xlsx')), excel);
    assert.deepEqual(await readFile(path.join(folder, '2026年9月后台收益数据.xlsx')), admin);
  } finally {
    if (oldDirectory === undefined) delete process.env.ADMIN_REVENUE_REPORT_DIR; else process.env.ADMIN_REVENUE_REPORT_DIR = oldDirectory;
    await rm(dir, { recursive: true, force: true });
  }
});


test('formal balance sheet guard rejects residual, malformed and unknown differences', () => {
  assert.doesNotThrow(() => assertReportBalanced('0'));
  for (const difference of ['0.01', '-0.0001', 'NaN', 'unknown', '']) assert.throws(() => assertReportBalanced(difference), /核对差额/);
});
