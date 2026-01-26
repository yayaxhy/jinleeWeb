import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

const METHOD_OPTIONS = ['微信', '支付宝', 'Paypal'] as const;
type MethodOption = (typeof METHOD_OPTIONS)[number];

const parseSlot = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 3) return null;
  return numeric as 1 | 2 | 3;
};

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

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
  const method = normalizeString(body.method) as MethodOption;
  const detail = normalizeString(body.detail);

  if (!slot) {
    return NextResponse.json({ error: 'slot_invalid' }, { status: 400 });
  }
  if (!method || !METHOD_OPTIONS.includes(method)) {
    return NextResponse.json({ error: 'method_invalid' }, { status: 400 });
  }
  if (!detail) {
    return NextResponse.json({ error: 'detail_required' }, { status: 400 });
  }
  const combined = `${method}:${detail}`;
  const data: Partial<Record<'account1' | 'account2' | 'account3', string>> = {};
  data[`account${slot}` as const] = combined;

  await prisma.withdrawalAccount.upsert({
    where: { discordUserId: session.discordId },
    create: { discordUserId: session.discordId, ...data },
    update: data,
  });

  return NextResponse.json({ ok: true });
}
