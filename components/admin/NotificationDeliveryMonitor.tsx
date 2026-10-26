"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Delivery = {
  id: string;
  notificationId: string;
  title: string;
  event: string;
  userName: string;
  userDlmId: string;
  channel: string;
  status: string;
  attempts: number;
  error: string | null;
  canRetry: boolean;
  updatedAt: string;
};

type DeliveryPage = {
  deliveries: Delivery[];
  page: number;
  totalPages: number;
  total: number;
  retryableCount: number;
};

async function api<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    attempted?: number;
    uncertain?: number;
    processingErrors?: number;
  };
  if (!response.ok) {
    if (payload.error === 'notification_retry_incomplete') {
      throw new Error(`本次重试未完成：已处理 ${payload.attempted ?? 0} 个渠道，${payload.uncertain ?? 0} 个结果待核实，${payload.processingErrors ?? 0} 项处理故障。请查看投递状态和服务日志。`);
    }
    throw new Error(payload.error ?? "通知投递状态加载失败");
  }
  return payload;
}

const channelName: Record<string, string> = {
  DISCORD: "Discord DM",
  WEB_PUSH: "网页 Push",
  EMAIL: "邮件",
};

export function NotificationDeliveryMonitor({ source = 'center' }: { source?: 'center' | 'outbox' }) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [retryableCount, setRetryableCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const loadVersion = useRef(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (preserveMessage = false, requestedPage = 1) => {
    const version = ++loadVersion.current;
    setLoading(true);
    try {
      const response = await api<DeliveryPage>(
        `/api/admin/notification-deliveries?page=${requestedPage}&pageSize=100&source=${source}`,
      );
      if (version !== loadVersion.current) return;
      setDeliveries(response.deliveries ?? []);
      setPage(response.page);
      setTotalPages(response.totalPages);
      setTotal(response.total);
      setRetryableCount(response.retryableCount);
      if (!preserveMessage) setMessage(null);
    } catch (error) {
      if (version !== loadVersion.current) return;
      setMessage(
        error instanceof Error ? error.message : "通知投递状态加载失败",
      );
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = async () => {
    setBusy(true);
    try {
      const response = await api<{ attempted: number; uncertain: number }>(
        "/api/admin/notification-deliveries",
        { method: "POST", body: JSON.stringify({ limit: 100, source }) },
      );
      await load(true, page);
      setMessage(`已尝试重发 ${response.attempted} 条通知。`);
    } catch (error) {
      // A failed batch may already have completed some channels. Refresh their
      // state and the global eligibility count before presenting the error.
      await load(true, page);
      setMessage(error instanceof Error ? error.message : "通知重试失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-busy={loading || busy} className="rounded-2xl border border-white/10 bg-white/5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
        <div>
          <h2 className="font-semibold">{source === 'outbox' ? '余额及资料私信任务' : '通知投递异常'}</h2>

        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load(false, page)}
            disabled={busy || loading}
            className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/75 hover:bg-white/10 disabled:opacity-50"
          >
            刷新
          </button>
          <button
            type="button"
            onClick={() => void retry()}
            disabled={busy || loading || retryableCount === 0}
            className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-50"
          >
            {busy ? "重试中…" : "立即重试"}
          </button>
        </div>
      </header>
      {deliveries.length ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="sticky top-0 bg-[#171717] text-white/45">
              <tr>
                <th className="px-4 py-3 font-medium">用户 / 事件</th>
                <th className="px-4 py-3 font-medium">渠道</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">原因</th>
                <th className="px-4 py-3 font-medium">更新时间</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => (
                <tr
                  key={delivery.id}
                  className="border-t border-white/10 align-top"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">
                      {delivery.userName}
                    </p>
                    <p className="mt-1 text-white/45">{delivery.title}</p>
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    {channelName[delivery.channel] ?? delivery.channel}
                  </td>
                  <td className="px-4 py-3 text-amber-100">
                    {delivery.status === "UNCERTAIN" ? "结果待核实" : delivery.status === "FAILED" ? "失败" : delivery.status === "SKIPPED" ? "已停止" : delivery.status === "REQUIRES_REVIEW" ? "归属待核实" : "待投递"} ·{" "}
                    {delivery.attempts}/3
                  </td>
                  <td className="max-w-80 px-4 py-3 text-white/55">
                    {delivery.error ?? "等待投递"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-white/45">
                    {new Date(delivery.updatedAt).toLocaleString("zh-CN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-5 text-sm text-white/55">
          {loading ? "正在加载通知投递状态…" : "最近 24 小时没有待处理的通知投递。"}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 text-xs text-white/55">
        <p>共 {total} 个异常渠道；全部页面中有 {retryableCount} 个渠道可重试。</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void load(false, page - 1)}
            disabled={busy || loading || page <= 1}
            className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/10 disabled:opacity-50"
          >
            上一页
          </button>
          <span aria-live="polite">第 {page} / {totalPages} 页</span>
          <button
            type="button"
            onClick={() => void load(false, page + 1)}
            disabled={busy || loading || page >= totalPages}
            className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/10 disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      </div>
      {message ? (
        <p className="border-t border-white/10 px-4 py-3 text-xs text-amber-100">
          {message}
        </p>
      ) : null}
    </section>
  );
}
