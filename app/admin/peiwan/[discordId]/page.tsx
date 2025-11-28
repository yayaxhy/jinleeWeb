import Link from 'next/link';
import {
  PEIWAN_GAME_TAG_FIELDS,
  PEIWAN_LEVEL_OPTIONS,
  PEIWAN_QUOTATION_FIELDS,
  PEIWAN_SEX_OPTIONS,
  PEIWAN_TYPE_OPTIONS,
  QUOTATION_CODES,
} from '@/constants/peiwan';
import { PeiwanForm } from '@/components/admin/PeiwanForm';
import { prisma } from '@/lib/prisma';

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

  const gameTags = Object.fromEntries(
    PEIWAN_GAME_TAG_FIELDS.map((tag) => [tag, Boolean(plain[tag])]),
  ) as Record<(typeof PEIWAN_GAME_TAG_FIELDS)[number], boolean>;

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
    techTag: Boolean(plain.techTag),
    exclusive: Boolean(plain.exclusive),
    quotations,
    gameTags,
  };
};

type EditPageProps = {
  params: { discordId: string } | Promise<{ discordId: string }>;
};

export default async function EditPeiwanPage(props: EditPageProps) {
  const resolvedParams = await Promise.resolve(props.params);
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
      ? await prisma.pEIWAN.findUnique({ where: { PEIWANID: numericId } })
      : null) || (await prisma.pEIWAN.findUnique({ where: { discordUserId: searchToken } }));
  const discordId = peiwan?.discordUserId ?? searchToken;

  if (!peiwan) {
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
  const initialValues = buildInitialValues(peiwan);
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
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">编辑陪玩</h2>
        <p className="text-sm text-white/70">当前 Discord ID：{discordId}</p>
        <p className="text-sm text-white/60">陪玩 ID：{peiwan.PEIWANID}</p>
      </div>
      <PeiwanForm mode="edit" initialValues={initialValues} />
    </div>
  );
}
