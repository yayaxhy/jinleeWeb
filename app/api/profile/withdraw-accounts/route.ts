import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import {
  buildStoredWithdrawAccount,
  isWithdrawMethodOption,
  normalizeWithdrawDetail,
  normalizeWithdrawMethod,
} from '@/lib/withdrawAccounts';
import {
  validateWithdrawAccountDetail,
  WithdrawAccountValidationError,
} from '@/lib/withdrawAccountValidation';

const parseSlot = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 3) return null;
  return numeric as 1 | 2 | 3;
};

export async function GET(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const accounts = {
    account1: currentUser.jinleeUser.withdrawAccount1,
    account2: currentUser.jinleeUser.withdrawAccount2,
    account3: currentUser.jinleeUser.withdrawAccount3,
  };

  return NextResponse.json(accounts ?? { account1: null, account2: null, account3: null });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const slot = parseSlot(body.slot);
  const method = normalizeWithdrawMethod(body.method);
  const detail = normalizeWithdrawDetail(body.detail);

  if (!slot) {
    return NextResponse.json({ error: 'slot_invalid' }, { status: 400 });
  }
  if (!method || !isWithdrawMethodOption(method)) {
    return NextResponse.json({ error: 'method_invalid' }, { status: 400 });
  }

  let normalizedDetail = detail;
  try {
    normalizedDetail = await validateWithdrawAccountDetail(method, detail);
  } catch (error) {
    if (error instanceof WithdrawAccountValidationError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }

  const combined = buildStoredWithdrawAccount(method, normalizedDetail);
  const jinleeData: Prisma.JinleeUserUpdateInput =
    slot === 1
      ? { withdrawAccount1: combined }
      : slot === 2
        ? { withdrawAccount2: combined }
        : { withdrawAccount3: combined };
  const legacyData =
    slot === 1
      ? { account1: combined }
      : slot === 2
        ? { account2: combined }
        : { account3: combined };

  await prisma.$transaction(async (tx) => {
    await tx.jinleeUser.update({
      where: { jinleeId: currentUser.jinleeId },
      data: jinleeData,
    });

    if (currentUser.discordUserId) {
      await tx.withdrawalAccount.upsert({
        where: { discordUserId: currentUser.discordUserId },
        create: {
          discordUserId: currentUser.discordUserId,
          jinleeId: currentUser.jinleeId,
          ...legacyData,
        },
        update: {
          jinleeId: currentUser.jinleeId,
          ...legacyData,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
