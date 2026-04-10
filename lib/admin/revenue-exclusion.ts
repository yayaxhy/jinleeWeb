import { prisma } from '@/lib/prisma';

export const normalizeRevenueIdentity = (raw: string) => {
  const cleaned = raw.trim().replace(/^<@!?/, '').replace(/>$/, '');
  return cleaned || '';
};

export const parseRevenueIdentityList = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/[\s,]+/)
        .map(normalizeRevenueIdentity)
        .filter(Boolean),
    ),
  );

export type RevenueExclusionPreview = {
  input: string;
  jinleeId: string | null;
  discordUserId: string | null;
  displayName: string;
};

export type ResolvedRevenueExclusions = {
  excludeJinleeIds: string[];
  excludeDiscordIds: string[];
  preview: RevenueExclusionPreview[];
};

export async function resolveRevenueExclusions(
  ids: string[],
): Promise<ResolvedRevenueExclusions> {
  const normalized = Array.from(new Set(ids.map(normalizeRevenueIdentity).filter(Boolean)));
  if (!normalized.length) {
    return {
      excludeJinleeIds: [],
      excludeDiscordIds: [],
      preview: [],
    };
  }

  const matches = await prisma.jinleeUser.findMany({
    where: {
      OR: [
        { jinleeId: { in: normalized } },
        { discordUserId: { in: normalized } },
      ],
    },
    select: {
      jinleeId: true,
      discordUserId: true,
      discordDisplayName: true,
      wechatDisplayName: true,
      member: { select: { serverDisplayName: true } },
    },
  });

  const matchByInput = new Map<
    string,
    {
      jinleeId: string;
      discordUserId: string | null;
      displayName: string;
    }
  >();

  for (const row of matches) {
    const displayName =
      row.discordDisplayName?.trim() ||
      row.member?.serverDisplayName?.trim() ||
      row.wechatDisplayName?.trim() ||
      '未知用户';

    matchByInput.set(row.jinleeId, {
      jinleeId: row.jinleeId,
      discordUserId: row.discordUserId ?? null,
      displayName,
    });

    if (row.discordUserId) {
      matchByInput.set(row.discordUserId, {
        jinleeId: row.jinleeId,
        discordUserId: row.discordUserId,
        displayName,
      });
    }
  }

  const preview = normalized.map<RevenueExclusionPreview>((input) => {
    const matched = matchByInput.get(input);
    if (matched) {
      return {
        input,
        jinleeId: matched.jinleeId,
        discordUserId: matched.discordUserId,
        displayName: matched.displayName,
      };
    }

    if (/^\d+$/.test(input)) {
      return {
        input,
        jinleeId: null,
        discordUserId: input,
        displayName: '未知用户',
      };
    }

    return {
      input,
      jinleeId: input,
      discordUserId: null,
      displayName: '未知用户',
    };
  });

  return {
    excludeJinleeIds: Array.from(new Set(preview.map((row) => row.jinleeId).filter((value): value is string => Boolean(value)))),
    excludeDiscordIds: Array.from(new Set(preview.map((row) => row.discordUserId).filter((value): value is string => Boolean(value)))),
    preview,
  };
}
