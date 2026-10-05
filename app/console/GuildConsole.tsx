"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";

type Tab =
  "home" | "companions" | "dispatches" | "orders" | "messages" | "wallet";
type Availability = "AVAILABLE" | "BUSY" | "RESTING";

type ApiError = Error & { status?: number };

type Viewer = {
  displayName: string | null;
  avatarUrl: string | null;
  memberLinked: boolean;
  memberStatus: "LAOBAN" | "PEIWAN" | null;
  totalBalance: string;
  income: string;
  recharge: string;
  totalSpent: string;
  loyaltyPoints: string;
  vipLevelLabel: string;
};

type MePayload = {
  user: Viewer;
  member: {
    linked: boolean;
    status?: "LAOBAN" | "PEIWAN";
    serverDisplayName?: string | null;
  };
  availability: {
    selected: Availability;
    selectedLabel: string;
    effective: Availability;
    effectiveLabel: string;
    forcedBusy: boolean;
  };
  pendingTask: { title: string; body: string; target: string } | null;
};

type Peiwan = {
  id: number;
  serverDisplayName: string | null;
  price: number | string | null;
  availability: Availability;
  level: string;
  sex: string;
  type: string;
  cardUrl: string | null;
  gameLabels: string[];
  gameCodes: string[];
  recentlyActive?: boolean;
};

type Quote = { code: string; label: string; price: number; display: string };
type Candidate = {
  id: string;
  peiwanId: number;
  name: string;
  sex: string;
  level: string;
  image: string;
  status: string;
  price: string;
  games: string[];
  tags: string[];
  reviews: string[];
  intro?: string;
  quoteCodeOptions: Quote[];
  selected: boolean;
  selectedOrderId?: string;
};
type Dispatch = {
  id: string;
  bossName: string;
  ownerId: string;
  anonymous: boolean;
  requirement: string;
  sexRequirement: string[];
  sexText: string;
  game: string;
  tags: string[];
  tagText: string;
  createdAt: number;
  expiresAt: number;
  status: string;
  candidateCount: number;
  candidates: Candidate[];
};
type Order = {
  id: string;
  displayNo: number;
  role: string;
  counterpartName: string;
  status: string;
  statusLabel: string;
  quotationCode: string;
  unitPrice: string;
  createdAt: string;
  acceptedAt: string | null;
  endedAt: string | null;
  totalMinutes: number | null;
  grossAmount: string | null;
  actions: Array<"accept" | "decline" | "cancel" | "end">;
};
type Transaction = {
  id: string;
  type: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  createdAt: string;
};
type OwnPeiwanCard =
  | { exists: false; reason: string }
  | {
      exists: true;
      approved: boolean;
      id: number;
      name: string | null;
      status: string;
      sex: string;
      type: string;
      level: string;
      voicePreviewUrl: string | null;
      gameProfiles: Array<{
        gameCode: string;
        tier: string | null;
        label: string;
      }>;
    };
type Conversation = {
  id: string;
  peerName: string;
  peerRole: string;
  linkedOrder: string;
  unread: number;
  updatedAt: number;
  lastMessage: string;
  messages?: Array<{
    id: string;
    from: "me" | "peer" | "system";
    text: string;
    status: string;
    createdAt: number;
  }>;
};

const tabs: Array<{ id: Tab; label: string; short: string }> = [
  { id: "home", label: "工作台", short: "首页" },
  { id: "companions", label: "找陪玩", short: "陪玩" },
  { id: "dispatches", label: "派单 / 接单", short: "派单" },
  { id: "orders", label: "订单", short: "订单" },
  { id: "messages", label: "消息", short: "消息" },
  { id: "wallet", label: "账户", short: "账户" },
];

const dispatchGames = [
  "LOL",
  "VAL",
  "CSGO",
  "NARAKA",
  "APEX",
  "OW",
  "DELTA",
  "DOTA",
  "COD",
  "CHAT",
];
const dispatchTags = ["技术", "聊天", "唱歌"];

const money = (value: string | number | null | undefined) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? amount.toLocaleString("zh-CN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";
};

const dateTime = (value: string | number | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const relativeTime = (value: number) => {
  const minutes = Math.max(0, Math.round((Date.now() - value) / 60_000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
};

async function api<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    message?: string;
  };
  if (!response.ok) {
    const error = new Error(
      payload.message ?? payload.error ?? "请求失败，请稍后重试。",
    ) as ApiError;
    error.status = response.status;
    throw error;
  }
  return payload;
}

function StateBadge({ state }: { state: string }) {
  const normalized = state.toUpperCase();
  const className =
    normalized === "RUNNING" || normalized === "AVAILABLE"
      ? "bg-emerald-100 text-emerald-800"
      : normalized === "PENDING" || normalized === "BUSY"
        ? "bg-amber-100 text-amber-800"
        : normalized === "ENDED" || normalized === "RESTING"
          ? "bg-slate-200 text-slate-700"
          : "bg-rose-100 text-rose-800";
  const label =
    (
      {
        AVAILABLE: "可接",
        BUSY: "忙碌",
        RESTING: "休息",
        PENDING: "待确认",
        RUNNING: "进行中",
        ENDED: "已结束",
        DECLINED: "已拒绝",
        CANCELED: "已取消",
        EXPIRED: "已过期",
      } as Record<string, string>
    )[normalized] ?? state;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${className}`}>
      {label}
    </span>
  );
}

export function GuildConsole() {
  const [tab, setTab] = useState<Tab>(() => {
    const requested =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("tab");
    return tabs.some((item) => item.id === requested)
      ? (requested as Tab)
      : "home";
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [me, setMe] = useState<MePayload | null>(null);
  const [companions, setCompanions] = useState<Peiwan[]>([]);
  const [myDispatches, setMyDispatches] = useState<Dispatch[]>([]);
  const [dispatchHistory, setDispatchHistory] = useState<Dispatch[]>([]);
  const [openDispatches, setOpenDispatches] = useState<Dispatch[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ownPeiwanCard, setOwnPeiwanCard] = useState<OwnPeiwanCard | null>(
    null,
  );
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [search, setSearch] = useState("");
  const [game, setGame] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dispatchFormOpen, setDispatchFormOpen] = useState(false);
  const [dispatchRequirement, setDispatchRequirement] = useState("");
  const [dispatchGame, setDispatchGame] = useState("");
  const [selectedDispatchTags, setSelectedDispatchTags] = useState<string[]>(
    [],
  );
  const [needMale, setNeedMale] = useState(false);
  const [needFemale, setNeedFemale] = useState(true);
  const [anonymous, setAnonymous] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [
        meResponse,
        companionResponse,
        mineResponse,
        historyResponse,
        openResponse,
        orderResponse,
        transactionResponse,
        conversationResponse,
        peiwanCardResponse,
      ] = await Promise.all([
        api<{ ok: true } & MePayload>("/api/app/me"),
        api<{ data: Peiwan[] }>(
          "/api/peiwan?page=1&pageSize=24&seed=web-console",
        ),
        api<{ dispatches: Dispatch[] }>("/api/dispatch-requests?scope=mine"),
        api<{ dispatches: Dispatch[] }>("/api/dispatch-requests?scope=history"),
        api<{ dispatches: Dispatch[] }>("/api/dispatch-requests"),
        api<{ orders: Order[] }>("/api/app/orders"),
        api<{ transactions: Transaction[] }>("/api/app/transactions"),
        api<{ conversations: Conversation[] }>("/api/messages/conversations"),
        api<{ card: OwnPeiwanCard }>("/api/app/peiwan-card"),
      ]);
      setMe(meResponse);
      setCompanions(companionResponse.data ?? []);
      setMyDispatches(mineResponse.dispatches ?? []);
      setDispatchHistory(historyResponse.dispatches ?? []);
      setOpenDispatches(openResponse.dispatches ?? []);
      setOrders(orderResponse.orders ?? []);
      setTransactions(transactionResponse.transactions ?? []);
      setConversations(conversationResponse.conversations ?? []);
      setOwnPeiwanCard(peiwanCardResponse.card);
    } catch (loadError) {
      const detail = loadError as ApiError;
      setError(
        detail.status === 401 ? "登录状态已失效，请重新登录。" : detail.message,
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setShowNotifications(
      new URLSearchParams(window.location.search).get("notifications") === "1",
    );
  }, []);

  useEffect(() => {
    const refreshId = window.setInterval(() => {
      if (!document.hidden) void load(true);
    }, 45_000);
    return () => window.clearInterval(refreshId);
  }, [load]);

  const filteredCompanions = useMemo(
    () =>
      companions.filter((item) => {
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          `${item.serverDisplayName ?? ""} ${item.id} ${item.gameLabels.join(" ")}`
            .toLowerCase()
            .includes(query);
        const matchesGame = !game || item.gameCodes.includes(game);
        return matchesSearch && matchesGame;
      }),
    [companions, game, search],
  );

  const unreadMessages = conversations.reduce(
    (count, item) => count + item.unread,
    0,
  );
  const isPeiwan = me?.user.memberStatus === "PEIWAN";

  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(
      () => setNotice((current) => (current === message ? null : current)),
      4200,
    );
  };

  const withAction = async (action: () => Promise<void>) => {
    setSending(true);
    setError(null);
    try {
      await action();
      await load(true);
    } catch (actionError) {
      setError((actionError as Error).message);
    } finally {
      setSending(false);
    }
  };

  const createDispatch = () =>
    withAction(async () => {
      const sexRequirement = [
        needFemale ? "女生" : "",
        needMale ? "男生" : "",
      ].filter(Boolean);
      if (!dispatchRequirement.trim()) throw new Error("请先填写派单需求。");
      if (!sexRequirement.length)
        throw new Error("请至少选择一项陪玩性别要求。");
      await api("/api/dispatch-requests", {
        method: "POST",
        body: JSON.stringify({
          requirement: dispatchRequirement.trim(),
          sexRequirement,
          game: dispatchGame,
          tags: selectedDispatchTags,
          anonymous,
        }),
      });
      setDispatchRequirement("");
      setDispatchGame("");
      setSelectedDispatchTags([]);
      setDispatchFormOpen(false);
      setTab("dispatches");
      toast("派单已发布，符合条件的陪玩会在 Discord 和接单大厅看到它。");
    });

  const grabDispatch = (dispatchId: string) =>
    withAction(async () => {
      await api(
        `/api/dispatch-requests/${encodeURIComponent(dispatchId)}/candidates`,
        { method: "POST", body: "{}" },
      );
      toast("已进入候选列表，等待老板选择。");
    });

  const selectCandidate = (
    dispatchId: string,
    candidate: Candidate,
    quote: Quote,
  ) =>
    withAction(async () => {
      await api(
        `/api/dispatch-requests/${encodeURIComponent(dispatchId)}/select-worker`,
        {
          method: "POST",
          body: JSON.stringify({
            candidateId: candidate.id,
            quotationCode: quote.code,
          }),
        },
      );
      toast(`已选择 ${candidate.name}，订单已创建，等待对方确认。`);
    });

  const actOnOrder = (
    order: Order,
    action: "accept" | "decline" | "cancel" | "end",
  ) =>
    withAction(async () => {
      await api(`/api/app/orders/${encodeURIComponent(order.id)}/action`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      const actionLabel = (
        {
          accept: "接受",
          decline: "拒绝",
          cancel: "取消",
          end: "结束并结算",
        } as const
      )[action];
      toast(`订单 #${order.displayNo} 已${actionLabel}。`);
    });

  const setAvailability = (availability: Availability) =>
    withAction(async () => {
      await api("/api/app/status", {
        method: "POST",
        body: JSON.stringify({ status: availability }),
      });
      toast("接单状态已更新。");
    });

  const startChat = (peiwanId: number) =>
    withAction(async () => {
      const response = await api<{ conversation: Conversation }>(
        "/api/messages/conversations",
        {
          method: "POST",
          body: JSON.stringify({ peiwanId }),
        },
      );
      setSelectedConversation(response.conversation);
      setTab("messages");
    });

  const startSupport = () =>
    withAction(async () => {
      const response = await api<{ conversation: Conversation }>(
        "/api/messages/support",
        { method: "POST", body: "{}" },
      );
      setSelectedConversation(response.conversation);
      setTab("messages");
      toast("已接入公会客服，请留下你的问题。");
    });

  const openDispatch = (companion?: Peiwan) => {
    if (companion) {
      const isMale = companion.sex === "男生" || companion.sex === "小哥哥";
      setNeedMale(isMale);
      setNeedFemale(!isMale);
      setDispatchGame(companion.gameCodes[0] ?? "");
      setSelectedDispatchTags(
        companion.gameLabels.filter((label) => dispatchTags.includes(label)),
      );
      setDispatchRequirement(
        `想找和${companion.serverDisplayName ?? `陪玩 #${companion.id}`}类型相近的陪玩，请先沟通具体时间和安排。`,
      );
    }
    setDispatchFormOpen(true);
  };

  const repeatDispatch = (dispatch: Dispatch) => {
    setNeedMale(dispatch.sexRequirement.includes("男生"));
    setNeedFemale(dispatch.sexRequirement.includes("女生"));
    setDispatchGame(dispatch.game);
    setSelectedDispatchTags(
      dispatch.tags.filter((tag) => dispatchTags.includes(tag)),
    );
    setDispatchRequirement(dispatch.requirement);
    setAnonymous(dispatch.anonymous);
    setDispatchFormOpen(true);
  };

  const openExternalPage = (path: string) => {
    window.location.assign(path);
  };

  const openConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    try {
      const response = await api<{ conversation: Conversation }>(
        `/api/messages/conversations/${encodeURIComponent(conversation.id)}`,
      );
      setSelectedConversation(response.conversation);
      setConversations((items) =>
        items.map((item) =>
          item.id === response.conversation.id
            ? { ...item, ...response.conversation, unread: 0 }
            : item,
        ),
      );
    } catch (conversationError) {
      setError((conversationError as Error).message);
    }
  };

  const sendMessage = () =>
    withAction(async () => {
      if (!selectedConversation || !messageDraft.trim()) return;
      const response = await api<{
        message: {
          id: string;
          from: "me" | "peer" | "system";
          text: string;
          status: string;
          createdAt: number;
        };
        blocked: boolean;
      }>("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          text: messageDraft.trim(),
        }),
      });
      setSelectedConversation((current) =>
        current
          ? {
              ...current,
              lastMessage: response.message.text,
              messages: [...(current.messages ?? []), response.message],
            }
          : current,
      );
      setMessageDraft("");
      if (response.blocked) toast("该消息未发送，已转交管理员审核。");
    });

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f2ede6] text-[#171717] grid place-items-center">
        <p className="rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm shadow-sm">
          正在连接公会工作台…
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f2ede6] text-[#171717]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#171717]/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => setTab("home")}
            className="shrink-0 text-left"
          >
            <span className="block text-[10px] font-bold uppercase tracking-[0.24em] text-[#d8bd80]">
              Dianleme guild
            </span>
            <span className="block text-lg font-black tracking-tight">
              点了么娱乐公会
            </span>
          </button>
          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${tab === item.id ? "bg-white text-[#171717]" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
              >
                {item.label}
                {item.id === "messages" && unreadMessages ? (
                  <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] text-white">
                    {unreadMessages}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-36 truncate text-sm font-bold">
                {me?.user.displayName ?? "公会成员"}
              </p>
              <p className="text-xs text-white/55">
                余额 {money(me?.user.totalBalance)} 币
              </p>
            </div>
            <NotificationCenter autoOpen={showNotifications} />
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void load(true)}
              className="rounded-xl border border-white/20 px-3 py-2 text-xs font-bold text-white hover:bg-white/10 disabled:opacity-50"
            >
              {refreshing ? "刷新中" : "刷新"}
            </button>
          </div>
        </div>
        <nav className="flex overflow-x-auto border-t border-white/10 px-2 lg:hidden">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`relative shrink-0 px-3 py-2.5 text-xs font-bold ${tab === item.id ? "text-[#f0cf8e]" : "text-white/55"}`}
            >
              {item.short}
              {item.id === "messages" && unreadMessages ? (
                <span className="ml-1 text-rose-300">•</span>
              ) : null}
            </button>
          ))}
        </nav>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:py-8">
        {notice ? (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <span>{error}</span>
            <button
              type="button"
              className="font-bold"
              onClick={() => setError(null)}
            >
              关闭
            </button>
          </div>
        ) : null}

        {tab === "home" ? (
          <HomeTab
            me={me}
            orders={orders}
            dispatches={myDispatches}
            isPeiwan={isPeiwan}
            onNavigate={setTab}
            onOpenDispatch={openDispatch}
            onSetAvailability={setAvailability}
            sending={sending}
          />
        ) : null}
        {tab === "companions" ? (
          <CompanionTab
            companions={filteredCompanions}
            search={search}
            game={game}
            onSearch={setSearch}
            onGame={setGame}
            onChat={startChat}
            onDispatch={openDispatch}
            sending={sending}
          />
        ) : null}
        {tab === "dispatches" ? (
          <DispatchTab
            isPeiwan={isPeiwan}
            myDispatches={myDispatches}
            dispatchHistory={dispatchHistory}
            openDispatches={openDispatches}
            onCreate={openDispatch}
            onRepeat={repeatDispatch}
            onGrab={grabDispatch}
            onSelect={selectCandidate}
            sending={sending}
          />
        ) : null}
        {tab === "orders" ? (
          <OrdersTab orders={orders} onAction={actOnOrder} sending={sending} />
        ) : null}
        {tab === "messages" ? (
          <MessagesTab
            conversations={conversations}
            selected={selectedConversation}
            draft={messageDraft}
            onDraft={setMessageDraft}
            onOpen={openConversation}
            onSend={sendMessage}
            onSupport={startSupport}
            sending={sending}
          />
        ) : null}
        {tab === "wallet" ? (
          <WalletTab
            me={me}
            transactions={transactions}
            ownPeiwanCard={ownPeiwanCard}
            onSupport={startSupport}
            onRecharge={() => openExternalPage("/recharge")}
            onWithdraw={() => openExternalPage("/profile/withdraw")}
            onPointShop={() => openExternalPage("/profile/point-shop")}
            onProfile={() => openExternalPage("/profile")}
            onBindWechat={() => openExternalPage("/accounts/wechat/bind")}
          />
        ) : null}
      </section>

      {dispatchFormOpen ? (
        <DispatchModal
          requirement={dispatchRequirement}
          game={dispatchGame}
          tags={selectedDispatchTags}
          needMale={needMale}
          needFemale={needFemale}
          anonymous={anonymous}
          onRequirement={setDispatchRequirement}
          onGame={setDispatchGame}
          onTags={setSelectedDispatchTags}
          onMale={setNeedMale}
          onFemale={setNeedFemale}
          onAnonymous={setAnonymous}
          onClose={() => setDispatchFormOpen(false)}
          onSubmit={createDispatch}
          sending={sending}
        />
      ) : null}
    </main>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-3xl border border-black/[.07] bg-white p-4 shadow-[0_14px_40px_rgba(45,35,20,.07)] sm:p-5 ${className}`}
    >
      {children}
    </section>
  );
}

function HomeTab({
  me,
  orders,
  dispatches,
  isPeiwan,
  onNavigate,
  onOpenDispatch,
  onSetAvailability,
  sending,
}: {
  me: MePayload | null;
  orders: Order[];
  dispatches: Dispatch[];
  isPeiwan: boolean;
  onNavigate: (tab: Tab) => void;
  onOpenDispatch: () => void;
  onSetAvailability: (status: Availability) => void;
  sending: boolean;
}) {
  const activeOrders = orders.filter(
    (order) => order.status === "PENDING" || order.status === "RUNNING",
  );
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl bg-[#171717] p-5 text-white shadow-xl sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#d8bd80]">
          Guild console
        </p>
        <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-black sm:text-4xl">
              你好，{me?.user.displayName ?? "公会成员"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
              找陪玩、发布需求、处理订单和查询账户都使用公会的正式订单与余额系统。
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenDispatch}
            className="rounded-2xl bg-[#d8bd80] px-5 py-3 text-sm font-black text-[#241d11] transition hover:bg-[#edd49d]"
          >
            发布派单
          </button>
        </div>
        {me?.pendingTask ? (
          <button
            type="button"
            onClick={() =>
              onNavigate(
                me.pendingTask?.target.includes("orders")
                  ? "orders"
                  : "dispatches",
              )
            }
            className="mt-5 w-full rounded-2xl border border-[#d8bd80]/40 bg-white/10 p-4 text-left hover:bg-white/[.14]"
          >
            <p className="font-bold text-[#f0d798]">{me.pendingTask.title}</p>
            <p className="mt-1 text-sm text-white/70">{me.pendingTask.body}</p>
          </button>
        ) : null}
      </section>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="可用余额"
          value={`${money(me?.user.totalBalance)} 币`}
          detail="人工充值或 Stripe 充值后同步"
        />
        <Metric
          label="进行中订单"
          value={`${activeOrders.length}`}
          detail={activeOrders.length ? "进入订单页处理" : "当前没有待处理订单"}
        />
        <Metric
          label="我的派单"
          value={`${dispatches.length}`}
          detail={dispatches.length ? "查看候选陪玩" : "发布第一条需求"}
        />
        <Metric
          label={isPeiwan ? "接单状态" : "累计消费"}
          value={
            isPeiwan
              ? (me?.availability.effectiveLabel ?? "休息")
              : `${money(me?.user.totalSpent)} 币`
          }
          detail={
            isPeiwan
              ? "状态会影响接单资格"
              : (me?.user.vipLevelLabel ?? "普通会员")
          }
        />
      </div>
      {isPeiwan ? (
        <Panel>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-black">陪玩接单状态</h2>
              <p className="mt-1 text-sm text-slate-500">
                进行中订单会强制显示为忙碌，避免重复接单。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["AVAILABLE", "BUSY", "RESTING"] as Availability[]).map(
                (status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={sending}
                    onClick={() => onSetAvailability(status)}
                    className={`rounded-xl px-4 py-2 text-sm font-bold ${me?.availability.selected === status ? "bg-[#171717] text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"}`}
                  >
                    <StateBadge state={status} />
                  </button>
                ),
              )}
            </div>
          </div>
        </Panel>
      ) : null}
      <Panel>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black">快速入口</h2>
            <p className="mt-1 text-sm text-slate-500">
              所有行为都回写到 Discord Bot 与统一钱包。
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Quick
            label="找陪玩"
            text="按游戏、状态和名片筛选"
            onClick={() => onNavigate("companions")}
          />
          <Quick
            label="处理订单"
            text="接受、拒绝或结束当前订单"
            onClick={() => onNavigate("orders")}
          />
          <Quick
            label="账户流水"
            text="查看余额变化和结算记录"
            onClick={() => onNavigate("wallet")}
          />
        </div>
      </Panel>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Panel>
      <p className="text-xs font-bold uppercase tracking-[.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-[#171717]">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </Panel>
  );
}
function Quick({
  label,
  text,
  onClick,
}: {
  label: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl bg-stone-100 p-4 text-left transition hover:bg-[#e8ddc8]"
    >
      <p className="font-black">{label} →</p>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
    </button>
  );
}

function CompanionTab({
  companions,
  search,
  game,
  onSearch,
  onGame,
  onChat,
  onDispatch,
  sending,
}: {
  companions: Peiwan[];
  search: string;
  game: string;
  onSearch: (value: string) => void;
  onGame: (value: string) => void;
  onChat: (peiwanId: number) => void;
  onDispatch: (companion?: Peiwan) => void;
  sending: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8a6725]">
            Companion directory
          </p>
          <h1 className="mt-1 text-3xl font-black">找陪玩</h1>
          <p className="mt-1 text-sm text-slate-600">
            查看公会已审核陪玩；下单后仍以派单与候选流程创建正式订单。
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDispatch()}
          className="rounded-2xl bg-[#171717] px-5 py-3 text-sm font-black text-white"
        >
          去派单
        </button>
      </div>
      <Panel>
        <div className="flex flex-col gap-3 lg:flex-row">
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="搜索昵称、陪玩 ID 或游戏"
            className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-[#8a6725] focus:ring-2 focus:ring-[#e8ddc8]"
          />
          <select
            value={game}
            onChange={(event) => onGame(event.target.value)}
            className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm"
          >
            <option value="">全部游戏</option>
            {dispatchGames.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {companions.map((item) => (
          <article
            key={item.id}
            className="overflow-hidden rounded-3xl border border-black/[.07] bg-white shadow-[0_14px_40px_rgba(45,35,20,.07)]"
          >
            <div className="flex h-28 items-end justify-between bg-gradient-to-br from-[#f3e7d1] via-[#ebe1d1] to-[#d9be91] p-4">
              {item.cardUrl ? (
                <img
                  src={item.cardUrl}
                  alt=""
                  className="h-20 w-20 rounded-2xl border-2 border-white object-cover shadow-lg"
                />
              ) : (
                <div className="grid h-20 w-20 place-items-center rounded-2xl border-2 border-white bg-[#171717] text-xl font-black text-[#e7c884]">
                  {(item.serverDisplayName ?? "陪").slice(0, 1)}
                </div>
              )}
              <StateBadge state={item.availability} />
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-black">
                    {item.serverDisplayName ?? `陪玩 #${item.id}`}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    #{item.id} · {item.sex} · {item.level}
                  </p>
                </div>
                <span className="whitespace-nowrap text-sm font-black text-[#8a6725]">
                  {money(item.price)} / H
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.gameLabels.slice(0, 4).map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-600"
                  >
                    {label}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => onChat(item.id)}
                  className="flex-1 rounded-xl bg-stone-100 px-3 py-2 text-sm font-bold hover:bg-stone-200 disabled:opacity-50"
                >
                  咨询
                </button>
                <button
                  type="button"
                  onClick={() => onDispatch(item)}
                  className="flex-1 rounded-xl bg-[#171717] px-3 py-2 text-sm font-bold text-white hover:bg-black"
                >
                  派单
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!companions.length ? (
        <Panel>
          <p className="text-sm text-slate-600">
            没有符合筛选的陪玩，试试清除条件或直接发布派单。
          </p>
        </Panel>
      ) : null}
    </div>
  );
}

function DispatchTab({
  isPeiwan,
  myDispatches,
  dispatchHistory,
  openDispatches,
  onCreate,
  onRepeat,
  onGrab,
  onSelect,
  sending,
}: {
  isPeiwan: boolean;
  myDispatches: Dispatch[];
  dispatchHistory: Dispatch[];
  openDispatches: Dispatch[];
  onCreate: () => void;
  onRepeat: (dispatch: Dispatch) => void;
  onGrab: (id: string) => void;
  onSelect: (dispatchId: string, candidate: Candidate, quote: Quote) => void;
  sending: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8a6725]">
            Order dispatch
          </p>
          <h1 className="mt-1 text-3xl font-black">派单 / 接单</h1>
          <p className="mt-1 text-sm text-slate-600">
            老板发布需求并从候选中下单；陪玩可在接单大厅快速响应。
          </p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-2xl bg-[#171717] px-5 py-3 text-sm font-black text-white"
        >
          发布派单
        </button>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <div className="space-y-4">
          <h2 className="px-1 text-lg font-black">我的派单与候选</h2>
          {myDispatches.map((dispatch) => (
            <Panel key={dispatch.id}>
              <DispatchHeader dispatch={dispatch} />
              <div className="mt-4 space-y-3">
                {dispatch.candidates.length ? (
                  dispatch.candidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="rounded-2xl border border-stone-200 p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-black">{candidate.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {candidate.intro ?? candidate.tags.join(" · ")}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-[#8a6725]">
                          {candidate.price}
                        </span>
                      </div>
                      {candidate.selected ? (
                        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                          已创建订单{" "}
                          {candidate.selectedOrderId ? "，等待陪玩确认" : ""}
                        </p>
                      ) : (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {candidate.quoteCodeOptions.map((quote) => (
                            <button
                              type="button"
                              disabled={sending}
                              onClick={() =>
                                onSelect(dispatch.id, candidate, quote)
                              }
                              key={quote.code}
                              className="rounded-lg bg-[#171717] px-3 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-50"
                            >
                              选择 {quote.display}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-stone-50 px-3 py-4 text-sm text-slate-500">
                    暂时没有陪玩抢单，订单会同步广播至 Discord 接单频道。
                  </p>
                )}
              </div>
            </Panel>
          ))}
          {!myDispatches.length ? (
            <Panel>
              <p className="text-sm text-slate-600">你尚未发布有效派单。</p>
            </Panel>
          ) : null}
        </div>
        <div className="space-y-4">
          <h2 className="px-1 text-lg font-black">接单大厅</h2>
          {openDispatches.map((dispatch) => (
            <Panel key={dispatch.id}>
              <DispatchHeader dispatch={dispatch} />
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>
                  {dispatch.anonymous ? "匿名老板" : dispatch.bossName}
                </span>
                <span>{dispatch.candidateCount} 人已抢</span>
              </div>
              {isPeiwan && dispatch.ownerId !== "me" ? (
                <button
                  type="button"
                  disabled={sending || dispatch.status !== "OPEN"}
                  onClick={() => onGrab(dispatch.id)}
                  className="mt-4 w-full rounded-xl bg-[#d8bd80] px-4 py-2.5 text-sm font-black text-[#2d220f] hover:bg-[#eddaac] disabled:opacity-50"
                >
                  抢单
                </button>
              ) : null}
            </Panel>
          ))}
          {!openDispatches.length ? (
            <Panel>
              <p className="text-sm text-slate-600">当前没有开放派单。</p>
            </Panel>
          ) : null}
        </div>
      </div>
      {dispatchHistory.some((dispatch) => dispatch.status !== "OPEN") ? (
        <Panel>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-black">历史派单</h2>
              <p className="mt-1 text-sm text-slate-500">
                可把已结束、已取消或已过期的需求带回表单后再次发布。
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {dispatchHistory
              .filter((dispatch) => dispatch.status !== "OPEN")
              .slice(0, 6)
              .map((dispatch) => (
                <div
                  key={dispatch.id}
                  className="rounded-2xl border border-stone-200 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">
                        {dispatch.game || "未指定游戏"} · {dispatch.sexText}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                        {dispatch.requirement}
                      </p>
                    </div>
                    <StateBadge state={dispatch.status} />
                  </div>
                  <button
                    type="button"
                    onClick={() => onRepeat(dispatch)}
                    className="mt-3 rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-800 hover:bg-stone-200"
                  >
                    带入表单重新派单
                  </button>
                </div>
              ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function DispatchHeader({ dispatch }: { dispatch: Dispatch }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black">
            {dispatch.game || "未指定游戏"} · {dispatch.sexText}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {dispatch.requirement}
          </p>
        </div>
        <StateBadge state={dispatch.status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {dispatch.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-600"
          >
            {tag}
          </span>
        ))}
        <span className="rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-500">
          {relativeTime(dispatch.createdAt)}
        </span>
      </div>
    </>
  );
}

function OrdersTab({
  orders,
  onAction,
  sending,
}: {
  orders: Order[];
  onAction: (
    order: Order,
    action: "accept" | "decline" | "cancel" | "end",
  ) => void;
  sending: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8a6725]">
          Order center
        </p>
        <h1 className="mt-1 text-3xl font-black">订单</h1>
        <p className="mt-1 text-sm text-slate-600">
          操作直接调用 Bot
          的正式订单流：接受、拒绝、取消与结束都会同步账户、Discord 和通知。
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {orders.map((order) => (
          <Panel key={order.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-500">
                  订单 #{order.displayNo} · {order.role}
                </p>
                <h2 className="mt-1 text-lg font-black">
                  {order.counterpartName}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {order.quotationCode} · {money(order.unitPrice)} 币 / 小时
                </p>
              </div>
              <StateBadge state={order.status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-stone-50 p-3 text-xs">
              <div>
                <p className="text-slate-500">创建时间</p>
                <p className="mt-1 font-bold">{dateTime(order.createdAt)}</p>
              </div>
              <div>
                <p className="text-slate-500">订单金额</p>
                <p className="mt-1 font-bold">
                  {order.grossAmount
                    ? `${money(order.grossAmount)} 币`
                    : "结算后生成"}
                </p>
              </div>
            </div>
            {order.actions.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {order.actions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    disabled={sending}
                    onClick={() => onAction(order, action)}
                    className={`rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50 ${action === "accept" ? "bg-emerald-600 text-white" : action === "end" ? "bg-[#171717] text-white" : "bg-rose-100 text-rose-800"}`}
                  >
                    {action === "accept"
                      ? "接受订单"
                      : action === "decline"
                        ? "拒绝订单"
                        : action === "cancel"
                          ? "取消订单"
                          : "结束并结算"}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-xs text-slate-500">
                此订单当前无需你的操作。
              </p>
            )}
          </Panel>
        ))}
      </div>
      {!orders.length ? (
        <Panel>
          <p className="text-sm text-slate-600">
            暂无订单。发布派单后，订单状态会在这里实时更新。
          </p>
        </Panel>
      ) : null}
    </div>
  );
}

function MessagesTab({
  conversations,
  selected,
  draft,
  onDraft,
  onOpen,
  onSend,
  onSupport,
  sending,
}: {
  conversations: Conversation[];
  selected: Conversation | null;
  draft: string;
  onDraft: (value: string) => void;
  onOpen: (item: Conversation) => void;
  onSend: () => void;
  onSupport: () => void;
  sending: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8a6725]">
            Messages
          </p>
          <h1 className="mt-1 text-3xl font-black">消息</h1>
          <p className="mt-1 text-sm text-slate-600">
            订单前会话会留存并纳入风控预警；需要帮助可直接联系公会客服。
          </p>
        </div>
        <button
          type="button"
          disabled={sending}
          onClick={onSupport}
          className="rounded-2xl bg-[#171717] px-4 py-3 text-sm font-black text-white disabled:opacity-50"
        >
          联系客服
        </button>
      </div>
      <div className="grid min-h-[530px] overflow-hidden rounded-3xl border border-black/[.07] bg-white shadow-[0_14px_40px_rgba(45,35,20,.07)] lg:grid-cols-[340px_1fr]">
        <aside className="border-b border-stone-200 lg:border-b-0 lg:border-r">
          <div className="border-b border-stone-200 px-4 py-4 font-black">
            会话列表
          </div>
          <div className="max-h-[300px] overflow-y-auto lg:max-h-[570px]">
            {conversations.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => void onOpen(item)}
                className={`w-full border-b border-stone-100 px-4 py-3 text-left hover:bg-stone-50 ${selected?.id === item.id ? "bg-[#f5ecd9]" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-bold">{item.peerName}</p>
                  {item.unread ? (
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      {item.unread}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {item.lastMessage || item.linkedOrder}
                </p>
              </button>
            ))}
            {!conversations.length ? (
              <p className="px-4 py-8 text-sm text-slate-500">
                暂无会话。从陪玩名片点击“咨询”开始聊天。
              </p>
            ) : null}
          </div>
        </aside>
        <section className="flex min-h-[360px] flex-col">
          {selected ? (
            <>
              <header className="border-b border-stone-200 px-5 py-4">
                <p className="font-black">{selected.peerName}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {selected.peerRole} · {selected.linkedOrder}
                </p>
              </header>
              <div className="flex-1 space-y-3 overflow-y-auto bg-stone-50/60 p-4">
                {selected.messages?.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.from === "me" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-6 ${message.from === "me" ? "bg-[#171717] text-white" : message.from === "system" ? "bg-amber-100 text-amber-950" : "bg-white text-slate-800 shadow-sm"}`}
                    >
                      {message.text}
                    </div>
                  </div>
                ))}
                {!selected.messages?.length ? (
                  <p className="text-center text-sm text-slate-500">
                    正在加载会话内容…
                  </p>
                ) : null}
              </div>
              <div className="border-t border-stone-200 p-3">
                <div className="flex gap-2">
                  <input
                    value={draft}
                    onChange={(event) => onDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void onSend();
                      }
                    }}
                    placeholder="输入消息…"
                    className="min-w-0 flex-1 rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-[#8a6725]"
                  />
                  <button
                    type="button"
                    disabled={sending || !draft.trim()}
                    onClick={() => void onSend()}
                    className="rounded-xl bg-[#171717] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    发送
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-5 text-center text-sm text-slate-500">
              选择一个会话以查看详情。
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function WalletTab({
  me,
  transactions,
  ownPeiwanCard,
  onSupport,
  onRecharge,
  onWithdraw,
  onPointShop,
  onProfile,
  onBindWechat,
}: {
  me: MePayload | null;
  transactions: Transaction[];
  ownPeiwanCard: OwnPeiwanCard | null;
  onSupport: () => void;
  onRecharge: () => void;
  onWithdraw: () => void;
  onPointShop: () => void;
  onProfile: () => void;
  onBindWechat: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8a6725]">
            Wallet
          </p>
          <h1 className="mt-1 text-3xl font-black">账户与流水</h1>
          <p className="mt-1 text-sm text-slate-600">
            余额、Stripe 充值、人工扫码入账与提现都使用正式 DLM 钱包。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRecharge}
            className="rounded-2xl bg-[#171717] px-4 py-3 text-sm font-black text-white"
          >
            充值
          </button>
          <button
            type="button"
            onClick={onWithdraw}
            className="rounded-2xl bg-stone-200 px-4 py-3 text-sm font-black text-stone-800"
          >
            提现
          </button>
          <button
            type="button"
            onClick={onPointShop}
            className="rounded-2xl bg-stone-200 px-4 py-3 text-sm font-black text-stone-800"
          >
            积分商城
          </button>
          <button
            type="button"
            onClick={onProfile}
            className="rounded-2xl bg-stone-200 px-4 py-3 text-sm font-black text-stone-800"
          >
            完整账户资料
          </button>
          <button
            type="button"
            onClick={onBindWechat}
            className="rounded-2xl bg-stone-200 px-4 py-3 text-sm font-black text-stone-800"
          >
            绑定微信小程序
          </button>
          <button
            type="button"
            onClick={onSupport}
            className="rounded-2xl bg-[#d8bd80] px-4 py-3 text-sm font-black text-[#2d220f]"
          >
            联系客服
          </button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="可用余额"
          value={`${money(me?.user.totalBalance)} 币`}
          detail="可用于创建订单"
        />
        <Metric
          label="陪玩收入"
          value={`${money(me?.user.income)} 币`}
          detail="可提现收入"
        />
        <Metric
          label="累计充值"
          value={`${money(me?.user.recharge)} 币`}
          detail="包含人工入账与在线充值"
        />
        <Metric
          label="累计消费"
          value={`${money(me?.user.totalSpent)} 币`}
          detail={me?.user.vipLevelLabel ?? "会员权益"}
        />
      </div>
      {me?.user.memberStatus === "PEIWAN" ? (
        <Panel>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#8a6725]">
                Companion card
              </p>
              <h2 className="mt-1 text-lg font-black">我的陪玩名片</h2>
              <p className="mt-1 text-sm text-slate-500">
                名片、报价和审核资料仍以公会数据库为准。
              </p>
            </div>
            {ownPeiwanCard?.exists ? (
              ownPeiwanCard.approved ? (
                <StateBadge
                  state={ownPeiwanCard.status === "可接" ? "AVAILABLE" : "BUSY"}
                />
              ) : (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                  审核中
                </span>
              )
            ) : null}
          </div>
          {ownPeiwanCard?.exists ? (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-stone-100 p-3">
                  <p className="text-xs text-slate-500">身份</p>
                  <p className="mt-1 font-black">
                    {ownPeiwanCard.name ?? `陪玩 #${ownPeiwanCard.id}`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    #{ownPeiwanCard.id} · {ownPeiwanCard.sex} ·{" "}
                    {ownPeiwanCard.level}
                  </p>
                </div>
                <div className="rounded-2xl bg-stone-100 p-3">
                  <p className="text-xs text-slate-500">类型</p>
                  <p className="mt-1 font-black">{ownPeiwanCard.type}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {ownPeiwanCard.approved ? "资料已审核" : "资料审核中"}
                  </p>
                </div>
                <div className="rounded-2xl bg-stone-100 p-3">
                  <p className="text-xs text-slate-500">游戏资料</p>
                  <p className="mt-1 font-black">
                    {ownPeiwanCard.gameProfiles.length} 项
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    价格和试听由公会审核流程维护
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {ownPeiwanCard.gameProfiles.length ? (
                  ownPeiwanCard.gameProfiles.map((profile) => (
                    <span
                      key={profile.gameCode}
                      className="rounded-full bg-[#f5ead5] px-3 py-1.5 text-xs font-bold text-[#73521f]"
                    >
                      {profile.label}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">
                    暂未配置游戏资料。
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="mt-4 rounded-2xl bg-stone-100 p-4 text-sm text-slate-600">
              {ownPeiwanCard?.reason === "peiwan_profile_missing"
                ? "当前 Discord 账号尚未建立陪玩名片，请联系公会审核开通。"
                : "正在同步陪玩名片；如果尚未开通，请联系公会客服。"}
            </p>
          )}
        </Panel>
      ) : null}
      <Panel>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black">余额流水</h2>
            <p className="mt-1 text-sm text-slate-500">
              最近 100 条正式流水记录。
            </p>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b border-stone-200 text-xs text-slate-500">
              <tr>
                <th className="pb-3 font-bold">时间</th>
                <th className="pb-3 font-bold">类型</th>
                <th className="pb-3 font-bold">变动</th>
                <th className="pb-3 font-bold">余额</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((item) => {
                const amount = Number(item.amount);
                return (
                  <tr
                    key={item.id}
                    className="border-b border-stone-100 last:border-0"
                  >
                    <td className="py-3 text-slate-500">
                      {dateTime(item.createdAt)}
                    </td>
                    <td className="py-3 font-bold">{item.type}</td>
                    <td
                      className={`py-3 font-black ${amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                    >
                      {amount >= 0 ? "+" : ""}
                      {money(item.amount)}
                    </td>
                    <td className="py-3 text-slate-600">
                      {money(item.balanceAfter)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!transactions.length ? (
            <p className="py-8 text-center text-sm text-slate-500">
              暂无流水。
            </p>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

function DispatchModal({
  requirement,
  game,
  tags,
  needMale,
  needFemale,
  anonymous,
  onRequirement,
  onGame,
  onTags,
  onMale,
  onFemale,
  onAnonymous,
  onClose,
  onSubmit,
  sending,
}: {
  requirement: string;
  game: string;
  tags: string[];
  needMale: boolean;
  needFemale: boolean;
  anonymous: boolean;
  onRequirement: (value: string) => void;
  onGame: (value: string) => void;
  onTags: (value: string[]) => void;
  onMale: (value: boolean) => void;
  onFemale: (value: boolean) => void;
  onAnonymous: (value: boolean) => void;
  onClose: () => void;
  onSubmit: () => void;
  sending: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
        className="w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8a6725]">
              Create dispatch
            </p>
            <h2 className="mt-1 text-2xl font-black">发布派单</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-stone-100"
          >
            关闭
          </button>
        </div>
        <label className="mt-5 block text-sm font-bold">
          需求说明
          <textarea
            value={requirement}
            onChange={(event) => onRequirement(event.target.value)}
            maxLength={500}
            rows={5}
            placeholder="例如：今晚 21:00 打 VAL，想找会沟通的女生一起排位…"
            className="mt-2 w-full resize-none rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-normal outline-none focus:border-[#8a6725]"
          />
        </label>
        <label className="mt-4 block text-sm font-bold">
          游戏
          <select
            value={game}
            onChange={(event) => onGame(event.target.value)}
            className="mt-2 block w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm font-normal"
          >
            <option value="">未指定</option>
            {dispatchGames.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-4">
          <p className="text-sm font-bold">服务标签</p>
          <p className="mt-1 text-xs text-slate-500">
            让接单大厅的陪玩更容易判断是否适合这次需求。
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {dispatchTags.map((tag) => {
              const selected = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    onTags(
                      selected
                        ? tags.filter((item) => item !== tag)
                        : [...tags, tag],
                    )
                  }
                  className={`rounded-xl border px-3 py-2 text-sm font-bold ${selected ? "border-[#8a6725] bg-[#f5ecd9] text-[#684c17]" : "border-stone-200 bg-white text-slate-600"}`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4">
          <p className="text-sm font-bold">陪玩性别要求</p>
          <div className="mt-2 flex gap-2">
            <Toggle checked={needFemale} onChange={onFemale} label="女生" />
            <Toggle checked={needMale} onChange={onMale} label="男生" />
          </div>
        </div>
        <div className="mt-4">
          <Toggle
            checked={anonymous}
            onChange={onAnonymous}
            label="匿名发布（陪玩大厅不展示老板昵称）"
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-3 text-sm font-bold text-slate-600"
          >
            取消
          </button>
          <button
            disabled={sending}
            type="submit"
            className="rounded-xl bg-[#171717] px-5 py-3 text-sm font-black text-white disabled:opacity-50"
          >
            {sending ? "发布中…" : "发布并通知陪玩"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${checked ? "border-[#8a6725] bg-[#f5ecd9] text-[#684c17]" : "border-stone-200 text-slate-600"}`}
    >
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
        className="h-4 w-4 accent-[#8a6725]"
      />
      {label}
    </label>
  );
}
