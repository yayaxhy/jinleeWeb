'use client';
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


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
  const siteCopy = useSiteCopy();
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
        text: err instanceof Error ? siteCopy("site.components.profile.pointshopclient.09695714ae2f", {value1: String(err.message)}) : siteCopy("site.components.profile.pointshopclient.09e424b5e896"),
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
        setNotice({ text: siteCopy("site.components.profile.pointshopclient.3dc9f31132aa", {value1: String(sku)}), level: 'error' });
        return;
      }
      if (result?.status === 'stock_insufficient') {
        setNotice({ text: siteCopy("site.components.profile.pointshopclient.116d1510706e", {value1: String(sku), value2: String(result.available)}), level: 'error' });
        return;
      }
      setNotice({ text: siteCopy("site.components.profile.pointshopclient.df7d93f9ee0c"), level: 'error' });
    });
  };

  const handleRemove = async (sku: string, quantity = 1) => {
    await runAction(async () => {
      const json = await fetchPointShop('remove', { sku, quantity });
      const result = json?.result;
      if (result?.status === 'ok' || result?.status === 'empty_cart') {
        await refreshAll();
        setNotice({
          text: result?.status === 'ok' ? siteCopy("site.components.profile.pointshopclient.960c0f240ccd", {value1: String(sku), value2: String(quantity)}) : siteCopy("site.components.profile.pointshopclient.8e26c2e7c52a"),
          level: 'success',
        });
        return;
      }
      if (result?.status === 'item_not_in_cart') {
        setNotice({ text: siteCopy("site.components.profile.pointshopclient.c6665aa52b1d", {value1: String(sku)}), level: 'error' });
        return;
      }
      setNotice({ text: siteCopy("site.components.profile.pointshopclient.9b99ed53ec1f"), level: 'error' });
    });
  };

  const handleClear = async () => {
    await runAction(async () => {
      const json = await fetchPointShop('clear');
      const result = json?.result;
      await refreshAll();
      setNotice({
        text: result?.status === 'empty_cart' ? siteCopy("site.components.profile.pointshopclient.1ba7c9d6c4e4") : siteCopy("site.components.profile.pointshopclient.7851ec564e88"),
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
          text: siteCopy("site.components.profile.pointshopclient.c4faadbc5dde", {value1: String(fmt(result.totalPoints)), value2: String(fmt(
            result.pointsBefore,
          )), value3: String(fmt(result.pointsAfter))}),
          level: 'success',
        });
        return;
      }

      if (result?.status === 'already_processed') {
        await refreshAll();
        setNotice({
          text: siteCopy("site.components.profile.pointshopclient.30ee99e976d8", {value1: String(fmt(result.totalPoints))}),
          level: 'success',
        });
        return;
      }

      if (result?.status === 'insufficient_points') {
        setNotice({ text: siteCopy("site.components.profile.pointshopclient.2e1a9c303a14", {value1: String(fmt(result.have)), value2: String(fmt(result.need))}), level: 'error' });
        return;
      }

      if (result?.status === 'stock_insufficient') {
        await refreshAll();
        setNotice({ text: siteCopy("site.components.profile.pointshopclient.a4b1b51c2578", {value1: String(result.sku), value2: String(result.available)}), level: 'error' });
        return;
      }

      if (result?.status === 'item_unavailable') {
        await refreshAll();
        setNotice({
          text: siteCopy("site.components.profile.pointshopclient.16be66c17c88", {value1: String(result.sku), value2: String(result.reason === 'inactive' ? '已下架' : '不存在')}),
          level: 'error',
        });
        return;
      }

      if (result?.status === 'empty_cart') {
        setNotice({ text: siteCopy("site.components.profile.pointshopclient.f40408239b36"), level: 'error' });
        return;
      }

      setNotice({ text: siteCopy("site.components.profile.pointshopclient.c97a60a720e4"), level: 'error' });
    });
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="rounded-3xl border border-black/5 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-gray-500"><SiteText copyKey="site.components.profile.pointshopclient.9bbd961c3d40" /></p>
            <h1 className="text-3xl font-semibold tracking-wide"><SiteText copyKey="site.components.profile.pointshopclient.3b1b41c2da72" /></h1>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.35em] text-gray-500"><SiteText copyKey="site.components.profile.pointshopclient.97193dc22bdb" /></p>
            <p className="text-3xl font-mono text-[#c18400]">{fmt(data.points)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-black/5 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold"><SiteText copyKey="site.components.profile.pointshopclient.34a42935aa7f" /></h2>
        </div>

        {data.items.length === 0 ? (
          <p className="text-sm text-gray-500"><SiteText copyKey="site.components.profile.pointshopclient.666a6bbbea9f" /></p>
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
                        <p className="text-lg font-semibold"><SiteText namespace="site.components.profile.pointshopclient" value={item.name} /></p>
                        {item.description ? (
                          <p className="mt-1 h-12 overflow-hidden text-sm leading-6 text-gray-600"><SiteText namespace="site.components.profile.pointshopclient" value={item.description} /></p>
                        ) : (
                          <p className="h-12" />
                        )}
                      </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500"><SiteText copyKey="site.components.profile.pointshopclient.421a8448a386" /></p>
                      <p className="text-xl font-mono text-[#c18400]">{fmt(item.pointsCost)}</p>
                    </div>
                  </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
                      <p>
                        {item.deliveryType === 'COUPON' ? <SiteText copyKey="site.components.profile.pointshopclient.909e93a56cfc" /> : item.deliveryType === 'BALANCE' ? <SiteText copyKey="site.components.profile.pointshopclient.123a843287d7" values={{value1: String(fmt(item.balanceCreditAmount))}} /> : <SiteText copyKey="site.components.profile.pointshopclient.4ca4e7dd9be3" />}
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
                        aria-label={siteCopy("site.components.profile.pointshopclient.9174085b3b68", {value1: String(item.name)})}
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
                        aria-label={siteCopy("site.components.profile.pointshopclient.eb3fdec8421a", {value1: String(item.name)})}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdd(item.sku)}
                      disabled={loading || soldOut}
                      className="rounded-full border border-[#f8c84a] px-4 py-2 text-sm text-[#c18400] hover:bg-[#f8c84a]/12 disabled:opacity-50"
                    ><SiteText copyKey="site.components.profile.pointshopclient.3501efacfe16" /></button>
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
        aria-label={siteCopy("site.components.profile.pointshopclient.7ffa5afcf672")}
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
            aria-label={siteCopy("site.components.profile.pointshopclient.d5fc753560ae")}
            className="absolute inset-0 bg-black/35"
            onClick={() => setCartOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-[#f7f3ef] p-4 sm:p-6">
            <div className="rounded-3xl border border-black/5 bg-white p-6 space-y-4 min-h-full">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold"><SiteText copyKey="site.components.profile.pointshopclient.5c81c6bc5cc0" /></h2>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="rounded-full border border-black/10 px-4 py-2 text-xs hover:bg-black/5"
                ><SiteText copyKey="site.components.profile.pointshopclient.6c14bd7f6f9e" /></button>
              </div>

              {!cart || cart.lines.length === 0 ? (
                <p className="text-sm text-gray-500"><SiteText copyKey="site.components.profile.pointshopclient.f0081e54c025" /></p>
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
                        aria-label={siteCopy("site.components.profile.pointshopclient.9174085b3b68", {value1: String(line.name)})}
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
                        aria-label={siteCopy("site.components.profile.pointshopclient.eb3fdec8421a", {value1: String(line.name)})}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(line.sku, line.quantity)}
                      disabled={loading}
                      className="rounded-full border border-black/10 px-3 py-1 text-xs hover:bg-black/5 disabled:opacity-50"
                    ><SiteText copyKey="site.components.profile.pointshopclient.3755f56f2f83" /></button>
                  </div>
                </div>
              ))}

                  <div className="rounded-2xl border border-dashed border-black/10 p-4 space-y-3">
                    <p className="text-sm text-gray-600"><SiteText copyKey="site.components.profile.pointshopclient.2de37a0fe64a" />{cart.totalQuantity}</p>
                    <p className="text-sm text-gray-600"><SiteText copyKey="site.components.profile.pointshopclient.6f893ef0ded8" />{fmt(cart.totalPoints)}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleClear}
                        disabled={loading}
                        className="rounded-full border border-black/10 px-4 py-2.5 text-sm hover:bg-black/5 disabled:opacity-50"
                      ><SiteText copyKey="site.components.profile.pointshopclient.9a76e2fe1418" /></button>
                      <button
                        type="button"
                        onClick={handleCheckout}
                        disabled={loading}
                        className="rounded-full border border-[#f8c84a] px-4 py-2.5 text-sm font-semibold text-[#c18400] hover:bg-[#f8c84a]/12 disabled:opacity-50"
                      ><SiteText copyKey="site.components.profile.pointshopclient.f1ddb585e4c8" /></button>
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
              {notice.level === 'success' ? <SiteText copyKey="site.components.profile.pointshopclient.3c5be5f2a106" /> : notice.level === 'error' ? <SiteText copyKey="site.components.profile.pointshopclient.09e424b5e896" /> : <SiteText copyKey="site.components.profile.pointshopclient.93564a7ced83" />}
            </h3>
            <p className="mt-3 text-sm leading-6 text-gray-700">{notice.text}</p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="rounded-full border border-[#f8c84a] px-5 py-2 text-sm font-semibold text-[#c18400] hover:bg-[#f8c84a]/12"
              ><SiteText copyKey="site.components.profile.pointshopclient.b56d9ac6c5a0" /></button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
