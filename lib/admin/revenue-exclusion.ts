import { Prisma } from '@prisma/client';
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
  dlmId: string | null;
  discordUserId: string | null;
  displayName: string;
};

export type ResolvedRevenueExclusions = {
  excludeDlmIds: string[];
  excludeDiscordIds: string[];
  preview: RevenueExclusionPreview[];
};

export async function resolveRevenueExclusions(
  ids: string[],
): Promise<ResolvedRevenueExclusions> {
  const normalized = Array.from(new Set(ids.map(normalizeRevenueIdentity).filter(Boolean)));
  if (!normalized.length) {
    return {
      excludeDlmIds: [],
      excludeDiscordIds: [],
      preview: [],
    };
  }

  const matches = await prisma.dlmUser.findMany({
    where: {
      OR: [
        { dlmId: { in: normalized } },
        { discordUserId: { in: normalized } },
      ],
    },
    select: {
      dlmId: true,
      discordUserId: true,
      discordDisplayName: true,
      wechatDisplayName: true,
      member: { select: { serverDisplayName: true } },
    },
  });

  const matchByInput = new Map<
    string,
    {
      dlmId: string;
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

    matchByInput.set(row.dlmId, {
      dlmId: row.dlmId,
      discordUserId: row.discordUserId ?? null,
      displayName,
    });

    if (row.discordUserId) {
      matchByInput.set(row.discordUserId, {
        dlmId: row.dlmId,
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
        dlmId: matched.dlmId,
        discordUserId: matched.discordUserId,
        displayName: matched.displayName,
      };
    }

    if (/^\d+$/.test(input)) {
      return {
        input,
        dlmId: null,
        discordUserId: input,
        displayName: '未知用户',
      };
    }

    return {
      input,
      dlmId: input,
      discordUserId: null,
      displayName: '未知用户',
    };
  });

  return {
    excludeDlmIds: Array.from(new Set(preview.map((row) => row.dlmId).filter((value): value is string => Boolean(value)))),
    excludeDiscordIds: Array.from(new Set(preview.map((row) => row.discordUserId).filter((value): value is string => Boolean(value)))),
    preview,
  };
}

/**
 * Coupon rows can be associated with a Dlm ID, a Discord ID, or both.
 * Explicitly allow a nullable identity column here: SQL's `NOT (A OR B)`
 * treats `B = NULL` as unknown and would otherwise filter out unrelated rows.
 */
export const buildRevenueCouponIdentityExclusion = (
  excludeDlmIds: string[],
  excludeDiscordIds: string[],
): Prisma.CouponWhereInput => {
  const clauses: Prisma.CouponWhereInput[] = [];

  if (excludeDlmIds.length) {
    clauses.push({
      OR: [
        { dlmId: null },
        { dlmId: { notIn: excludeDlmIds } },
      ],
    });
  }

  if (excludeDiscordIds.length) {
    clauses.push({
      OR: [
        { discordId: null },
        { discordId: { notIn: excludeDiscordIds } },
      ],
    });
  }

  return clauses.length ? { AND: clauses } : {};
};
