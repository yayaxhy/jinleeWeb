import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

class WithdrawError extends Error {
  code: string;
  status: number;

  constructor(code: string, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

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
  if (amountNumber === null || amountNumber <= 0 || !Number.isInteger(amountNumber)) {
    return NextResponse.json({ ok: false, error: 'invalid_amount' }, { status: 400 });
  }
  const method = ensureMethod(body?.method);
  if (!method) {
    return NextResponse.json({ ok: false, error: 'invalid_method' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
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

      await tx.withdraw.create({
        data: {
          discordId: session.discordId,
          amount: amountNumber,
          method,
        },
      });

      return {
        remainingIncome: updatedMember.income?.toString() ?? '0',
        remainingBalance: updatedMember.totalBalance?.toString() ?? '0',
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof WithdrawError) {
      return NextResponse.json({ ok: false, error: error.code }, { status: error.status });
    }
    console.error('[withdraw] failed to process request', error);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
