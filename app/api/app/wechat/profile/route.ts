import { AccountProvider, Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { summarizeJinleeUser } from '@/lib/jinlee-user';

const normalizeNickname = (value: unknown) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, 64);
};

const mergeWechatProfile = (profile: Prisma.JsonValue | null, nickname: string) => {
  const nextProfile: Record<string, string> =
    profile && typeof profile === 'object' && !Array.isArray(profile)
      ? Object.entries(profile as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
          if (typeof value === 'string') {
            acc[key] = value;
          }
          return acc;
        }, {})
      : {};

  nextProfile.nickname = nickname;
  return nextProfile as Prisma.InputJsonValue;
};

export async function POST(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const nickname = normalizeNickname(body?.nickname);
  if (!nickname) {
    return NextResponse.json({ ok: false, error: 'missing_nickname' }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const binding = await tx.accountBinding.findFirst({
        where: {
          jinleeId: currentUser.jinleeId,
          provider: AccountProvider.WECHAT_MINIPROGRAM,
        },
        select: {
          id: true,
          profile: true,
        },
      });

      if (!binding) {
        throw new Error('wechat_binding_not_found');
      }

      await tx.accountBinding.update({
        where: { id: binding.id },
        data: {
          profile: mergeWechatProfile(binding.profile, nickname),
        },
      });

      return tx.jinleeUser.update({
        where: { jinleeId: currentUser.jinleeId },
        data: {
          wechatDisplayName: nickname,
        },
        include: {
          member: true,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      user: summarizeJinleeUser(updated),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'wechat_binding_not_found') {
      return NextResponse.json({ ok: false, error: 'wechat_binding_not_found' }, { status: 400 });
    }

    console.error('[wechat.profile.save] unexpected error', error);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
