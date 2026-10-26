"use client";
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


import { useEffect, useMemo, useState } from "react";

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
const relativeTime = (value: string, justNowLabel: string) => {
  const timestamp = new Date(value).getTime();
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return justNowLabel;
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
  const siteCopy = useSiteCopy();
  const [open, setOpen] = useState(autoOpen);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [lastAutoOpen, setLastAutoOpen] = useState(autoOpen);
  if (lastAutoOpen !== autoOpen) {
    setLastAutoOpen(autoOpen);
    if (autoOpen) setOpen(true);
  }

  const unread = useMemo(
    () => items.filter((item) => !item.readAt).length,
    [items],
  );
  useEffect(() => {
    let active = true;
    request<{ notifications: NotificationItem[] }>('/api/app/notifications').then((response) => {
      if (active) setItems(response.notifications ?? []);
    }).catch((error) => {
      if (active) setMessage(error instanceof Error ? error.message : siteCopy("site.components.notifications.notificationcenter.5c98ccf6b1fe"));
    });
    return () => { active = false; };
  }, [siteCopy]);

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

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-xl border border-white/20 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
        aria-expanded={open}
        aria-label={siteCopy("site.components.notifications.notificationcenter.0e21b089a765")}
      ><SiteText copyKey="site.components.notifications.notificationcenter.7a66c0d03631" />{unread ? (
          <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-rose-500 px-1 py-0.5 text-[10px] text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <section className="absolute right-0 z-50 mt-3 w-[min(94vw,430px)] overflow-hidden rounded-2xl border border-stone-200 bg-white text-[#171717] shadow-2xl">
          <header className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
            <div>
              <h2 className="font-black"><SiteText copyKey="site.components.notifications.notificationcenter.d3d59c09bd0b" /></h2>
              <p className="mt-0.5 text-xs text-slate-500"><SiteText copyKey="site.components.notifications.notificationcenter.64ba9b57258c" /></p>
            </div>
            {unread ? (
              <button
                type="button"
                onClick={() => void markRead().catch((error) => setMessage(error instanceof Error ? error.message : siteCopy("site.components.notifications.notificationcenter.36f6553131d0")))}
                className="text-xs font-bold text-[#8a6725]"
              ><SiteText copyKey="site.components.notifications.notificationcenter.ac210d6e7dbb" /></button>
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
                  {relativeTime(item.createdAt, siteCopy("site.components.notifications.notificationcenter.9e636642d6d4"))}
                </p>
              </button>
            ))}
            {!items.length ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500"><SiteText copyKey="site.components.notifications.notificationcenter.0be4520e22dd" /></p>
            ) : null}
          </div>
          <div className="border-t border-stone-200 bg-stone-50 p-4">
            {message ? (
              <p className="mt-3 text-xs text-slate-600"><SiteText namespace="site.components.notifications.notificationcenter" value={message} /></p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
