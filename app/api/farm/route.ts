import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { FARM_SEEDS, type FarmSeedTypeValue } from '@/lib/farmConfig';
import {
  exchangeBalanceToCoins,
  exchangeCoinsToPoints,
  exchangePointsToCoins,
  expandFarm,
  getFarmDashboard,
  harvestFarmPlot,
  plantFarmSeed,
  stealFarmPlot,
} from '@/lib/farm';

const isFarmSeedType = (value: unknown): value is FarmSeedTypeValue =>
  typeof value === 'string' && value in FARM_SEEDS;

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.discordId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const search = (url.searchParams.get('search') ?? '').trim();
    const targetDiscordId = (url.searchParams.get('targetDiscordId') ?? '').trim();

    if (search) {
      const keyword = search.slice(0, 64);
      const parsedId = Number.parseInt(keyword, 10);
      const rows = await prisma.pEIWAN.findMany({
        where: {
          discordUserId: { not: session.discordId },
          OR: [
            Number.isInteger(parsedId) ? { PEIWANID: parsedId } : undefined,
            { discordUserId: { contains: keyword, mode: 'insensitive' } },
            { serverDisplayName: { contains: keyword, mode: 'insensitive' } },
            { member: { serverDisplayName: { contains: keyword, mode: 'insensitive' } } },
          ].filter(Boolean) as Array<Record<string, unknown>>,
        },
        orderBy: [{ PEIWANID: 'asc' }],
        take: 8,
        include: {
          member: { select: { serverDisplayName: true } },
        },
      });

      return NextResponse.json({
        ok: true,
        data: rows.map((row) => ({
          id: row.PEIWANID,
          discordUserId: row.discordUserId,
          serverDisplayName: row.serverDisplayName ?? row.member?.serverDisplayName ?? row.discordUserId,
        })),
      });
    }

    const dashboard = await getFarmDashboard(targetDiscordId || session.discordId, session.discordId);
    return NextResponse.json({ ok: true, dashboard });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.discordId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? '').trim();

  try {
    let dashboard;
    let message = '操作成功';
    switch (action) {
      case 'exchange_balance': {
        dashboard = await exchangeBalanceToCoins(session.discordId, body?.amount);
        message = '已将余额兑换为金币';
        break;
      }
      case 'exchange_points': {
        dashboard = await exchangePointsToCoins(session.discordId, body?.amount);
        message = '已将积分兑换为金币';
        break;
      }
      case 'exchange_coins_to_points': {
        dashboard = await exchangeCoinsToPoints(session.discordId, body?.amount);
        message = '已将金币兑换为积分';
        break;
      }
      case 'plant': {
        if (!isFarmSeedType(body?.seedType)) {
          return NextResponse.json({ error: '未知种子' }, { status: 400 });
        }
        dashboard = await plantFarmSeed(session.discordId, Number(body?.plotIndex), body.seedType);
        message = '种植成功';
        break;
      }
      case 'harvest': {
        const result = await harvestFarmPlot(session.discordId, Number(body?.plotIndex));
        dashboard = result.dashboard;
        message = result.stolenCoins !== '0.00'
          ? `收获成功，获得 ${result.harvestCoins} 金币（被偷 ${result.stolenCoins}）`
          : `收获成功，获得 ${result.harvestCoins} 金币`;
        return NextResponse.json({ ok: true, message, dashboard, result });
        break;
      }
      case 'expand': {
        dashboard = await expandFarm(session.discordId);
        message = '扩地成功';
        break;
      }
      case 'steal': {
        const targetDiscordId = String(body?.targetDiscordId ?? '').trim();
        if (!targetDiscordId) {
          return NextResponse.json({ error: '缺少目标庄园' }, { status: 400 });
        }
        const result = await stealFarmPlot(session.discordId, targetDiscordId, Number(body?.plotIndex));
        return NextResponse.json({
          ok: true,
          message: `偷菜成功，获得 ${result.stolenCoins} 金币`,
          dashboard: result.targetDashboard,
          viewerDashboard: result.viewerDashboard,
          result,
        });
      }
      default:
        return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message, dashboard });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
