"use client";

import { useCallback, useEffect, useState } from "react";

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
  updatedAt: string;
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
  };
  if (!response.ok) throw new Error(payload.error ?? "通知投递状态加载失败");
  return payload;
}

const channelName: Record<string, string> = {
  DISCORD: "Discord DM",
  WEB_PUSH: "网页 Push",
  EMAIL: "邮件",
};

export function NotificationDeliveryMonitor() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (preserveMessage = false) => {
    try {
      const response = await api<{ deliveries: Delivery[] }>(
        "/api/admin/notification-deliveries",
      );
      setDeliveries(response.deliveries ?? []);
      if (!preserveMessage) setMessage(null);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "通知投递状态加载失败",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = async () => {
    setBusy(true);
    try {
      const response = await api<{ attempted: number }>(
        "/api/admin/notification-deliveries",
        { method: "POST", body: JSON.stringify({ limit: 100 }) },
      );
      await load(true);
      setMessage(`已尝试重发 ${response.attempted} 条通知。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "通知重试失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
        <div>
          <h2 className="font-semibold">通知投递异常</h2>
          <p className="mt-1 text-xs text-white/55">
            最近 24 小时未完成的 Discord、网页 Push 或邮件；最多重试 3 次。
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/75 hover:bg-white/10 disabled:opacity-50"
          >
            刷新
          </button>
          <button
            type="button"
            onClick={() => void retry()}
            disabled={busy || !deliveries.length}
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
                    {delivery.status === "FAILED" ? "失败" : "待投递"} ·{" "}
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
          最近 24 小时没有待处理的通知投递。
        </p>
      )}
      {message ? (
        <p className="border-t border-white/10 px-4 py-3 text-xs text-amber-100">
          {message}
        </p>
      ) : null}
    </section>
  );
}
