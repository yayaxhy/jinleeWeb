import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { redirect } from 'next/navigation';
import { canViewTraffic } from '@/lib/admin';
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
const LOGIN_EVENTS_PER_PAGE = 100;

const numberFormatter = new Intl.NumberFormat('zh-CN');
const beijingDateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

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

function getSingleSearchParam(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function getPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getLoginLocationLabel(event: {
  ipCountry: string | null;
  ipRegion: string | null;
  ipCity: string | null;
  ipAddressEncrypted: string | null;
}) {
  const parts = [event.ipCity, event.ipRegion, event.ipCountry].filter(
    (value): value is string => Boolean(value?.trim()),
  );
  if (parts.length > 0) return parts.join(' / ');
  return event.ipAddressEncrypted ? '所在地未记录' : 'IP 未记录';
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
  if (!session?.discordId || !canViewTraffic(session.discordId)) {
    redirect('/');
  }

  const searchParams = (await props.searchParams) ?? {};
  const rawScope = getSingleSearchParam(searchParams, 'scope');
  const scope: 'public' | 'all' = rawScope === 'all' ? 'all' : 'public';
  const scopeSql = getScopeFilterSql(scope);

  const now = new Date();
  const { startUtc: todayStartUtc } = getDayWindowUtcByOffset(now, BEIJING_OFFSET_MINUTES);
  const monthStartUtc = getMonthStartUtcByOffset(now, BEIJING_OFFSET_MINUTES);
  const sevenDaysStartUtc = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysStartUtc = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const trendStartUtc = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [todayStats, sevenDayStats, monthStats, thirtyDayStats, topPathsRows, dailyTrendRows, loginEventsTotal] =
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
      prisma.authLoginEvent.count({
        where: { discordUserId: { not: null } },
      }),
    ]);

  const totalLoginPages = Math.max(1, Math.ceil(loginEventsTotal / LOGIN_EVENTS_PER_PAGE));
  const requestedLoginPage = getPositiveInteger(getSingleSearchParam(searchParams, 'loginPage'), 1);
  const loginPage = Math.min(requestedLoginPage, totalLoginPages);
  const loginEvents = await prisma.authLoginEvent.findMany({
    where: { discordUserId: { not: null } },
    orderBy: { createdAt: 'desc' },
    skip: (loginPage - 1) * LOGIN_EVENTS_PER_PAGE,
    take: LOGIN_EVENTS_PER_PAGE,
    select: {
      id: true,
      discordUserId: true,
      provider: true,
      ipAddressEncrypted: true,
      ipCountry: true,
      ipRegion: true,
      ipCity: true,
      createdAt: true,
      member: { select: { serverDisplayName: true } },
      jinleeUser: { select: { discordDisplayName: true } },
    },
  });

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

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">登录记录</h3>
            <p className="text-xs text-white/50">
              Discord 登录用户，按最新登录时间排序；所在地为登录时由受信任反向代理提供的粗略位置。
            </p>
          </div>
          <p className="text-xs text-white/50">
            共 {numberFormatter.format(loginEventsTotal)} 条 · 第 {loginPage} / {totalLoginPages} 页
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] text-white/50">
              <tr>
                <th className="px-2 py-2 text-left">Discord ID</th>
                <th className="px-2 py-2 text-left">Discord 昵称</th>
                <th className="px-2 py-2 text-left">登录所在地</th>
                <th className="px-2 py-2 text-left">登录时间（北京时间）</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loginEvents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2 py-4 text-white/60">
                    暂无 Discord 登录记录
                  </td>
                </tr>
              ) : (
                loginEvents.map((event) => {
                  const displayName =
                    event.member?.serverDisplayName?.trim() ||
                    event.jinleeUser?.discordDisplayName?.trim() ||
                    '未知昵称';
                  return (
                    <tr key={event.id}>
                      <td className="px-2 py-3 font-mono text-xs text-white/80">{event.discordUserId}</td>
                      <td className="px-2 py-3">{displayName}</td>
                      <td className="px-2 py-3 text-white/80">{getLoginLocationLabel(event)}</td>
                      <td className="px-2 py-3 whitespace-nowrap text-white/80">
                        {beijingDateTimeFormatter.format(event.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalLoginPages > 1 ? (
          <div className="mt-4 flex items-center justify-end gap-3 text-sm">
            {loginPage > 1 ? (
              <Link
                href={`/admin/traffic?scope=${scope}&loginPage=${loginPage - 1}`}
                className="rounded-full border border-white/20 px-4 py-2 text-white hover:bg-white/10"
              >
                上一页
              </Link>
            ) : null}
            {loginPage < totalLoginPages ? (
              <Link
                href={`/admin/traffic?scope=${scope}&loginPage=${loginPage + 1}`}
                className="rounded-full border border-white/20 px-4 py-2 text-white hover:bg-white/10"
              >
                下一页
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
