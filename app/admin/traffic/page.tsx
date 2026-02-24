import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { redirect } from 'next/navigation';
import { isAdminDiscordId } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type AggregateRow = {
  pv: bigint | number | string | null;
  uv: bigint | number | string | null;
  login_uv: bigint | number | string | null;
};

type TopPathRow = {
  path: string;
  pv: bigint | number | string;
  uv: bigint | number | string;
};

type DailyTrendRow = {
  day: string;
  pv: bigint | number | string;
  uv: bigint | number | string;
};

const BEIJING_OFFSET_MINUTES = 8 * 60;

const numberFormatter = new Intl.NumberFormat('zh-CN');

function toNumber(value: bigint | number | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'bigint') return Number(value);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getDayWindowUtcByOffset(base: Date, offsetMinutes: number) {
  const shifted = new Date(base.getTime() + offsetMinutes * 60_000);
  const shiftedMidnightUtcMs = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    0,
    0,
    0,
    0,
  );
  const startUtc = new Date(shiftedMidnightUtcMs - offsetMinutes * 60_000);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc, endUtc };
}

function getMonthStartUtcByOffset(base: Date, offsetMinutes: number) {
  const shifted = new Date(base.getTime() + offsetMinutes * 60_000);
  const shiftedMonthStartUtcMs = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    1,
    0,
    0,
    0,
    0,
  );
  return new Date(shiftedMonthStartUtcMs - offsetMinutes * 60_000);
}

function getScopeFilterSql(scope: 'public' | 'all') {
  if (scope === 'all') return Prisma.empty;
  return Prisma.sql`
    AND "path" NOT LIKE '/admin%'
    AND "path" NOT LIKE '/kefu%'
    AND "path" NOT LIKE '/howard%'
    AND "path" NOT LIKE '/iria%'
    AND "path" NOT LIKE '/accounts/discord/login/callback%'
  `;
}

async function aggregateWindow(startAt: Date, endAt: Date, scopeSql: Prisma.Sql) {
  const rows = await prisma.$queryRaw<AggregateRow[]>(Prisma.sql`
    SELECT
      COUNT(*)::bigint AS pv,
      COUNT(DISTINCT "visitorId")::bigint AS uv,
      COUNT(DISTINCT "discordUserId")::bigint AS login_uv
    FROM "PageViewEvent"
    WHERE "createdAt" >= ${startAt}
      AND "createdAt" < ${endAt}
      ${scopeSql}
  `);
  const row = rows[0] ?? { pv: 0, uv: 0, login_uv: 0 };
  return {
    pv: toNumber(row.pv),
    uv: toNumber(row.uv),
    loginUv: toNumber(row.login_uv),
  };
}

export default async function AdminTrafficPage(props: PageProps) {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    redirect('/');
  }

  const searchParams = (await props.searchParams) ?? {};
  const rawScope = Array.isArray(searchParams.scope) ? searchParams.scope[0] : searchParams.scope;
  const scope: 'public' | 'all' = rawScope === 'all' ? 'all' : 'public';
  const scopeSql = getScopeFilterSql(scope);

  const now = new Date();
  const { startUtc: todayStartUtc } = getDayWindowUtcByOffset(now, BEIJING_OFFSET_MINUTES);
  const monthStartUtc = getMonthStartUtcByOffset(now, BEIJING_OFFSET_MINUTES);
  const sevenDaysStartUtc = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysStartUtc = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const trendStartUtc = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [todayStats, sevenDayStats, monthStats, thirtyDayStats, topPathsRows, dailyTrendRows] =
    await Promise.all([
      aggregateWindow(todayStartUtc, now, scopeSql),
      aggregateWindow(sevenDaysStartUtc, now, scopeSql),
      aggregateWindow(monthStartUtc, now, scopeSql),
      aggregateWindow(thirtyDaysStartUtc, now, scopeSql),
      prisma.$queryRaw<TopPathRow[]>(Prisma.sql`
        SELECT
          "path",
          COUNT(*)::bigint AS pv,
          COUNT(DISTINCT "visitorId")::bigint AS uv
        FROM "PageViewEvent"
        WHERE "createdAt" >= ${thirtyDaysStartUtc}
          AND "createdAt" < ${now}
          ${scopeSql}
        GROUP BY "path"
        ORDER BY pv DESC, "path" ASC
        LIMIT 20
      `),
      prisma.$queryRaw<DailyTrendRow[]>(Prisma.sql`
        SELECT
          TO_CHAR(("createdAt" + INTERVAL '8 hour')::date, 'YYYY-MM-DD') AS day,
          COUNT(*)::bigint AS pv,
          COUNT(DISTINCT "visitorId")::bigint AS uv
        FROM "PageViewEvent"
        WHERE "createdAt" >= ${trendStartUtc}
          AND "createdAt" < ${now}
          ${scopeSql}
        GROUP BY 1
        ORDER BY day DESC
      `),
    ]);

  const topPaths = topPathsRows.map((row) => ({
    path: row.path,
    pv: toNumber(row.pv),
    uv: toNumber(row.uv),
  }));
  const dailyTrend = dailyTrendRows.map((row) => ({
    day: row.day,
    pv: toNumber(row.pv),
    uv: toNumber(row.uv),
  }));

  return (
    <div className="space-y-6 text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">网站浏览量</h2>
          <p className="text-sm text-white/60">PV / UV 统计（北京时间口径，默认排除后台管理页面）。</p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm tracking-[0.2em] text-white hover:bg-white/10"
        >
          返回管理首页
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/traffic?scope=public"
          className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm ${
            scope === 'public'
              ? 'bg-[#5c43a3] text-white'
              : 'border border-white/20 text-white hover:bg-white/10'
          }`}
        >
          公开页面
        </Link>
        <Link
          href="/admin/traffic?scope=all"
          className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm ${
            scope === 'all'
              ? 'bg-[#5c43a3] text-white'
              : 'border border-white/20 text-white hover:bg-white/10'
          }`}
        >
          全部页面（含后台）
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { title: '今日（北京时间）', ...todayStats },
          { title: '最近 7 天', ...sevenDayStats },
          { title: '本月累计（北京时间）', ...monthStats },
          { title: '最近 30 天', ...thirtyDayStats },
        ].map((card) => (
          <div key={card.title} className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-2">
            <p className="text-sm text-white/70">{card.title}</p>
            <p className="text-2xl font-semibold">PV {numberFormatter.format(card.pv)}</p>
            <p className="text-sm text-white/70">UV {numberFormatter.format(card.uv)}</p>
            <p className="text-xs text-white/50">登录用户 UV {numberFormatter.format(card.loginUv)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">最近 30 天页面排行</h3>
            <p className="text-xs text-white/50">按 PV 排序</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-[0.3em] text-white/50">
                <tr>
                  <th className="px-2 py-2 text-left">页面</th>
                  <th className="px-2 py-2 text-right">PV</th>
                  <th className="px-2 py-2 text-right">UV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {topPaths.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-4 text-white/60">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  topPaths.map((row) => (
                    <tr key={row.path}>
                      <td className="px-2 py-3 font-mono text-xs text-white/80 break-all">{row.path}</td>
                      <td className="px-2 py-3 text-right">{numberFormatter.format(row.pv)}</td>
                      <td className="px-2 py-3 text-right text-white/80">{numberFormatter.format(row.uv)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">最近 14 天趋势</h3>
            <p className="text-xs text-white/50">北京时间自然日</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-[0.3em] text-white/50">
                <tr>
                  <th className="px-2 py-2 text-left">日期</th>
                  <th className="px-2 py-2 text-right">PV</th>
                  <th className="px-2 py-2 text-right">UV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {dailyTrend.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-4 text-white/60">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  dailyTrend.map((row) => (
                    <tr key={row.day}>
                      <td className="px-2 py-3">{row.day}</td>
                      <td className="px-2 py-3 text-right">{numberFormatter.format(row.pv)}</td>
                      <td className="px-2 py-3 text-right text-white/80">{numberFormatter.format(row.uv)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
