import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { canManageBossProfiles } from '@/lib/admin';
import { formatAmountDown2 } from '@/lib/numberFormat';
import { listStoredBossPortraits, type StoredBossPortrait } from '@/lib/bossProfile';
import {
  generateAllBossProfilesAction,
  generateMissingBossProfilesAction,
  generateSingleBossProfileAction,
} from './actions';

const CENTRAL_EUROPE_TIMEZONE = 'Europe/Berlin';

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function formatDate(value?: Date | null) {
  if (!value) return '—';
  return value.toLocaleString('zh-CN', { timeZone: CENTRAL_EUROPE_TIMEZONE });
}

function formatGames(profile: StoredBossPortrait) {
  return profile.topGames.length > 0 ? profile.topGames.join('、') : '暂未识别';
}

function Notice({ type, message }: { type: string; message: string }) {
  const className =
    type === 'error'
      ? 'border-rose-400/30 bg-rose-500/10 text-rose-100'
      : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100';

  return (
    <div className={`rounded-3xl border px-5 py-4 text-sm ${className}`}>
      {message}
    </div>
  );
}

function ProfileCard({ profile }: { profile: StoredBossPortrait }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div className="min-w-0 space-y-1">
          <div className="font-medium text-white/95">{profile.displayName}</div>
          <div className="break-all font-mono text-xs text-white/50">{profile.bossId}</div>
        </div>
        <form action={generateSingleBossProfileAction} className="inline-flex">
          <input type="hidden" name="bossId" value={profile.bossId} />
          <input type="hidden" name="sampleSize" value="50" />
          <button
            type="submit"
            className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.25em] text-white hover:bg-white/10"
          >
            刷新
          </button>
        </form>
      </div>

      <div className="grid gap-4 pt-4 sm:grid-cols-2 2xl:grid-cols-3">
        <div className="min-w-0 space-y-1">
          <div className="text-xs uppercase tracking-[0.25em] text-white/45">常玩游戏</div>
          <div className="break-words text-sm text-white/85">{formatGames(profile)}</div>
        </div>

        <div className="min-w-0 space-y-1">
          <div className="text-xs uppercase tracking-[0.25em] text-white/45">玩法风格</div>
          <div className="break-words text-sm text-white/85">{profile.styleLabel}</div>
        </div>

        <div className="min-w-0 space-y-1">
          <div className="text-xs uppercase tracking-[0.25em] text-white/45">陪玩偏好</div>
          <div className="break-words text-sm text-white/85">{profile.preferredCompanionLabel}</div>
        </div>

        <div className="min-w-0 space-y-1">
          <div className="text-xs uppercase tracking-[0.25em] text-white/45">段位推断</div>
          <div className="break-words text-sm text-white/85">{profile.rankLabel}</div>
        </div>

        <div className="min-w-0 space-y-1">
          <div className="text-xs uppercase tracking-[0.25em] text-white/45">消费画像</div>
          <div className="text-sm text-white/90">{profile.spendLevelLabel}</div>
          <div className="text-xs text-white/50">总消费 {formatAmountDown2(profile.totalSpentSnapshot)}</div>
          <div className="text-xs text-white/50">余额 {formatAmountDown2(profile.totalBalanceSnapshot)}</div>
        </div>

        <div className="min-w-0 space-y-1 text-sm text-white/85">
          <div className="text-xs uppercase tracking-[0.25em] text-white/45">样本</div>
          <div>派单 {profile.totalRequestCount}</div>
          <div className="text-xs text-white/50">抽样派单 {profile.sampledRequestCount}</div>
          <div className="text-xs text-white/50">完结 {profile.totalEndedOrderCount}</div>
          <div className="text-xs text-white/50">抽样完结 {profile.sampledEndedOrderCount}</div>
          <div className="text-xs text-white/50">抢单均值 {profile.averageClickCount.toFixed(2)}</div>
        </div>

        <div className="min-w-0 space-y-1 text-sm text-white/85">
          <div className="text-xs uppercase tracking-[0.25em] text-white/45">价格 / 时段</div>
          <div>客单价 {formatAmountDown2(profile.averageSpendPerOrder)}</div>
          <div className="text-xs text-white/50">单价 {formatAmountDown2(profile.averageUnitPrice)}/小时</div>
          <div className="break-words text-xs text-white/50">{profile.activeWindowLabel}</div>
        </div>

        <div className="min-w-0 space-y-1 text-sm text-white/85">
          <div className="text-xs uppercase tracking-[0.25em] text-white/45">更新时间</div>
          <div>{formatDate(profile.updatedAt)}</div>
          <div className="text-xs text-white/50">首次样本 {formatDate(profile.firstSeenAt)}</div>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="text-xs uppercase tracking-[0.25em] text-white/45">复购 / 证据</div>
          <div className="break-words text-xs text-white/50">{profile.repeatWorkerLabel}</div>
          {profile.evidenceLines.length > 0 ? (
            <details className="text-xs text-white/60">
              <summary className="cursor-pointer text-white/75">查看证据</summary>
              <div className="mt-2 space-y-1">
                {profile.evidenceLines.map((line) => (
                  <div key={line} className="break-words">
                    {line}
                  </div>
                ))}
              </div>
            </details>
          ) : (
            <div className="text-xs text-white/40">无证据片段</div>
          )}
        </div>
      </div>
    </article>
  );
}

export default async function BossProfilesPage(props: PageProps) {
  const session = await getServerSession();
  if (!session?.discordId || !canManageBossProfiles(session.discordId)) {
    redirect('/');
  }

  const searchParams = (await props.searchParams) ?? {};
  const noticeType = readParam(searchParams, 'type');
  const noticeMessage = readParam(searchParams, 'message');
  const profiles = await listStoredBossPortraits(500);

  return (
    <div className="space-y-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.6em] text-white/60">ADMIN</p>
          <h1 className="text-3xl font-semibold">老板画像</h1>
          <p className="text-sm text-white/60">直接在后台生成、批量回填并查看全部老板画像记录。</p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm text-white hover:bg-white/10"
        >
          返回管理首页
        </Link>
      </div>

      {noticeMessage ? <Notice type={noticeType} message={noticeMessage} /> : null}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">单个生成</h2>
            <p className="text-sm text-white/60">输入老板 Discord ID，立即生成或刷新画像。</p>
          </div>
          <form action={generateSingleBossProfileAction} className="grid gap-4 md:grid-cols-[1.4fr_0.8fr_auto] md:items-end">
            <div className="space-y-1">
              <label htmlFor="bossId" className="text-xs text-white/60">
                老板 Discord ID
              </label>
              <input
                id="bossId"
                name="bossId"
                type="text"
                required
                placeholder="例如 1421651539247894549"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="sampleSize" className="text-xs text-white/60">
                抽样条数
              </label>
              <input
                id="sampleSize"
                name="sampleSize"
                type="number"
                min={20}
                max={200}
                defaultValue={50}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-[#5c43a3] px-6 py-3 text-sm tracking-[0.2em] text-white hover:bg-[#4a3388]"
            >
              生成 / 刷新
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">批量生成</h2>
            <p className="text-sm text-white/60">从派单日志和订单表里去重老板 ID 后批量写库。</p>
          </div>
          <form className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="batchSampleSizeAll" className="text-xs text-white/60">
                抽样条数
              </label>
              <input
                id="batchSampleSizeAll"
                name="sampleSize"
                type="number"
                min={20}
                max={200}
                defaultValue={50}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
              />
            </div>
            <div className="grid gap-3">
              <button
                type="submit"
                formAction={generateAllBossProfilesAction}
                className="inline-flex w-full items-center justify-center rounded-full bg-[#5c43a3] px-6 py-3 text-sm tracking-[0.2em] text-white hover:bg-[#4a3388]"
              >
                批量生成全部老板画像
              </button>
              <button
                type="submit"
                formAction={generateMissingBossProfilesAction}
                className="inline-flex w-full items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm tracking-[0.2em] text-white hover:bg-white/10"
              >
                只生成未建档老板画像
              </button>
            </div>
          </form>
          <p className="text-xs text-white/50">时间展示和活跃时段口径都按中欧时间计算。</p>
        </section>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">画像记录</h2>
            <p className="text-sm text-white/60">当前已入库 {profiles.length} 条，按更新时间倒序展示。</p>
          </div>
        </div>

        {profiles.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {profiles.map((profile) => (
              <ProfileCard key={profile.bossId} profile={profile} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center text-sm text-white/50">
            还没有生成过任何老板画像。
          </div>
        )}
      </section>
    </div>
  );
}
