import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { parseStoredWithdrawAccount } from '@/lib/withdrawAccounts';
import {
  validateWithdrawAccountDetail,
  WithdrawAccountValidationError,
} from '@/lib/withdrawAccountValidation';

class WithdrawError extends Error {
  code: string;
  status: number;
  meta?: Record<string, unknown>;

  constructor(code: string, status = 400, meta?: Record<string, unknown>) {
    super(code);
    this.code = code;
    this.status = status;
    this.meta = meta;
  }
}

const MIN_WITHDRAW_AMOUNT = 100;
const WITHDRAW_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const INTERNAL_API_HOST = process.env.INTERNAL_API_HOST ?? '127.0.0.1';
const INTERNAL_API_PORT = process.env.INTERNAL_API_PORT;
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN;

const parseAmount = (raw: unknown): number | null => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim().length > 0) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const ensureMethod = (raw: unknown) => {
  if (typeof raw !== 'string') return '';
  return raw.trim();
};

type WithdrawalNotificationRequest = {
  userDiscordId: string;
  amount: string;
  requestedAt: string;
  withdrawalId: string;
  note: string;
  remainingIncome: string;
};

async function notifyBotWithdrawal(payload: WithdrawalNotificationRequest) {
  if (!INTERNAL_API_PORT || !INTERNAL_API_TOKEN) {
    throw new Error('内部接口未配置（INTERNAL_API_PORT/INTERNAL_API_TOKEN）');
  }

  const endpoint = `http://${INTERNAL_API_HOST}:${INTERNAL_API_PORT}/internal/withdrawals`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': INTERNAL_API_TOKEN,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data?.error === 'string' ? data.error : `内部提现通知失败 (${response.status})`;
    throw new Error(message);
  }

  return data as { ok: boolean; duplicate?: boolean };
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.discordId) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const amountNumber = parseAmount(body?.amount);
  if (amountNumber === null || amountNumber < MIN_WITHDRAW_AMOUNT) {
    return NextResponse.json({ ok: false, error: 'invalid_amount' }, { status: 400 });
  }
  const method = ensureMethod(body?.method);
  if (!method) {
    return NextResponse.json({ ok: false, error: 'invalid_method' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const withdrawalAccount = await tx.withdrawalAccount.findUnique({
        where: { discordUserId: session.discordId },
        select: { account1: true, account2: true, account3: true },
      });
      const savedMethods = [
        withdrawalAccount?.account1,
        withdrawalAccount?.account2,
        withdrawalAccount?.account3,
      ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

      if (!savedMethods.includes(method)) {
        throw new WithdrawError('method_not_saved');
      }

      const parsedMethod = parseStoredWithdrawAccount(method);
      if (!parsedMethod) {
        throw new WithdrawError('invalid_method');
      }
      try {
        await validateWithdrawAccountDetail(parsedMethod.method, parsedMethod.detail);
      } catch (error) {
        if (error instanceof WithdrawAccountValidationError) {
          throw new WithdrawError(error.code);
        }
        throw error;
      }

      const lastWithdraw = await tx.withdraw.findFirst({
        where: { discordId: session.discordId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      if (lastWithdraw?.createdAt) {
        const nextAvailableAt = new Date(lastWithdraw.createdAt.getTime() + WITHDRAW_COOLDOWN_MS);
        if (nextAvailableAt.getTime() > Date.now()) {
          throw new WithdrawError('withdraw_cooldown', 429, {
            nextAvailableAt: nextAvailableAt.toISOString(),
          });
        }
      }

      const member = await tx.member.findUnique({
        where: { discordUserId: session.discordId },
        select: { income: true, totalBalance: true },
      });
      if (!member) {
        throw new WithdrawError('member_not_found', 404);
      }

      const amountDecimal = new Prisma.Decimal(amountNumber);
      const incomeDecimal = new Prisma.Decimal(member.income ?? 0);
      const balanceDecimal = new Prisma.Decimal(member.totalBalance ?? 0);

      if (incomeDecimal.lt(amountDecimal) || balanceDecimal.lt(amountDecimal)) {
        throw new WithdrawError('insufficient_balance');
      }

      const updatedMember = await tx.member.update({
        where: { discordUserId: session.discordId },
        data: {
          income: { decrement: amountDecimal },
          totalBalance: { decrement: amountDecimal },
        },
        select: { income: true, totalBalance: true },
      });

      const withdrawRecord = await tx.withdraw.create({
        data: {
          discordId: session.discordId,
          amount: amountDecimal,
          method,
        },
        select: {
          id: true,
          createdAt: true,
          method: true,
        },
      });

      const balanceAfter = new Prisma.Decimal(updatedMember.totalBalance ?? 0);

      await tx.individualTransaction.create({
        data: {
          discordId: session.discordId,
          thirdPartydiscordId: method,
          balanceBefore: balanceDecimal,
          amountChange: amountDecimal.mul(-1),
          balanceAfter,
          typeOfTransaction: '提现',
        },
      });

      return {
        withdrawalId: withdrawRecord.id,
        remainingIncome: updatedMember.income?.toString() ?? '0',
        remainingBalance: updatedMember.totalBalance?.toString() ?? '0',
        nextAvailableAt: new Date(Date.now() + WITHDRAW_COOLDOWN_MS).toISOString(),
        notificationPayload: {
          userDiscordId: session.discordId,
          amount: amountDecimal.toFixed(2),
          requestedAt: withdrawRecord.createdAt.toISOString(),
          withdrawalId: withdrawRecord.id,
          note: withdrawRecord.method,
          remainingIncome: updatedMember.income?.toString() ?? '0',
        },
      };
    });

    let notificationStatus: 'sent' | 'duplicate' | 'failed' = 'failed';
    try {
      const notifyResult = await notifyBotWithdrawal(result.notificationPayload);
      notificationStatus = notifyResult.duplicate ? 'duplicate' : 'sent';
    } catch (error) {
      console.error('[withdraw] bot notification failed', {
        withdrawalId: result.withdrawalId,
        error,
      });
    }

    return NextResponse.json({
      ok: true,
      withdrawalId: result.withdrawalId,
      remainingIncome: result.remainingIncome,
      remainingBalance: result.remainingBalance,
      nextAvailableAt: result.nextAvailableAt,
      notificationStatus,
    });
  } catch (error) {
    if (error instanceof WithdrawError) {
      return NextResponse.json(
        { ok: false, error: error.code, ...(error.meta ?? {}) },
        { status: error.status },
      );
    }
    console.error('[withdraw] failed to process request', error);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
