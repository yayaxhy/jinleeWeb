"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Delivery = { channel: string; status: string; error: string | null };
type NotificationItem = {
  id: string;
  event: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
  deliveries: Delivery[];
};
type Preferences = {
  email: string | null;
  emailEnabled: boolean;
  pushEnabled: boolean;
  vapidPublicKey: string | null;
};
type MiniNotificationSettings = {
  critical: boolean;
  messages: boolean;
  dispatches: boolean;
};

const toUint8Array = (value: string) => {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = window.atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
};

const relativeTime = (value: string) => {
  const timestamp = new Date(value).getTime();
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) throw new Error(data.error ?? "通知设置保存失败");
  return data;
}

export function NotificationCenter({
  autoOpen = false,
}: {
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [miniSettings, setMiniSettings] =
    useState<MiniNotificationSettings | null>(null);
  const [email, setEmail] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  const unread = useMemo(
    () => items.filter((item) => !item.readAt).length,
    [items],
  );
  const load = useCallback(async () => {
    try {
      const [notificationResponse, preferenceResponse, miniSettingsResponse] =
        await Promise.all([
          request<{ notifications: NotificationItem[] }>(
            "/api/app/notifications",
          ),
          request<Preferences>("/api/app/notification-preferences"),
          request<{ settings: MiniNotificationSettings }>(
            "/api/app/notification-settings",
          ),
        ]);
      setItems(notificationResponse.notifications ?? []);
      setPreferences(preferenceResponse);
      setEmail(preferenceResponse.email ?? "");
      setEmailEnabled(preferenceResponse.emailEnabled);
      setMiniSettings(miniSettingsResponse.settings);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "通知中心暂不可用");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (ids?: string[]) => {
    await request("/api/app/notifications", {
      method: "POST",
      body: JSON.stringify({ ids }),
    });
    setItems((current) =>
      current.map((item) =>
        !ids || ids.includes(item.id)
          ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
          : item,
      ),
    );
  };

  const openNotification = async (item: NotificationItem) => {
    try {
      if (!item.readAt) await markRead([item.id]);
    } catch {
      // Navigation should remain available when the read receipt is temporarily unavailable.
    }
    if (item.href) window.location.assign(item.href);
  };

  const saveEmail = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const updated = await request<Preferences>(
        "/api/app/notification-preferences",
        {
          method: "PUT",
          body: JSON.stringify({ email, emailEnabled }),
        },
      );
      setPreferences((current) =>
        current ? { ...current, ...updated } : updated,
      );
      setMessage(
        updated.emailEnabled ? "邮件通知已保存。" : "邮件通知已关闭。",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "邮件通知保存失败");
    } finally {
      setBusy(false);
    }
  };

  const saveMiniSettings = async (next: MiniNotificationSettings) => {
    setBusy(true);
    setMessage(null);
    try {
      const updated = await request<{ settings: MiniNotificationSettings }>(
        "/api/app/notification-settings",
        {
          method: "POST",
          body: JSON.stringify(next),
        },
      );
      setMiniSettings(updated.settings);
      setMessage("提醒偏好已保存。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提醒偏好保存失败");
    } finally {
      setBusy(false);
    }
  };

  const togglePush = async () => {
    if (!preferences?.vapidPublicKey) {
      setMessage("推送服务尚未配置，请联系客服。");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setMessage("当前浏览器不支持网页推送。");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await request("/api/app/push-subscriptions", {
          method: "DELETE",
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        await existing.unsubscribe();
        setPreferences((current) =>
          current ? { ...current, pushEnabled: false } : current,
        );
        setMessage("网页推送已关闭。");
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toUint8Array(preferences.vapidPublicKey),
      });
      await request("/api/app/push-subscriptions", {
        method: "POST",
        body: JSON.stringify(subscription),
      });
      setPreferences((current) =>
        current ? { ...current, pushEnabled: true } : current,
      );
      setMessage("网页推送已开启。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "网页推送授权失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-xl border border-white/20 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
        aria-expanded={open}
        aria-label="打开通知中心"
      >
        通知
        {unread ? (
          <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-rose-500 px-1 py-0.5 text-[10px] text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <section className="absolute right-0 z-50 mt-3 w-[min(94vw,430px)] overflow-hidden rounded-2xl border border-stone-200 bg-white text-[#171717] shadow-2xl">
          <header className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
            <div>
              <h2 className="font-black">通知中心</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                订单、余额与服务进度
              </p>
            </div>
            {unread ? (
              <button
                type="button"
                onClick={() => void markRead()}
                className="text-xs font-bold text-[#8a6725]"
              >
                全部已读
              </button>
            ) : null}
          </header>
          <div className="max-h-72 overflow-y-auto">
            {items.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => void openNotification(item)}
                className={`block w-full border-b border-stone-100 px-4 py-3 text-left hover:bg-stone-50 ${item.readAt ? "opacity-65" : "bg-[#fff9ee]"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold">{item.title}</p>
                  {!item.readAt ? (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#bc842c]" />
                  ) : null}
                </div>
                <p className="mt-1 text-sm leading-5 text-slate-600">
                  {item.body}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  {relativeTime(item.createdAt)}
                </p>
              </button>
            ))}
            {!items.length ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                暂时没有通知。
              </p>
            ) : null}
          </div>
          <div className="border-t border-stone-200 bg-stone-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">网页推送</p>
                <p className="text-xs text-slate-500">
                  即使未打开工作台也可提醒
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void togglePush()}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${preferences?.pushEnabled ? "bg-emerald-100 text-emerald-800" : "bg-[#171717] text-white"} disabled:opacity-50`}
              >
                {preferences?.pushEnabled ? "已开启 · 关闭" : "开启推送"}
              </button>
            </div>
            <div className="mt-4 flex gap-2">
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="用于通知的邮箱"
                inputMode="email"
                className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-1 whitespace-nowrap text-xs font-bold">
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(event) => setEmailEnabled(event.target.checked)}
                />{" "}
                邮件
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveEmail()}
                className="rounded-lg bg-stone-200 px-3 py-2 text-xs font-bold disabled:opacity-50"
              >
                保存
              </button>
            </div>
            <div className="mt-4 border-t border-stone-200 pt-3">
              <p className="text-sm font-bold">小程序订阅消息</p>
              <p className="mt-0.5 text-xs text-slate-500">
                此设置与小程序共用，不会关闭 Discord、网页或邮件通知。
              </p>
              <div className="mt-2 grid gap-2 text-xs font-bold text-slate-700">
                {(
                  [
                    ["critical", "订单与余额变动"],
                    ["messages", "私信消息"],
                    ["dispatches", "派单与接单"],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2"
                  >
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      disabled={busy || !miniSettings}
                      checked={miniSettings?.[key] ?? false}
                      onChange={(event) =>
                        miniSettings &&
                        void saveMiniSettings({
                          ...miniSettings,
                          [key]: event.target.checked,
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
            {message ? (
              <p className="mt-3 text-xs text-slate-600">{message}</p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
