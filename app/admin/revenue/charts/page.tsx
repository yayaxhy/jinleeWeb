import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { isAdminDiscordId } from '@/lib/admin';
import { formatAmountDown2 } from '@/lib/numberFormat';
import { parseUtcDateRange } from '@/lib/utcDateRange';

export const metadata = {
  title: '收益图表',
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type DailyPoint = {
  day: string;
  value: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeId = (raw: string) => {
  const cleaned = raw.trim().replace(/^<@!?/, '').replace(/>$/, '');
  return /^\d+$/.test(cleaned) ? cleaned : '';
};

const parseExcludeIds = (value: string) =>
  value
    .split(/[\s,]+/)
    .map(normalizeId)
    .filter(Boolean);

const pad2 = (value: number) => String(value).padStart(2, '0');

const toDayKey = (date: Date) =>
  `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;

const parseNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    const text = (value as { toString?: () => string }).toString?.();
    const numeric = Number(text);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  return 0;
};

const getDateRowWindow = (start: Date, end: Date) => {
  const startDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 0, 0, 0, 0));
  const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 0, 0, 0, 0));
  const endHasTime =
    end.getUTCHours() !== 0 ||
    end.getUTCMinutes() !== 0 ||
    end.getUTCSeconds() !== 0 ||
    end.getUTCMilliseconds() !== 0;
  const endExclusive = new Date(endDay.getTime() + (endHasTime ? DAY_MS : 0));
  return { startDay, endExclusive };
};

const buildDayKeys = (start: Date, end: Date) => {
  const { startDay, endExclusive } = getDateRowWindow(start, end);
  const keys: string[] = [];
  for (let cur = new Date(startDay); cur < endExclusive; cur.setUTCDate(cur.getUTCDate() + 1)) {
    keys.push(toDayKey(cur));
  }
  return keys;
};

const buildDailySeries = <T extends Record<string, unknown>>(
  rows: T[],
  dateField: keyof T,
  valueField: keyof T,
  allDays: string[]
): DailyPoint[] => {
  const sumMap = new Map<string, number>();
  for (const row of rows) {
    const rawDate = row[dateField];
    if (!(rawDate instanceof Date) || Number.isNaN(rawDate.getTime())) continue;
    const key = toDayKey(rawDate);
    sumMap.set(key, (sumMap.get(key) ?? 0) + parseNumber(row[valueField]));
  }
  return allDays.map((day) => ({ day, value: sumMap.get(day) ?? 0 }));
};

const buildSearchHref = (pathname: string, params: Record<string, string>) => {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const query = qs.toString();
  return query ? `${pathname}?${query}` : pathname;
};

function LineGraphCard({
  title,
  subtitle,
  points,
  stroke,
}: {
  title: string;
  subtitle?: string;
  points: DailyPoint[];
  stroke: string;
}) {
  const width = 900;
  const height = 260;
  const padding = { top: 20, right: 18, bottom: 44, left: 58 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...points.map((p) => p.value));

  const xOf = (idx: number) =>
    points.length <= 1 ? padding.left + chartW / 2 : padding.left + (idx / (points.length - 1)) * chartW;
  const yOf = (value: number) => padding.top + chartH - (value / maxValue) * chartH;

  const pointPairs = points.map((p, idx) => `${xOf(idx)},${yOf(p.value)}`);
  const linePath = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${xOf(idx).toFixed(1)} ${yOf(p.value).toFixed(1)}`)
    .join(' ');
  const areaPath = points.length
    ? `${linePath} L ${xOf(points.length - 1).toFixed(1)} ${(padding.top + chartH).toFixed(1)} L ${xOf(0).toFixed(
        1
      )} ${(padding.top + chartH).toFixed(1)} Z`
    : '';

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const value = maxValue * t;
    return { value, y: yOf(value) };
  });

  const xLabelStep = Math.max(1, Math.ceil(points.length / 8));
  const total = points.reduce((sum, p) => sum + p.value, 0);
  const peak = points.reduce((prev, cur) => (cur.value > prev.value ? cur : prev), points[0] ?? { day: '-', value: 0 });
  const hoverZones = points.map((point, idx) => {
    const x = xOf(idx);
    const prevX = idx > 0 ? xOf(idx - 1) : padding.left;
    const nextX = idx < points.length - 1 ? xOf(idx + 1) : padding.left + chartW;
    const left = idx === 0 ? padding.left : (prevX + x) / 2;
    const right = idx === points.length - 1 ? padding.left + chartW : (x + nextX) / 2;
    return { point, left, width: Math.max(0, right - left) };
  });

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {subtitle ? <p className="text-xs text-white/60">{subtitle}</p> : null}
        </div>
        <div className="text-right text-xs text-white/70">
          <p>区间合计：¥{formatAmountDown2(total)}</p>
          <p>
            峰值：¥{formatAmountDown2(peak.value)}（{peak.day}）
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[760px] w-full">
          <defs>
            <linearGradient id={`grad-${title}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.32" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>

          <rect x="0" y="0" width={width} height={height} rx="18" fill="rgba(255,255,255,0.01)" />

          {yTicks.map((tick, index) => (
            <g key={`y-${title}-${index}`}>
              <line
                x1={padding.left}
                y1={tick.y}
                x2={padding.left + chartW}
                y2={tick.y}
                stroke="rgba(255,255,255,0.10)"
                strokeWidth="1"
              />
              <text x={padding.left - 8} y={tick.y + 4} textAnchor="end" fontSize="11" fill="rgba(255,255,255,0.6)">
                {formatAmountDown2(tick.value)}
              </text>
            </g>
          ))}

          {points.length > 0 ? (
            <>
              <path d={areaPath} fill={`url(#grad-${title})`} />
              <path d={linePath} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
              <polyline points={pointPairs.join(' ')} fill="none" stroke="transparent" />
              {points.map((point, idx) => (
                <g key={`dot-${title}-${point.day}`}>
                  <circle
                    cx={xOf(idx)}
                    cy={yOf(point.value)}
                    r="2.4"
                    fill={stroke}
                    stroke="rgba(0,0,0,0.35)"
                    strokeWidth="1"
                  />
                  {(idx % xLabelStep === 0 || idx === points.length - 1) && (
                    <text
                      x={xOf(idx)}
                      y={padding.top + chartH + 18}
                      textAnchor="middle"
                      fontSize="11"
                      fill="rgba(255,255,255,0.65)"
                    >
                      {point.day.slice(5)}
                    </text>
                  )}
                </g>
              ))}

              {hoverZones.map(({ point, left, width }, idx) => {
                const x = xOf(idx);
                const y = yOf(point.value);
                const tooltipText = `${point.day} · ¥${formatAmountDown2(point.value)}`;
                const tooltipW = 168;
                const tooltipH = 42;
                const tooltipX = Math.min(Math.max(x - tooltipW / 2, padding.left), padding.left + chartW - tooltipW);
                const tooltipY = Math.max(6, y - tooltipH - 10);

                return (
                  <g key={`hover-${title}-${point.day}`} className="group">
                    <title>{tooltipText}</title>

                    {/* hover capture zone */}
                    <rect
                      x={left}
                      y={padding.top}
                      width={width}
                      height={chartH}
                      fill="rgba(0,0,0,0)"
                    />

                    {/* crosshair */}
                    <line
                      x1={x}
                      y1={padding.top}
                      x2={x}
                      y2={padding.top + chartH}
                      stroke="rgba(255,255,255,0.35)"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      pointerEvents="none"
                    />
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={padding.left + chartW}
                      y2={y}
                      stroke="rgba(255,255,255,0.22)"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      pointerEvents="none"
                    />

                    {/* highlight point */}
                    <circle
                      cx={x}
                      cy={y}
                      r="5.5"
                      fill="rgba(255,255,255,0.08)"
                      stroke={stroke}
                      strokeWidth="2"
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      pointerEvents="none"
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r="2.8"
                      fill={stroke}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      pointerEvents="none"
                    />

                    {/* tooltip */}
                    <g
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      pointerEvents="none"
                    >
                      <rect
                        x={tooltipX}
                        y={tooltipY}
                        width={tooltipW}
                        height={tooltipH}
                        rx="10"
                        fill="rgba(8,10,15,0.92)"
                        stroke="rgba(255,255,255,0.18)"
                        strokeWidth="1"
                      />
                      <text x={tooltipX + 10} y={tooltipY + 18} fontSize="11" fill="rgba(255,255,255,0.72)">
                        {point.day}
                      </text>
                      <text x={tooltipX + 10} y={tooltipY + 33} fontSize="13" fill="#ffffff" fontWeight="700">
                        ¥{formatAmountDown2(point.value)}
                      </text>
                    </g>
                  </g>
                );
              })}
            </>
          ) : null}
        </svg>
      </div>
    </div>
  );
}

export default async function AdminRevenueChartsPage(props: PageProps) {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    redirect('/');
  }

  const searchParams = (await props.searchParams) ?? {};
  const startParam = Array.isArray(searchParams.startDate) ? searchParams.startDate[0] : searchParams.startDate;
  const endParam = Array.isArray(searchParams.endDate) ? searchParams.endDate[0] : searchParams.endDate;
  const excludeRechargeParam = Array.isArray(searchParams.excludeRecharge)
    ? searchParams.excludeRecharge[0]
    : searchParams.excludeRecharge;
  const excludeMemberParam = Array.isArray(searchParams.excludeMember)
    ? searchParams.excludeMember[0]
    : searchParams.excludeMember;

  const { start, end, startValue, endValue } = parseUtcDateRange(startParam, endParam);
  const excludeRechargeInput = (excludeRechargeParam ?? '').trim();
  const excludeMemberInput = (excludeMemberParam ?? '').trim();
  const excludeRechargeIds = excludeRechargeInput ? parseExcludeIds(excludeRechargeInput) : [];

  const [rechargeRows, giftRows, orderRows] = await Promise.all([
    prisma.recharge.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        ...(excludeRechargeIds.length ? { toWhom: { notIn: excludeRechargeIds } } : {}),
      },
      select: { createdAt: true, amount: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.giftAudit.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { createdAt: true, gross: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.order.findMany({
      where: { status: 'ENDED', endedAt: { gte: start, lt: end } },
      select: { endedAt: true, grossAmount: true },
      orderBy: { endedAt: 'asc' },
    }),
  ]);

  const allDays = buildDayKeys(start, end);
  const rechargeSeries = buildDailySeries(rechargeRows, 'createdAt', 'amount', allDays);
  const giftSeries = buildDailySeries(giftRows, 'createdAt', 'gross', allDays);
  const orderSeries = buildDailySeries(orderRows, 'endedAt', 'grossAmount', allDays);

  const revenueHref = buildSearchHref('/admin/revenue', {
    startDate: startValue,
    endDate: endValue,
    excludeRecharge: excludeRechargeInput,
    excludeMember: excludeMemberInput,
  });

  return (
    <div className="space-y-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.5em] text-white/60">ADMIN</p>
          <h2 className="text-2xl font-semibold">查看表格</h2>
          <p className="mt-1 text-sm text-white/60">
            区间（UTC+0）：{startValue.replace('T', ' ')} ~ {endValue.replace('T', ' ')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={revenueHref}
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

      <div className="space-y-5">
        <LineGraphCard title="每日总充值" points={rechargeSeries} stroke="#f5c542" subtitle="Recharge.amount（日汇总）" />
        <LineGraphCard title="每日总打赏" points={giftSeries} stroke="#55d4ff" subtitle="GiftAudit.gross（日汇总）" />
        <LineGraphCard title="每日总单子金额" points={orderSeries} stroke="#7ef0b3" subtitle="已结束订单 grossAmount（日汇总）" />
      </div>
    </div>
  );
}
