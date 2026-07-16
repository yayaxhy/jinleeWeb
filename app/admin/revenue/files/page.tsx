import Link from 'next/link';
import { redirect } from 'next/navigation';
import { canViewRevenue } from '@/lib/admin';
import {
  getFinancialAdjustmentsFilePath,
  getMonthlyReportStorageDir,
  listStoredMonthlyReportFiles,
} from '@/lib/admin/monthly-financial-reports';
import { getServerSession } from '@/lib/session';

export const metadata = {
  title: '收益文件',
};

export const dynamic = 'force-dynamic';

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const formatDate = (date: Date) =>
  date.toLocaleString('zh-CN', {
    timeZone: 'Europe/Rome',
    hour12: false,
  });

export default async function AdminRevenueFilesPage() {
  const session = await getServerSession();
  if (!session?.discordId || !canViewRevenue(session.discordId)) {
    redirect('/');
  }

  const files = await listStoredMonthlyReportFiles();

  return (
    <div className="space-y-8 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.6em] text-white/60">ADMIN</p>
          <h2 className="text-2xl font-semibold">收益文件</h2>
          <p className="mt-2 text-sm text-white/60">每月自动生成的财务报表和后台收益数据会保存在这里。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/revenue"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm text-white hover:bg-white/10"
          >
            返回查看收益
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm text-white hover:bg-white/10"
          >
            返回管理首页
          </Link>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
        <p>服务器文件夹：<code className="rounded bg-black/30 px-1 py-0.5 text-white">{getMonthlyReportStorageDir()}</code></p>
        <p className="mt-2">调整文件：<code className="rounded bg-black/30 px-1 py-0.5 text-white">{getFinancialAdjustmentsFilePath()}</code></p>
        <p className="mt-2">需要手工补收入或支出时，编辑调整文件后在下面选择月份并勾选覆盖重新生成。</p>
      </div>

      <form
        action="/api/admin/revenue/files/generate"
        method="post"
        className="grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-5 md:grid-cols-[minmax(0,1fr)_auto_auto]"
      >
        <label className="space-y-2 text-sm">
          <span className="text-white/70">手动生成月份</span>
          <input
            type="month"
            name="month"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
          />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm text-white/70">
          <input type="checkbox" name="force" value="1" className="h-4 w-4 accent-white" />
          覆盖同名文件
        </label>
        <button
          type="submit"
          className="self-end rounded-full bg-white/15 px-6 py-2 text-sm text-white hover:bg-white/25"
        >
          生成文件
        </button>
      </form>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">已保存文件</h3>
          <p className="text-sm text-white/60">{files.length} 个文件</p>
        </div>

        {files.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/60">
                  <th className="py-3 pr-4">月份</th>
                  <th className="py-3 pr-4">类型</th>
                  <th className="py-3 pr-4">文件名</th>
                  <th className="py-3 pr-4">大小</th>
                  <th className="py-3 pr-4">更新时间</th>
                  <th className="py-3 pr-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.relativePath} className="border-b border-white/10 last:border-0">
                    <td className="py-3 pr-4 font-mono text-white/80">{file.monthKey || '-'}</td>
                    <td className="py-3 pr-4 text-white/80">{file.kindLabel}</td>
                    <td className="py-3 pr-4 text-white">{file.fileName}</td>
                    <td className="py-3 pr-4 text-white/70">{formatFileSize(file.size)}</td>
                    <td className="py-3 pr-4 text-white/70">{formatDate(file.modifiedAt)}</td>
                    <td className="py-3 pr-4">
                      <a
                        href={file.downloadHref}
                        className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-1.5 text-xs text-white hover:bg-white/10"
                      >
                        下载
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-white/60">还没有保存的 Excel 文件。可以先手动生成一个月份，或等每月 1 号 00:00 自动生成。</p>
        )}
      </div>
    </div>
  );
}

