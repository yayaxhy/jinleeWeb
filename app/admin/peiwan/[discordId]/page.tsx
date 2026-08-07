import Link from 'next/link';
import {
  PEIWAN_GAME_CODES,
  PEIWAN_GAME_TIERS,
  PEIWAN_LEVEL_OPTIONS,
  PEIWAN_QUOTATION_FIELDS,
  PEIWAN_SEX_OPTIONS,
  PEIWAN_TYPE_OPTIONS,
  QUOTATION_CODES,
} from '@/constants/peiwan';
import { PeiwanForm } from '@/components/admin/PeiwanForm';
import { RestorePeiwanButton } from '@/components/admin/RestorePeiwanButton';
import { sortPeiwanGameProfiles, type PeiwanGameProfileView } from '@/lib/peiwan/gameProfiles';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { canEditPeiwanInfo, canManagePeiwan, canSyncSinglePeiwanTag, isHowardReadOnlyDiscordId } from '@/lib/admin';

export const metadata = {
  title: '编辑陪玩 - 锦鲤管理后台',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const buildInitialValues = (record: Awaited<ReturnType<typeof prisma.pEIWAN.findUnique>>) => {
  if (!record) return null;
  const plain = JSON.parse(JSON.stringify(record)) as Record<string, unknown>;
  const resolveEnum = <T extends readonly string[]>(value: unknown, options: T): T[number] | null => {
    if (typeof value !== 'string') return null;
    return (options as readonly string[]).includes(value) ? (value as T[number]) : null;
  };
  const defaultQuotationCode = resolveEnum(plain.defaultQuotationCode, QUOTATION_CODES) ?? QUOTATION_CODES[0];
  const typeValue = resolveEnum(plain.type, PEIWAN_TYPE_OPTIONS) ?? PEIWAN_TYPE_OPTIONS[0];
  const levelValue = resolveEnum(plain.level, PEIWAN_LEVEL_OPTIONS) ?? PEIWAN_LEVEL_OPTIONS[0];
  const sexValue = resolveEnum(plain.sex, PEIWAN_SEX_OPTIONS) ?? PEIWAN_SEX_OPTIONS[0];
  const quotations = Object.fromEntries(
    PEIWAN_QUOTATION_FIELDS.map((field) => {
      const value = plain[field];
      return [field, value === null || value === undefined ? '' : String(value)];
    }),
  ) as Record<(typeof PEIWAN_QUOTATION_FIELDS)[number], string>;

  const gameProfiles = Array.isArray(plain.gameProfiles)
    ? sortPeiwanGameProfiles(
        plain.gameProfiles.filter(
          (item): item is PeiwanGameProfileView => {
            if (!item || typeof item !== 'object') return false;
            const candidate = item as Record<string, unknown>;
            return (
              typeof candidate.gameCode === 'string' &&
              typeof candidate.tier === 'string' &&
              (PEIWAN_GAME_CODES as readonly string[]).includes(candidate.gameCode) &&
              (PEIWAN_GAME_TIERS.map((tier) => tier.code) as readonly string[]).includes(candidate.tier) &&
              (candidate.sourceRoleId === null ||
                candidate.sourceRoleId === undefined ||
                typeof candidate.sourceRoleId === 'string')
            );
          },
        ),
      )
    : [];

  return {
    peiwanId: String(plain.PEIWANID ?? ''),
    discordUserId: String(plain.discordUserId),
    defaultQuotationCode,
    commissionRate: plain.commissionRate ? String(plain.commissionRate) : '0.75',
    MP_url: (plain.MP_url as string) ?? '',
    totalEarn: plain.totalEarn ? String(plain.totalEarn) : '0',
    type: typeValue,
    level: levelValue,
    sex: sexValue,
    exclusive: Boolean(plain.exclusive),
    quotations,
    gameProfiles,
  };
};

type EditPageProps = {
  params: Promise<{ discordId: string }>;
};

export default async function EditPeiwanPage(props: EditPageProps) {
  const session = await getServerSession();
  if (!session?.discordId || !canEditPeiwanInfo(session.discordId)) {
    redirect('/');
  }
  const readOnly = isHowardReadOnlyDiscordId(session.discordId);
  const allowRoleSync = canSyncSinglePeiwanTag(session.discordId);
  const allowPeiwanAdminActions = canManagePeiwan(session.discordId);

  const resolvedParams = await props.params;
  const rawId = resolvedParams?.discordId ?? '';
  const searchToken = decodeURIComponent(rawId).trim();
  const MAX_PEIWAN_ID = 2_147_483_647; // align with Postgres int4 upper bound
  if (!searchToken) {
    return (
      <div className="space-y-6 text-white">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">未提供 Discord ID</h2>
          <p className="text-sm text-white/70">请返回后台首页重新输入。</p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-2 text-sm tracking-[0.2em] text-white hover:bg-white/10"
        >
          返回后台首页
        </Link>
      </div>
    );
  }

  const numericId = Number(searchToken);
  const searchByPeiwanId =
    Number.isSafeInteger(numericId) && numericId > 0 && numericId <= MAX_PEIWAN_ID;
  const peiwan =
    (searchByPeiwanId
      ? await prisma.pEIWAN.findUnique({
          where: { PEIWANID: numericId },
          include: { gameProfiles: { orderBy: { gameCode: 'asc' } } },
        })
      : null) || (await prisma.pEIWAN.findUnique({ where: { discordUserId: searchToken } }));
  const peiwanWithProfiles =
    peiwan && 'gameProfiles' in peiwan
      ? peiwan
      : peiwan
        ? await prisma.pEIWAN.findUnique({
            where: { discordUserId: peiwan.discordUserId },
            include: { gameProfiles: { orderBy: { gameCode: 'asc' } } },
          })
        : null;
  const discordId = peiwanWithProfiles?.discordUserId ?? searchToken;
  const deletionRecord = peiwanWithProfiles
    ? await prisma.peiwanDeletion.findUnique({ where: { peiwanId: peiwanWithProfiles.PEIWANID } })
    : null;
  const member = discordId
    ? await prisma.member.findUnique({
        where: { discordUserId: discordId },
        select: { status: true, serverDisplayName: true },
      })
    : null;

  if (!peiwanWithProfiles) {
    return (
      <div className="space-y-6 text-white">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">未找到陪玩</h2>
          <p className="text-sm text-white/70">搜索关键词：{searchToken}</p>
          <p className="text-sm text-rose-300">没有找到与该 ID 匹配的陪玩资料，先确认是否已创建。</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/admin/peiwan/new"
            className="inline-flex items-center justify-center rounded-full bg-[#5c43a3] px-6 py-2 text-sm tracking-[0.2em] text-white hover:bg-[#4a3388]"
          >
            去新增陪玩
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-2 text-sm tracking-[0.2em] text-white hover:bg-white/10"
          >
            返回后台首页
          </Link>
        </div>
      </div>
    );
  }
  const initialValues = buildInitialValues(peiwanWithProfiles);
  if (!initialValues) {
    return (
      <div className="space-y-6 text-white">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">数据解析失败</h2>
          <p className="text-sm text-white/70">Discord ID：{discordId}</p>
          <p className="text-sm text-rose-300">陪玩资料存在但无法解析，请检查数据库字段。</p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-2 text-sm tracking-[0.2em] text-white hover:bg-white/10"
        >
          返回后台首页
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">编辑陪玩</h2>
          <p className="text-sm text-white/70">
            当前用户：{member?.serverDisplayName?.trim() || '未知用户'}
          </p>
          <p className="text-sm text-white/60 font-mono">Discord ID：{discordId}</p>
          <p className="text-sm text-white/60">陪玩 ID：{peiwanWithProfiles.PEIWANID}</p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm tracking-[0.2em] text-white hover:bg-white/10"
        >
          返回管理首页
        </Link>
      </div>
      <div className={`grid gap-4 ${allowPeiwanAdminActions ? 'md:grid-cols-2' : ''}`}>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-2">
          <p className="text-sm text-white/80">
            当前身份：<span className="font-semibold text-white">{member?.status ?? '未知'}</span>
          </p>
          {deletionRecord ? (
            <p className="text-xs text-rose-300">
              已于 {new Date(deletionRecord.deletedAt).toLocaleString()} 下架
              {deletionRecord.deletedBy ? `，操作人：${deletionRecord.deletedBy}` : ''}
            </p>
          ) : (
            <p className="text-xs text-emerald-300">未下架，正常上架中</p>
          )}
        </div>
        {allowPeiwanAdminActions ? (
          <RestorePeiwanButton
            restoreToken={String(peiwanWithProfiles.PEIWANID ?? discordId)}
            isDeleted={Boolean(deletionRecord)}
            readOnly={readOnly}
          />
        ) : null}
      </div>
      <PeiwanForm mode="edit" initialValues={initialValues} readOnly={readOnly} allowRoleSync={allowRoleSync} />
    </div>
  );
}
