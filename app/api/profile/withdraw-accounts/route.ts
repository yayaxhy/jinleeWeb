import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import {
  buildStoredWithdrawAccount,
  isWithdrawMethodOption,
  normalizeWithdrawDetail,
  normalizeWithdrawMethod,
  WITHDRAW_METHOD_OPTIONS,
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

export async function GET() {
  const session = await getServerSession();
  if (!session?.discordId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const accounts = await prisma.withdrawalAccount.findUnique({
    where: { discordUserId: session.discordId },
    select: { account1: true, account2: true, account3: true },
  });

  return NextResponse.json(accounts ?? { account1: null, account2: null, account3: null });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.discordId) {
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
  const data: Partial<Record<'account1' | 'account2' | 'account3', string>> = {};
  data[`account${slot}` as const] = combined;

  await prisma.withdrawalAccount.upsert({
    where: { discordUserId: session.discordId },
    create: { discordUserId: session.discordId, ...data },
    update: data,
  });

  return NextResponse.json({ ok: true });
}
