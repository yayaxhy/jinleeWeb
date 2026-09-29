import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';
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
  const currentUser = await getCurrentDlmUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const legacyAccounts =
    currentUser.discordUserId &&
    !currentUser.dlmUser.withdrawAccount1 &&
    !currentUser.dlmUser.withdrawAccount2 &&
    !currentUser.dlmUser.withdrawAccount3
      ? await prisma.withdrawalAccount.findUnique({
          where: { discordUserId: currentUser.discordUserId },
          select: { account1: true, account2: true, account3: true },
        })
      : null;

  const accounts = {
    account1: currentUser.dlmUser.withdrawAccount1 ?? legacyAccounts?.account1 ?? null,
    account2: currentUser.dlmUser.withdrawAccount2 ?? legacyAccounts?.account2 ?? null,
    account3: currentUser.dlmUser.withdrawAccount3 ?? legacyAccounts?.account3 ?? null,
  };

  return NextResponse.json(accounts ?? { account1: null, account2: null, account3: null });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentDlmUser(request);
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
  const dlmData: Prisma.DlmUserUpdateInput =
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
    await tx.dlmUser.update({
      where: { dlmId: currentUser.dlmId },
      data: dlmData,
    });

    if (currentUser.discordUserId) {
      await tx.withdrawalAccount.upsert({
        where: { discordUserId: currentUser.discordUserId },
        create: {
          discordUserId: currentUser.discordUserId,
          dlmId: currentUser.dlmId,
          ...legacyData,
        },
        update: {
          dlmId: currentUser.dlmId,
          ...legacyData,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
