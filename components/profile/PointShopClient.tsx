'use client';

import { useMemo, useState } from 'react';
import { formatAmountDown2 } from '@/lib/numberFormat';

type ItemView = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  pointsCost: string;
  stock: number | null;
  deliveryType: 'COUPON' | 'MANUAL' | 'BALANCE';
  balanceCreditAmount: string;
};

type CartLineView = {
  itemId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPoints: string;
  subtotalPoints: string;
  stock: number | null;
};

type CartView = {
  cartId: string;
  version: number;
  updatedAt: string;
  lines: CartLineView[];
  totalQuantity: number;
  totalPoints: string;
};

type DashboardView = {
  points: string;
  items: ItemView[];
  cart: CartView | null;
};

type PointShopClientProps = {
  initialData: DashboardView;
};

type NoticeLevel = 'info' | 'success' | 'error';

const fmt = (value: string | number) => {
  const formatted = formatAmountDown2(value);
  return formatted === '—' ? '0.00' : formatted;
};

async function fetchPointShop(action?: string, payload?: Record<string, unknown>) {
  const resp = await fetch('/api/point-shop', {
    method: action ? 'POST' : 'GET',
    headers: action ? { 'Content-Type': 'application/json' } : undefined,
    body: action ? JSON.stringify({ action, ...(payload ?? {}) }) : undefined,
    cache: 'no-store',
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(typeof json?.error === 'string' ? json.error : 'request_failed');
  }
  return json;
}

export function PointShopClient({ initialData }: PointShopClientProps) {
  const [data, setData] = useState<DashboardView>(initialData);
  const [loading, setLoading] = useState(false);
  const [qtyBySku, setQtyBySku] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState<{ text: string; level: NoticeLevel } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const cart = data.cart;
  const cartCount = cart?.totalQuantity ?? 0;

  const checkoutRequestKey = useMemo(() => {
    if (!cart) return '';
    return `web:${cart.cartId}:v${cart.version}`;
  }, [cart]);

  const refreshAll = async () => {
    const json = await fetchPointShop();
    if (json?.ok && json?.data) {
      setData(json.data as DashboardView);
    }
  };

  const runAction = async (runner: () => Promise<void>) => {
    if (loading) return;
    setLoading(true);
    setNotice(null);
    try {
      await runner();
    } catch (err) {
      setNotice({
        text: err instanceof Error ? `操作失败：${err.message}` : '操作失败',
        level: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (sku: string, quantityOverride?: number) => {
    const quantity = Math.max(
      1,
      Math.trunc(quantityOverride ?? qtyBySku[sku] ?? 1),
    );
    await runAction(async () => {
      const json = await fetchPointShop('add', { sku, quantity });
      const result = json?.result;
      if (result?.status === 'ok') {
        await refreshAll();
        return;
      }
      if (result?.status === 'item_not_found') {
        setNotice({ text: `商品不存在或已下架：${sku}`, level: 'error' });
        return;
      }
      if (result?.status === 'stock_insufficient') {
        setNotice({ text: `库存不足：${sku}，剩余 ${result.available}`, level: 'error' });
        return;
      }
      setNotice({ text: '加购失败，请稍后再试', level: 'error' });
    });
  };

  const handleRemove = async (sku: string, quantity = 1) => {
    await runAction(async () => {
      const json = await fetchPointShop('remove', { sku, quantity });
      const result = json?.result;
      if (result?.status === 'ok' || result?.status === 'empty_cart') {
        await refreshAll();
        setNotice({
          text: result?.status === 'ok' ? `已移除：${sku} x${quantity}` : '购物车已空',
          level: 'success',
        });
        return;
      }
      if (result?.status === 'item_not_in_cart') {
        setNotice({ text: `购物车里没有该商品：${sku}`, level: 'error' });
        return;
      }
      setNotice({ text: '移除失败，请稍后再试', level: 'error' });
    });
  };

  const handleClear = async () => {
    await runAction(async () => {
      const json = await fetchPointShop('clear');
      const result = json?.result;
      await refreshAll();
      setNotice({
        text: result?.status === 'empty_cart' ? '购物车本来就是空的' : '购物车已清空',
        level: 'success',
      });
    });
  };

  const handleCheckout = async () => {
    await runAction(async () => {
      const requestKey = checkoutRequestKey || undefined;
      const json = await fetchPointShop('checkout', { requestKey });
      const result = json?.result;

      if (result?.status === 'ok') {
        await refreshAll();
        setNotice({
          text: `兑换成功。消耗 ${fmt(result.totalPoints)} 积分，余额 ${fmt(
            result.pointsBefore,
          )} -> ${fmt(result.pointsAfter)}。`,
          level: 'success',
        });
        return;
      }

      if (result?.status === 'already_processed') {
        await refreshAll();
        setNotice({
          text: `请求已处理。消耗 ${fmt(result.totalPoints)} 积分。`,
          level: 'success',
        });
        return;
      }

      if (result?.status === 'insufficient_points') {
        setNotice({ text: `积分不足：当前 ${fmt(result.have)}，需要 ${fmt(result.need)}。`, level: 'error' });
        return;
      }

      if (result?.status === 'stock_insufficient') {
        await refreshAll();
        setNotice({ text: `库存不足：${result.sku} 剩余 ${result.available}。`, level: 'error' });
        return;
      }

      if (result?.status === 'item_unavailable') {
        await refreshAll();
        setNotice({
          text: `商品不可用：${result.sku}（${result.reason === 'inactive' ? '已下架' : '不存在'}）。`,
          level: 'error',
        });
        return;
      }

      if (result?.status === 'empty_cart') {
        setNotice({ text: '购物车为空，无法结算。', level: 'error' });
        return;
      }

      setNotice({ text: '结算失败，请稍后重试。', level: 'error' });
    });
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="rounded-3xl border border-black/5 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-gray-500">Jinlee Points Shop</p>
            <h1 className="text-3xl font-semibold tracking-wide">积分商城</h1>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.35em] text-gray-500">当前积分</p>
            <p className="text-3xl font-mono text-[#c18400]">{fmt(data.points)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-black/5 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">可兑换商品</h2>
        </div>

        {data.items.length === 0 ? (
          <p className="text-sm text-gray-500">暂无可兑换商品</p>
        ) : (
          <div className="pb-1">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,300px))] justify-start gap-4">
              {data.items.map((item) => {
                const qty = qtyBySku[item.sku] ?? 1;
                const soldOut = item.stock !== null && item.stock <= 0;
                const maxQty = item.stock === null ? 99 : Math.max(1, item.stock);
                return (
                  <div key={item.id} className="h-[220px] rounded-2xl border border-black/10 bg-white p-4 shadow-sm flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">{item.name}</p>
                        {item.description ? (
                          <p className="mt-1 h-12 overflow-hidden text-sm leading-6 text-gray-600">{item.description}</p>
                        ) : (
                          <p className="h-12" />
                        )}
                      </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">积分价</p>
                      <p className="text-xl font-mono text-[#c18400]">{fmt(item.pointsCost)}</p>
                    </div>
                  </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
                      <p>
                        {item.deliveryType === 'COUPON'
                          ? '自动发放'
                          : item.deliveryType === 'BALANCE'
                            ? `自动到账 +${fmt(item.balanceCreditAmount)}`
                            : '人工发放'}
                      </p>
                    </div>

                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center rounded-full border border-black/10 bg-white">
                      <button
                        type="button"
                        onClick={() =>
                          setQtyBySku((prev) => ({
                            ...prev,
                            [item.sku]: Math.max(1, (prev[item.sku] ?? 1) - 1),
                          }))
                        }
                        disabled={loading || soldOut || qty <= 1}
                        className="h-10 w-10 rounded-l-full text-base text-gray-600 hover:bg-black/5 disabled:opacity-40"
                        aria-label={`减少 ${item.name} 数量`}
                      >
                        -
                      </button>
                      <span className="inline-flex min-w-10 items-center justify-center px-2 text-sm font-medium">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setQtyBySku((prev) => ({
                            ...prev,
                            [item.sku]: Math.min(maxQty, (prev[item.sku] ?? 1) + 1),
                          }))
                        }
                        disabled={loading || soldOut || qty >= maxQty}
                        className="h-10 w-10 rounded-r-full text-base text-gray-600 hover:bg-black/5 disabled:opacity-40"
                        aria-label={`增加 ${item.name} 数量`}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdd(item.sku)}
                      disabled={loading || soldOut}
                      className="rounded-full border border-[#f8c84a] px-4 py-2 text-sm text-[#c18400] hover:bg-[#f8c84a]/12 disabled:opacity-50"
                    >
                      加入购物车
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setCartOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[#f8c84a] bg-white shadow-[0_10px_30px_rgba(17,24,39,0.18)] hover:bg-[#f8c84a]/12"
        aria-label="打开购物车"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 4h2l2.2 9.2a2 2 0 0 0 2 1.5h7.6a2 2 0 0 0 1.9-1.4L21 7H7" stroke="#c18400" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="10" cy="19" r="1.5" fill="#c18400"/>
          <circle cx="17" cy="19" r="1.5" fill="#c18400"/>
        </svg>
        {cartCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-6 items-center justify-center rounded-full bg-[#c18400] px-1.5 text-sm font-semibold text-white">
            {cartCount}
          </span>
        ) : null}
      </button>

      {cartOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="关闭购物车"
            className="absolute inset-0 bg-black/35"
            onClick={() => setCartOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-[#f7f3ef] p-4 sm:p-6">
            <div className="rounded-3xl border border-black/5 bg-white p-6 space-y-4 min-h-full">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">购物车</h2>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="rounded-full border border-black/10 px-4 py-2 text-xs hover:bg-black/5"
                >
                  关闭
                </button>
              </div>

              {!cart || cart.lines.length === 0 ? (
                <p className="text-sm text-gray-500">购物车为空</p>
              ) : (
                <div className="space-y-3">
              {cart.lines.map((line) => (
                <div key={`${line.itemId}-${line.sku}`} className="rounded-2xl border border-black/10 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{line.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono">{fmt(line.subtotalPoints)}</p>
                    </div>
                  </div>
                  <div className="pt-2 flex items-center justify-between gap-3">
                    <div className="inline-flex items-center rounded-full border border-black/10 bg-white">
                      <button
                        type="button"
                        onClick={() => handleRemove(line.sku, 1)}
                        disabled={loading || line.quantity <= 1}
                        className="h-9 w-9 rounded-l-full text-base text-gray-600 hover:bg-black/5 disabled:opacity-40"
                        aria-label={`减少 ${line.name} 数量`}
                      >
                        -
                      </button>
                      <span className="inline-flex min-w-10 items-center justify-center px-2 text-sm font-medium">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAdd(line.sku, 1)}
                        disabled={loading || (line.stock !== null && line.quantity >= line.stock)}
                        className="h-9 w-9 rounded-r-full text-base text-gray-600 hover:bg-black/5 disabled:opacity-40"
                        aria-label={`增加 ${line.name} 数量`}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(line.sku, line.quantity)}
                      disabled={loading}
                      className="rounded-full border border-black/10 px-3 py-1 text-xs hover:bg-black/5 disabled:opacity-50"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}

                  <div className="rounded-2xl border border-dashed border-black/10 p-4 space-y-3">
                    <p className="text-sm text-gray-600">总件数：{cart.totalQuantity}</p>
                    <p className="text-sm text-gray-600">总积分：{fmt(cart.totalPoints)}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleClear}
                        disabled={loading}
                        className="rounded-full border border-black/10 px-4 py-2.5 text-sm hover:bg-black/5 disabled:opacity-50"
                      >
                        清空购物车
                      </button>
                      <button
                        type="button"
                        onClick={handleCheckout}
                        disabled={loading}
                        className="rounded-full border border-[#f8c84a] px-4 py-2.5 text-sm font-semibold text-[#c18400] hover:bg-[#f8c84a]/12 disabled:opacity-50"
                      >
                        结算兑换
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-[#171717]">
              {notice.level === 'success' ? '操作成功' : notice.level === 'error' ? '操作失败' : '操作提示'}
            </h3>
            <p className="mt-3 text-sm leading-6 text-gray-700">{notice.text}</p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="rounded-full border border-[#f8c84a] px-5 py-2 text-sm font-semibold text-[#c18400] hover:bg-[#f8c84a]/12"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
