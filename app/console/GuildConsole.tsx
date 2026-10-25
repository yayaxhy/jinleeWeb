"use client";
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


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
      <SiteText namespace="site.app.console.guildconsole" value={label} />
    </span>
  );
}

export function GuildConsole() {
  const siteCopy = useSiteCopy();
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
        detail.status === 401 ? siteCopy("site.app.console.guildconsole.8e38717a5747") : detail.message,
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [siteCopy]);

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
      if (!dispatchRequirement.trim()) throw new Error(siteCopy("site.app.console.guildconsole.a35075d1d72f"));
      if (!sexRequirement.length)
        throw new Error(siteCopy("site.app.console.guildconsole.feec35d97553"));
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
        <p className="rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm shadow-sm"><SiteText copyKey="site.app.console.guildconsole.f0f1a64cfeb3" /></p>
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
            <span className="block text-[10px] font-bold uppercase tracking-[0.24em] text-[#d8bd80]"><SiteText copyKey="site.app.console.guildconsole.c2e430c82801" /></span>
            <span className="block text-lg font-black tracking-tight"><SiteText copyKey="site.app.console.guildconsole.7a183c580075" /></span>
          </button>
          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${tab === item.id ? "bg-white text-[#171717]" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
              >
                <SiteText namespace="site.app.console.guildconsole" value={item.label} />
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
                {me?.user.displayName ?? <SiteText copyKey="site.app.console.guildconsole.578009897502" />}
              </p>
              <p className="text-xs text-white/55"><SiteText copyKey="site.app.console.guildconsole.239d15857adb" />{money(me?.user.totalBalance)}<SiteText copyKey="site.app.console.guildconsole.e6459cd00f2c" /></p>
            </div>
            <NotificationCenter autoOpen={showNotifications} />
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void load(true)}
              className="rounded-xl border border-white/20 px-3 py-2 text-xs font-bold text-white hover:bg-white/10 disabled:opacity-50"
            >
              {refreshing ? <SiteText copyKey="site.app.console.guildconsole.d47379f917ec" /> : <SiteText copyKey="site.app.console.guildconsole.38108eaa1d32" />}
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
              <SiteText namespace="site.app.console.guildconsole" value={item.short} />
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
            <SiteText namespace="site.app.console.guildconsole" value={notice} />
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <span><SiteText namespace="site.app.console.guildconsole" value={error} /></span>
            <button
              type="button"
              className="font-bold"
              onClick={() => setError(null)}
            ><SiteText copyKey="site.app.console.guildconsole.6c14bd7f6f9e" /></button>
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
  const siteCopy = useSiteCopy();
  const activeOrders = orders.filter(
    (order) => order.status === "PENDING" || order.status === "RUNNING",
  );
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl bg-[#171717] p-5 text-white shadow-xl sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#d8bd80]"><SiteText copyKey="site.app.console.guildconsole.f46a1a9e7576" /></p>
        <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-black sm:text-4xl"><SiteText copyKey="site.app.console.guildconsole.ce0e936c16bd" />{me?.user.displayName ?? <SiteText copyKey="site.app.console.guildconsole.578009897502" />}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70"><SiteText copyKey="site.app.console.guildconsole.7531950c3521" /></p>
          </div>
          <button
            type="button"
            onClick={onOpenDispatch}
            className="rounded-2xl bg-[#d8bd80] px-5 py-3 text-sm font-black text-[#241d11] transition hover:bg-[#edd49d]"
          ><SiteText copyKey="site.app.console.guildconsole.9a94b37da8b6" /></button>
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
          label={siteCopy("site.app.console.guildconsole.ae1abe750af6")}
          value={`${money(me?.user.totalBalance)} 币`}
          detail="人工充值或 Stripe 充值后同步"
        />
        <Metric
          label={siteCopy("site.app.console.guildconsole.77c17065a4fc")}
          value={`${activeOrders.length}`}
          detail={activeOrders.length ? "进入订单页处理" : "当前没有待处理订单"}
        />
        <Metric
          label={siteCopy("site.app.console.guildconsole.66c222005555")}
          value={`${dispatches.length}`}
          detail={dispatches.length ? "查看候选陪玩" : "发布第一条需求"}
        />
        <Metric
          label={isPeiwan ? siteCopy("site.app.console.guildconsole.1084763b7b72") : siteCopy("site.app.console.guildconsole.bd94a6639088")}
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
              <h2 className="text-lg font-black"><SiteText copyKey="site.app.console.guildconsole.dd8804496a6d" /></h2>
              <p className="mt-1 text-sm text-slate-500"><SiteText copyKey="site.app.console.guildconsole.d04bff542dab" /></p>
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
            <h2 className="text-lg font-black"><SiteText copyKey="site.app.console.guildconsole.53297f595ad5" /></h2>
            <p className="mt-1 text-sm text-slate-500"><SiteText copyKey="site.app.console.guildconsole.94f6c750bf77" /></p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Quick
            label={siteCopy("site.app.console.guildconsole.2a5c8543f795")}
            text={siteCopy("site.app.console.guildconsole.5e51e6fe8f22")}
            onClick={() => onNavigate("companions")}
          />
          <Quick
            label={siteCopy("site.app.console.guildconsole.e127aad189b9")}
            text={siteCopy("site.app.console.guildconsole.03b53d95839f")}
            onClick={() => onNavigate("orders")}
          />
          <Quick
            label={siteCopy("site.app.console.guildconsole.84f1b5486dc0")}
            text={siteCopy("site.app.console.guildconsole.37b2775cbce6")}
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
        <SiteText namespace="site.app.console.guildconsole" value={label} />
      </p>
      <p className="mt-2 text-2xl font-black text-[#171717]">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500"><SiteText namespace="site.app.console.guildconsole" value={detail} /></p>
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
      <p className="font-black"><SiteText namespace="site.app.console.guildconsole" value={label} /> →</p>
      <p className="mt-1 text-sm text-slate-600"><SiteText namespace="site.app.console.guildconsole" value={text} /></p>
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
  const siteCopy = useSiteCopy();
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8a6725]"><SiteText copyKey="site.app.console.guildconsole.0bdcf2dbe62f" /></p>
          <h1 className="mt-1 text-3xl font-black"><SiteText copyKey="site.app.console.guildconsole.2a5c8543f795" /></h1>
          <p className="mt-1 text-sm text-slate-600"><SiteText copyKey="site.app.console.guildconsole.e44a0ea17d03" /></p>
        </div>
        <button
          type="button"
          onClick={() => onDispatch()}
          className="rounded-2xl bg-[#171717] px-5 py-3 text-sm font-black text-white"
        ><SiteText copyKey="site.app.console.guildconsole.827116d51b43" /></button>
      </div>
      <Panel>
        <div className="flex flex-col gap-3 lg:flex-row">
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={siteCopy("site.app.console.guildconsole.0cce497b8787")}
            className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-[#8a6725] focus:ring-2 focus:ring-[#e8ddc8]"
          />
          <select
            value={game}
            onChange={(event) => onGame(event.target.value)}
            className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm"
          >
            <option value=""><SiteText copyKey="site.app.console.guildconsole.7bb590a949c0" /></option>
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
                  alt={""}
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
                    {item.serverDisplayName ?? <SiteText copyKey="site.app.console.guildconsole.1d61b82ec64b" values={{value1: String(item.id)}} />}
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
                    <SiteText namespace="site.app.console.guildconsole" value={label} />
                  </span>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => onChat(item.id)}
                  className="flex-1 rounded-xl bg-stone-100 px-3 py-2 text-sm font-bold hover:bg-stone-200 disabled:opacity-50"
                ><SiteText copyKey="site.app.console.guildconsole.65fdaa364aae" /></button>
                <button
                  type="button"
                  onClick={() => onDispatch(item)}
                  className="flex-1 rounded-xl bg-[#171717] px-3 py-2 text-sm font-bold text-white hover:bg-black"
                ><SiteText copyKey="site.app.console.guildconsole.f4c78c75e914" /></button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!companions.length ? (
        <Panel>
          <p className="text-sm text-slate-600"><SiteText copyKey="site.app.console.guildconsole.11a785d2bca3" /></p>
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
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8a6725]"><SiteText copyKey="site.app.console.guildconsole.368d0da8f2dc" /></p>
          <h1 className="mt-1 text-3xl font-black"><SiteText copyKey="site.app.console.guildconsole.f844a48dbc62" /></h1>
          <p className="mt-1 text-sm text-slate-600"><SiteText copyKey="site.app.console.guildconsole.e520d3ed2f5e" /></p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-2xl bg-[#171717] px-5 py-3 text-sm font-black text-white"
        ><SiteText copyKey="site.app.console.guildconsole.9a94b37da8b6" /></button>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <div className="space-y-4">
          <h2 className="px-1 text-lg font-black"><SiteText copyKey="site.app.console.guildconsole.d4e7c45d21e2" /></h2>
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
                        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"><SiteText copyKey="site.app.console.guildconsole.9c4ebb4cf104" />{" "}
                          {candidate.selectedOrderId ? <SiteText copyKey="site.app.console.guildconsole.3feb2e0b5a23" /> : ""}
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
                            ><SiteText copyKey="site.app.console.guildconsole.63b2603c5b9d" />{quote.display}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-stone-50 px-3 py-4 text-sm text-slate-500"><SiteText copyKey="site.app.console.guildconsole.4c3e812e29b0" /></p>
                )}
              </div>
            </Panel>
          ))}
          {!myDispatches.length ? (
            <Panel>
              <p className="text-sm text-slate-600"><SiteText copyKey="site.app.console.guildconsole.94dbe5b69027" /></p>
            </Panel>
          ) : null}
        </div>
        <div className="space-y-4">
          <h2 className="px-1 text-lg font-black"><SiteText copyKey="site.app.console.guildconsole.0e37f83ddbf1" /></h2>
          {openDispatches.map((dispatch) => (
            <Panel key={dispatch.id}>
              <DispatchHeader dispatch={dispatch} />
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>
                  {dispatch.anonymous ? <SiteText copyKey="site.app.console.guildconsole.4997ae7b55dc" /> : dispatch.bossName}
                </span>
                <span>{dispatch.candidateCount}<SiteText copyKey="site.app.console.guildconsole.f210fb64816c" /></span>
              </div>
              {isPeiwan && dispatch.ownerId !== "me" ? (
                <button
                  type="button"
                  disabled={sending || dispatch.status !== "OPEN"}
                  onClick={() => onGrab(dispatch.id)}
                  className="mt-4 w-full rounded-xl bg-[#d8bd80] px-4 py-2.5 text-sm font-black text-[#2d220f] hover:bg-[#eddaac] disabled:opacity-50"
                ><SiteText copyKey="site.app.console.guildconsole.6166a8e466a5" /></button>
              ) : null}
            </Panel>
          ))}
          {!openDispatches.length ? (
            <Panel>
              <p className="text-sm text-slate-600"><SiteText copyKey="site.app.console.guildconsole.f85c8f0232ac" /></p>
            </Panel>
          ) : null}
        </div>
      </div>
      {dispatchHistory.some((dispatch) => dispatch.status !== "OPEN") ? (
        <Panel>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-black"><SiteText copyKey="site.app.console.guildconsole.8d6ce5ecd24a" /></h2>
              <p className="mt-1 text-sm text-slate-500"><SiteText copyKey="site.app.console.guildconsole.ed6fc7161df0" /></p>
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
                        {dispatch.game || <SiteText copyKey="site.app.console.guildconsole.d039fba21b1c" />} · {dispatch.sexText}
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
                  ><SiteText copyKey="site.app.console.guildconsole.1b32775b5c3c" /></button>
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
            {dispatch.game || <SiteText copyKey="site.app.console.guildconsole.d039fba21b1c" />} · {dispatch.sexText}
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
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8a6725]"><SiteText copyKey="site.app.console.guildconsole.ce1433a194e2" /></p>
        <h1 className="mt-1 text-3xl font-black"><SiteText copyKey="site.app.console.guildconsole.81b3798bebc6" /></h1>
        <p className="mt-1 text-sm text-slate-600"><SiteText copyKey="site.app.console.guildconsole.7f5c1e504305" /></p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {orders.map((order) => (
          <Panel key={order.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-500"><SiteText copyKey="site.app.console.guildconsole.17bb9d37b41d" />{order.displayNo} · {order.role}
                </p>
                <h2 className="mt-1 text-lg font-black">
                  {order.counterpartName}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {order.quotationCode} · {money(order.unitPrice)}<SiteText copyKey="site.app.console.guildconsole.891900f1dfe6" /></p>
              </div>
              <StateBadge state={order.status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-stone-50 p-3 text-xs">
              <div>
                <p className="text-slate-500"><SiteText copyKey="site.app.console.guildconsole.84e3802f60a7" /></p>
                <p className="mt-1 font-bold">{dateTime(order.createdAt)}</p>
              </div>
              <div>
                <p className="text-slate-500"><SiteText copyKey="site.app.console.guildconsole.d98167d36dbd" /></p>
                <p className="mt-1 font-bold">
                  {order.grossAmount ? <SiteText copyKey="site.app.console.guildconsole.a8d2cbdece97" values={{value1: String(money(order.grossAmount))}} /> : <SiteText copyKey="site.app.console.guildconsole.97af7c1153cd" />}
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
                    {action === "accept" ? <SiteText copyKey="site.app.console.guildconsole.4dee259ff613" /> : action === "decline" ? <SiteText copyKey="site.app.console.guildconsole.6e9a5a1e370e" /> : action === "cancel" ? <SiteText copyKey="site.app.console.guildconsole.3eedd32d80a7" /> : <SiteText copyKey="site.app.console.guildconsole.308738e3d0ad" />}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-xs text-slate-500"><SiteText copyKey="site.app.console.guildconsole.f2f40abb3602" /></p>
            )}
          </Panel>
        ))}
      </div>
      {!orders.length ? (
        <Panel>
          <p className="text-sm text-slate-600"><SiteText copyKey="site.app.console.guildconsole.6cd874d08ee0" /></p>
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
  const siteCopy = useSiteCopy();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8a6725]"><SiteText copyKey="site.app.console.guildconsole.f1702b468627" /></p>
          <h1 className="mt-1 text-3xl font-black"><SiteText copyKey="site.app.console.guildconsole.dc6de3fa868f" /></h1>
          <p className="mt-1 text-sm text-slate-600"><SiteText copyKey="site.app.console.guildconsole.924dce2cf2b6" /></p>
        </div>
        <button
          type="button"
          disabled={sending}
          onClick={onSupport}
          className="rounded-2xl bg-[#171717] px-4 py-3 text-sm font-black text-white disabled:opacity-50"
        ><SiteText copyKey="site.app.console.guildconsole.b139d74c0170" /></button>
      </div>
      <div className="grid min-h-[530px] overflow-hidden rounded-3xl border border-black/[.07] bg-white shadow-[0_14px_40px_rgba(45,35,20,.07)] lg:grid-cols-[340px_1fr]">
        <aside className="border-b border-stone-200 lg:border-b-0 lg:border-r">
          <div className="border-b border-stone-200 px-4 py-4 font-black"><SiteText copyKey="site.app.console.guildconsole.b77b641ed679" /></div>
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
              <p className="px-4 py-8 text-sm text-slate-500"><SiteText copyKey="site.app.console.guildconsole.8ddbac6fed90" /></p>
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
                  <p className="text-center text-sm text-slate-500"><SiteText copyKey="site.app.console.guildconsole.f7d21fc5cf14" /></p>
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
                    placeholder={siteCopy("site.app.console.guildconsole.cf71a3d560a6")}
                    className="min-w-0 flex-1 rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-[#8a6725]"
                  />
                  <button
                    type="button"
                    disabled={sending || !draft.trim()}
                    onClick={() => void onSend()}
                    className="rounded-xl bg-[#171717] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  ><SiteText copyKey="site.app.console.guildconsole.1214d633a448" /></button>
                </div>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-5 text-center text-sm text-slate-500"><SiteText copyKey="site.app.console.guildconsole.07e53c974f6c" /></div>
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
  const siteCopy = useSiteCopy();
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8a6725]"><SiteText copyKey="site.app.console.guildconsole.b60862f4855a" /></p>
          <h1 className="mt-1 text-3xl font-black"><SiteText copyKey="site.app.console.guildconsole.0ea094eec581" /></h1>
          <p className="mt-1 text-sm text-slate-600"><SiteText copyKey="site.app.console.guildconsole.5842c3627374" /></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRecharge}
            className="rounded-2xl bg-[#171717] px-4 py-3 text-sm font-black text-white"
          ><SiteText copyKey="site.app.console.guildconsole.fa03c4625313" /></button>
          <button
            type="button"
            onClick={onWithdraw}
            className="rounded-2xl bg-stone-200 px-4 py-3 text-sm font-black text-stone-800"
          ><SiteText copyKey="site.app.console.guildconsole.a471daf080b6" /></button>
          <button
            type="button"
            onClick={onPointShop}
            className="rounded-2xl bg-stone-200 px-4 py-3 text-sm font-black text-stone-800"
          ><SiteText copyKey="site.app.console.guildconsole.3b1b41c2da72" /></button>
          <button
            type="button"
            onClick={onProfile}
            className="rounded-2xl bg-stone-200 px-4 py-3 text-sm font-black text-stone-800"
          ><SiteText copyKey="site.app.console.guildconsole.a514d78eab6f" /></button>
          <button
            type="button"
            onClick={onBindWechat}
            className="rounded-2xl bg-stone-200 px-4 py-3 text-sm font-black text-stone-800"
          ><SiteText copyKey="site.app.console.guildconsole.312a5af9aee2" /></button>
          <button
            type="button"
            onClick={onSupport}
            className="rounded-2xl bg-[#d8bd80] px-4 py-3 text-sm font-black text-[#2d220f]"
          ><SiteText copyKey="site.app.console.guildconsole.b139d74c0170" /></button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label={siteCopy("site.app.console.guildconsole.ae1abe750af6")}
          value={`${money(me?.user.totalBalance)} 币`}
          detail="可用于创建订单"
        />
        <Metric
          label={siteCopy("site.app.console.guildconsole.b9c09c1da358")}
          value={`${money(me?.user.income)} 币`}
          detail="可提现收入"
        />
        <Metric
          label={siteCopy("site.app.console.guildconsole.904685b6da57")}
          value={`${money(me?.user.recharge)} 币`}
          detail="包含人工入账与在线充值"
        />
        <Metric
          label={siteCopy("site.app.console.guildconsole.bd94a6639088")}
          value={`${money(me?.user.totalSpent)} 币`}
          detail={me?.user.vipLevelLabel ?? "会员权益"}
        />
      </div>
      {me?.user.memberStatus === "PEIWAN" ? (
        <Panel>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#8a6725]"><SiteText copyKey="site.app.console.guildconsole.d82d647fc0f1" /></p>
              <h2 className="mt-1 text-lg font-black"><SiteText copyKey="site.app.console.guildconsole.b5db739ac671" /></h2>
              <p className="mt-1 text-sm text-slate-500"><SiteText copyKey="site.app.console.guildconsole.d0a85d251066" /></p>
            </div>
            {ownPeiwanCard?.exists ? (
              ownPeiwanCard.approved ? (
                <StateBadge
                  state={ownPeiwanCard.status === "可接" ? "AVAILABLE" : "BUSY"}
                />
              ) : (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800"><SiteText copyKey="site.app.console.guildconsole.fe58c849a9c4" /></span>
              )
            ) : null}
          </div>
          {ownPeiwanCard?.exists ? (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-stone-100 p-3">
                  <p className="text-xs text-slate-500"><SiteText copyKey="site.app.console.guildconsole.0d0b95894332" /></p>
                  <p className="mt-1 font-black">
                    {ownPeiwanCard.name ?? <SiteText copyKey="site.app.console.guildconsole.1d61b82ec64b" values={{value1: String(ownPeiwanCard.id)}} />}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    #{ownPeiwanCard.id} · {ownPeiwanCard.sex} ·{" "}
                    {ownPeiwanCard.level}
                  </p>
                </div>
                <div className="rounded-2xl bg-stone-100 p-3">
                  <p className="text-xs text-slate-500"><SiteText copyKey="site.app.console.guildconsole.e4e46c7235d1" /></p>
                  <p className="mt-1 font-black">{ownPeiwanCard.type}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {ownPeiwanCard.approved ? <SiteText copyKey="site.app.console.guildconsole.3024dfeed9df" /> : <SiteText copyKey="site.app.console.guildconsole.f278457a2633" />}
                  </p>
                </div>
                <div className="rounded-2xl bg-stone-100 p-3">
                  <p className="text-xs text-slate-500"><SiteText copyKey="site.app.console.guildconsole.03f65b0e6715" /></p>
                  <p className="mt-1 font-black">
                    {ownPeiwanCard.gameProfiles.length}<SiteText copyKey="site.app.console.guildconsole.64728a772742" /></p>
                  <p className="mt-1 text-xs text-slate-500"><SiteText copyKey="site.app.console.guildconsole.33fe173d3bd2" /></p>
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
                  <span className="text-sm text-slate-500"><SiteText copyKey="site.app.console.guildconsole.fc5d56cf98af" /></span>
                )}
              </div>
            </>
          ) : (
            <p className="mt-4 rounded-2xl bg-stone-100 p-4 text-sm text-slate-600">
              {ownPeiwanCard?.reason === "peiwan_profile_missing" ? <SiteText copyKey="site.app.console.guildconsole.50a1ce2c6ed6" /> : <SiteText copyKey="site.app.console.guildconsole.6da1634e1997" />}
            </p>
          )}
        </Panel>
      ) : null}
      <Panel>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black"><SiteText copyKey="site.app.console.guildconsole.a1c9954f263e" /></h2>
            <p className="mt-1 text-sm text-slate-500"><SiteText copyKey="site.app.console.guildconsole.b846e12540e7" /></p>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b border-stone-200 text-xs text-slate-500">
              <tr>
                <th className="pb-3 font-bold"><SiteText copyKey="site.app.console.guildconsole.89b4aa6364ce" /></th>
                <th className="pb-3 font-bold"><SiteText copyKey="site.app.console.guildconsole.e4e46c7235d1" /></th>
                <th className="pb-3 font-bold"><SiteText copyKey="site.app.console.guildconsole.cb2139e2f68b" /></th>
                <th className="pb-3 font-bold"><SiteText copyKey="site.app.console.guildconsole.51cc55073eb6" /></th>
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
            <p className="py-8 text-center text-sm text-slate-500"><SiteText copyKey="site.app.console.guildconsole.b51a6fde063d" /></p>
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
  const siteCopy = useSiteCopy();
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
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8a6725]"><SiteText copyKey="site.app.console.guildconsole.45d6e44323fa" /></p>
            <h2 className="mt-1 text-2xl font-black"><SiteText copyKey="site.app.console.guildconsole.9a94b37da8b6" /></h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-stone-100"
          ><SiteText copyKey="site.app.console.guildconsole.6c14bd7f6f9e" /></button>
        </div>
        <label className="mt-5 block text-sm font-bold"><SiteText copyKey="site.app.console.guildconsole.0a2be4f74596" /><textarea
            value={requirement}
            onChange={(event) => onRequirement(event.target.value)}
            maxLength={500}
            rows={5}
            placeholder={siteCopy("site.app.console.guildconsole.3dcc333c18ae")}
            className="mt-2 w-full resize-none rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-normal outline-none focus:border-[#8a6725]"
          />
        </label>
        <label className="mt-4 block text-sm font-bold"><SiteText copyKey="site.app.console.guildconsole.2305ee3ca36f" /><select
            value={game}
            onChange={(event) => onGame(event.target.value)}
            className="mt-2 block w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm font-normal"
          >
            <option value=""><SiteText copyKey="site.app.console.guildconsole.8c577dc72c73" /></option>
            {dispatchGames.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-4">
          <p className="text-sm font-bold"><SiteText copyKey="site.app.console.guildconsole.a83cf20d4ff4" /></p>
          <p className="mt-1 text-xs text-slate-500"><SiteText copyKey="site.app.console.guildconsole.1714ab14a246" /></p>
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
          <p className="text-sm font-bold"><SiteText copyKey="site.app.console.guildconsole.3726b0278076" /></p>
          <div className="mt-2 flex gap-2">
            <Toggle checked={needFemale} onChange={onFemale} label={siteCopy("site.app.console.guildconsole.5138491a19ed")} />
            <Toggle checked={needMale} onChange={onMale} label={siteCopy("site.app.console.guildconsole.4f65b69b2420")} />
          </div>
        </div>
        <div className="mt-4">
          <Toggle
            checked={anonymous}
            onChange={onAnonymous}
            label={siteCopy("site.app.console.guildconsole.9bb6a2c7d3dd")}
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-3 text-sm font-bold text-slate-600"
          ><SiteText copyKey="site.app.console.guildconsole.4d0b4688c787" /></button>
          <button
            disabled={sending}
            type="submit"
            className="rounded-xl bg-[#171717] px-5 py-3 text-sm font-black text-white disabled:opacity-50"
          >
            {sending ? <SiteText copyKey="site.app.console.guildconsole.4a40171aa6b8" /> : <SiteText copyKey="site.app.console.guildconsole.7fdf5ceea0bc" />}
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
      <SiteText namespace="site.app.console.guildconsole" value={label} />
    </label>
  );
}
