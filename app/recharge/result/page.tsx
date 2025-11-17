import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

type RechargeResultProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const formatCurrency = (value?: string | null) => {
  if (!value) return '—';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(numeric);
};

export default async function RechargeResult({ searchParams = {} }: RechargeResultProps) {
  const session = await getServerSession();
  if (!session?.discordId) {
    redirect('/');
  }

  const rawOrder = searchParams.order;
  const outTradeNo = Array.isArray(rawOrder) ? rawOrder[0] : rawOrder;

  type OrderSummary = {
    outTradeNo: string;
    amountText: string;
    status: string;
    channel: string;
    paidAt: Date | null;
  };

  let order: OrderSummary | null = null;

  if (outTradeNo) {
    const record = await prisma.zPayRechargeOrder.findUnique({
      where: { outTradeNo },
      select: {
        outTradeNo: true,
        amount: true,
        status: true,
        channel: true,
        paidAt: true,
        createdAt: true,
        discordUserId: true,
      },
    });
    if (record && record.discordUserId === session.discordId) {
      order = {
        outTradeNo: record.outTradeNo,
        amountText: record.amount.toString(),
        status: record.status,
        channel: record.channel,
        paidAt: record.paidAt,
      };
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f3ef] px-6 py-12">
      <section className="max-w-3xl mx-auto space-y-8">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.6em] text-gray-500">Recharge Result</p>
          <h1 className="text-3xl font-semibold tracking-wide">充值结果</h1>
          <p className="text-sm text-gray-500">请根据下方状态确认是否到账。</p>
        </div>

        <div className="rounded-[32px] border border-black/5 bg-white p-8 space-y-6">
          {order ? (
            <>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">订单号</span>
                  <span className="font-mono text-xs">{order.outTradeNo}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">支付方式</span>
                  <span>{order.channel === 'wxpay' ? '微信支付' : '支付宝'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">金额</span>
                  <span className="text-lg font-semibold">{formatCurrency(order.amountText)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">状态</span>
                  <span
                    className={`font-semibold ${
                      order.status === 'PAID' ? 'text-emerald-600' : 'text-orange-500'
                    }`}
                  >
                    {order.status === 'PAID' ? '充值成功' : '等待支付确认'}
                  </span>
                </div>
                {order.paidAt ? (
                  <p className="text-xs text-gray-500">
                    到账时间：{new Date(order.paidAt).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">
                    若已支付但仍显示等待状态，请稍等片刻或联系管理员协助核对。
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-3 text-center text-sm text-gray-500">
              <p>未能找到匹配的订单，请返回充值页面重新发起支付。</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/recharge"
              className="flex-1 rounded-full border border-black/10 px-5 py-2 text-xs uppercase tracking-[0.4em] text-center hover:bg-black/5 transition"
            >
              返回充值
            </Link>
            <Link
              href="/profile"
              className="flex-1 rounded-full bg-black px-5 py-2 text-xs uppercase tracking-[0.4em] text-white text-center hover:bg-black/80 transition"
            >
              查看余额
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
