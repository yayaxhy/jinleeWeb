import { giftReviewPublicMessage } from './public-error-messages';
import type { TargetConfirmation, TargetConfirmationScope } from './target-confirmation-client';

export type GiftExecutionKind = 'VOUCHER_GIFT' | 'DELEGATED_GIFT' | 'DISCORD_GIFT';
export type GiftExecutionIntent = {
  version: 1; kind: GiftExecutionKind; payerDlmId: string | null; payerDiscordId: string | null;
  receiverDlmId: string | null; receiverDiscordId: string; receiverPeiwanId: number | null;
  operatorDiscordId: string | null; giftName: string; quantity: string;
  anonymous: boolean; feedAnonymous: boolean; source: 'regular' | 'service' | 'delegate';
  transactionLabel: string | null; expenseReason: string | null; notifyGiverPointsDm: boolean;
  lotteryVoucherId: string | null; couponVoucherId: string | null;
};
export type GiftActor = { dlmId: string; discordId: string | null };
export type GiftRecoveryRecord = {
  version: 1; actor: GiftActor; requestId: string; kind: 'VOUCHER_GIFT' | 'DELEGATED_GIFT'; createdAt: string;
  phase: 'UNCONFIRMED' | 'NOT_SENT'; intent: GiftExecutionIntent;
  target: { displayName: string; dlmId: string; discordUserId: string; peiwanId: number | null };
  payerDisplayName: string; scope: TargetConfirmationScope;
  inherited?: true; originalActor?: GiftActor;
};
export type GiftExecutionReview = {
  requestId: string; status: 'PENDING' | 'COMPLETED' | 'ABANDONED' | 'REQUIRES_REVIEW'; verified: boolean;
  intent: GiftExecutionIntent; giftAuditId: string | null; transactionId: string | null; individualTransactionId: string | null;
  giftName: string; quantity: string; gross: string | null; payable: string | null;
  reverted: boolean; reverts: Array<{ id: string; status: string; createdAt: string }>;
  message: string;
};
export function newGiftRequestId(cryptoSource: Pick<Crypto, 'getRandomValues'> & Partial<Pick<Crypto, 'randomUUID'>> = globalThis.crypto): string {
  if (cryptoSource.randomUUID) return cryptoSource.randomUUID();
  const bytes = cryptoSource.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export const isGiftRequestId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const actorKey = (actor: GiftActor) => JSON.stringify([actor.dlmId, actor.discordId]);
export const giftRecoveryKey = (actor: GiftActor, kind: GiftRecoveryRecord['kind']) => `dlm-gift-execution:v1:${encodeURIComponent(actorKey(actor))}:${kind}`;
const immutableFields: Array<keyof GiftExecutionIntent> = ['version', 'kind', 'payerDlmId', 'payerDiscordId', 'receiverDlmId', 'receiverDiscordId',
  'receiverPeiwanId', 'operatorDiscordId', 'giftName', 'quantity', 'anonymous', 'feedAnonymous', 'source', 'transactionLabel', 'expenseReason',
  'notifyGiverPointsDm', 'lotteryVoucherId', 'couponVoucherId'];
export const sameGiftExecutionIntent = (left: GiftExecutionIntent, right: GiftExecutionIntent) => immutableFields.every(key => left[key] === right[key]);
const shortText = (value: unknown, max = 300): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
function storedIntent(value: unknown): value is GiftExecutionIntent {
  if (!object(value) || Object.keys(value).length !== immutableFields.length || immutableFields.some(key => !(key in value))) return false;
  return value.version === 1 && ['VOUCHER_GIFT', 'DELEGATED_GIFT'].includes(String(value.kind)) &&
    shortText(value.payerDlmId) && shortText(value.receiverDlmId) && shortText(value.receiverDiscordId, 20) &&
    (value.payerDiscordId === null || shortText(value.payerDiscordId, 20)) && (value.operatorDiscordId === null || shortText(value.operatorDiscordId, 20)) &&
    (value.receiverPeiwanId === null || (typeof value.receiverPeiwanId === 'number' && Number.isSafeInteger(value.receiverPeiwanId) && value.receiverPeiwanId > 0)) &&
    shortText(value.giftName, 200) && shortText(value.quantity, 512) && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value.quantity) &&
    ['anonymous', 'feedAnonymous', 'notifyGiverPointsDm'].every(key => typeof value[key] === 'boolean') &&
    ['regular', 'service', 'delegate'].includes(String(value.source)) &&
    ['transactionLabel', 'expenseReason', 'lotteryVoucherId', 'couponVoucherId'].every(key => value[key] === null || shortText(value[key], 500));
}
function validReview(value: Record<string, unknown>): value is Record<string, unknown> & GiftExecutionReview {
  if (!['PENDING', 'COMPLETED', 'ABANDONED', 'REQUIRES_REVIEW'].includes(String(value.status)) ||
    typeof value.verified !== 'boolean' || typeof value.reverted !== 'boolean' || !shortText(value.message, 500) ||
    !Array.isArray(value.reverts) || value.reverts.some(row => !object(row) || !shortText(row.id) || !shortText(row.status) || !shortText(row.createdAt))) return false;
  for (const key of ['giftAuditId', 'transactionId', 'individualTransactionId', 'gross', 'payable']) if (value[key] !== null && !shortText(value[key])) return false;
  if (value.verified && value.status === 'COMPLETED' && !['giftAuditId', 'transactionId', 'individualTransactionId'].every(key => shortText(value[key]))) return false;
  if (value.verified && value.status === 'ABANDONED' && ['giftAuditId', 'transactionId', 'individualTransactionId'].some(key => value[key] !== null)) return false;
  return true;
}

/** Match the existing numeric UI transport without storing exponent notation. */
export function giftQuantityText(quantity: number) {
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('礼物数量无效');
  const [mantissa, exponent = '0'] = String(quantity).toLowerCase().split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  const digits = whole + fraction;
  const point = whole.length + Number(exponent);
  return point <= 0 ? `0.${'0'.repeat(-point)}${digits}` : point >= digits.length ? digits + '0'.repeat(point - digits.length) : `${digits.slice(0, point)}.${digits.slice(point)}`;
}
export function giftIntentForConfirmation(actor: GiftActor, scope: TargetConfirmationScope, confirmation: TargetConfirmation, giftName: string): GiftExecutionIntent {
  const delegated = scope.purpose === 'delegated-gift';
  const payer = delegated ? confirmation.payer : { dlmId: actor.dlmId, discordUserId: actor.discordId };
  if (!payer?.dlmId || !confirmation.target.discordUserId || (!delegated && !payer.discordUserId) ||
    (delegated && (!actor.discordId || payer.dlmId !== scope.payerDlmId)) || (!delegated && !confirmation.selectedVoucher)) throw new Error('确认对象不完整，请重新查询');
  return {
    version: 1, kind: delegated ? 'DELEGATED_GIFT' : 'VOUCHER_GIFT', payerDlmId: payer.dlmId, payerDiscordId: payer.discordUserId,
    receiverDlmId: confirmation.target.dlmId, receiverDiscordId: confirmation.target.discordUserId, receiverPeiwanId: confirmation.target.peiwanId ?? null,
    operatorDiscordId: delegated ? actor.discordId : null, giftName: giftName.normalize('NFKC').trim(), quantity: giftQuantityText(delegated ? scope.quantity! : 1),
    anonymous: false, feedAnonymous: delegated, source: delegated ? 'delegate' : 'regular', transactionLabel: delegated ? '客服代打赏' : null,
    expenseReason: null, notifyGiverPointsDm: !delegated,
    lotteryVoucherId: !delegated && confirmation.selectedVoucher!.source === 'lottery' ? confirmation.selectedVoucher!.voucherId : null,
    couponVoucherId: !delegated && confirmation.selectedVoucher!.source !== 'lottery' ? confirmation.selectedVoucher!.voucherId : null,
  };
}

export type GiftExecutionCompletion = { record: GiftRecoveryRecord; review: GiftExecutionReview; prepareNext: boolean };
type State = { hydrated: boolean; busy: boolean; records: GiftRecoveryRecord[]; record: GiftRecoveryRecord | null; review: GiftExecutionReview | null; completed: GiftExecutionCompletion | null; message: string | null; storageError: boolean; missing: boolean; draftVersion: number; historyLoading: boolean; historyLoaded: boolean; historyError: string | null; nextCursor: string | null };
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Dependencies = {
  actor: GiftActor; kind: GiftRecoveryRecord['kind']; storage?: Storage; fetch: typeof fetch;
  exclusive?: <T>(key: string, work: () => Promise<T>) => Promise<T>;
  newId: () => string; now?: () => number; notify?: () => void;
};
const UNKNOWN = '原赠礼结果仍待核实，可按编号查询。可以开始新一笔；新赠礼会独立执行，原笔也可能已经成功。';
const REGISTRATION_UNKNOWN = '登记结果尚未确认，本页未发送赠礼指令。请保留原编号查询；开始新一笔不会自动执行原笔。';
const HISTORY_ERROR = '暂时无法加载服务器赠礼记录，请稍后刷新；新赠礼仍会先在服务器登记。';

/** Server registration precedes financial submission. Storage and browser locks are
 * optional caches; recovery reads never execute or replay a gift. Tokens stay ephemeral. */
export function createGiftExecutionController(deps: Dependencies) {
  const key = giftRecoveryKey(deps.actor, deps.kind);
  const initial: State = { hydrated: false, busy: false, records: [], record: null, review: null, completed: null, message: null, storageError: false, missing: false, draftVersion: 0, historyLoading: false, historyLoaded: false, historyError: null, nextCursor: null };
  let state: State = initial;
  let cacheWritable = true;
  const resolvedIds = new Set<string>();
  const submittedConfirmations = new WeakSet<TargetConfirmation>();
  const listeners = new Set<() => void>();
  const set = (next: Partial<State>) => { state = { ...state, ...next }; listeners.forEach(listener => listener()); };
  const parseRecord = (value: unknown): GiftRecoveryRecord => {
    const historical = object(value) && value.inherited === true;
    const originalActor = historical && object(value.originalActor) ? value.originalActor as GiftActor : deps.actor;
    if (!object(value) || value.version !== 1 || !object(value.actor) || actorKey(value.actor as GiftActor) !== actorKey(deps.actor) ||
      value.kind !== deps.kind || !isGiftRequestId(value.requestId) || !['UNCONFIRMED', 'NOT_SENT'].includes(String(value.phase)) ||
      !storedIntent(value.intent) || value.intent.kind !== deps.kind || !object(value.target) || !object(value.scope) ||
      !shortText(value.target.displayName) || !shortText(value.target.dlmId) || !shortText(value.target.discordUserId, 20) || !shortText(value.payerDisplayName) ||
      !shortText(value.createdAt) || !Number.isFinite(Date.parse(value.createdAt)) ||
      value.target.dlmId !== value.intent.receiverDlmId || value.target.discordUserId !== value.intent.receiverDiscordId ||
      (value.target.peiwanId ?? null) !== value.intent.receiverPeiwanId ||
      (historical && (!object(value.originalActor) || !shortText(originalActor.dlmId) || !shortText(originalActor.discordId, 20) || value.phase !== 'UNCONFIRMED')) ||
      (!historical && ('originalActor' in value || 'inherited' in value)) ||
      (deps.kind === 'VOUCHER_GIFT' ? value.intent.payerDlmId !== originalActor.dlmId || value.intent.payerDiscordId !== originalActor.discordId || value.scope.purpose !== 'gift' :
        value.intent.operatorDiscordId !== originalActor.discordId || value.scope.purpose !== 'delegated-gift') ||
      'confirmationToken' in value || 'confirmationToken' in value.scope || JSON.stringify(value).length > 16384) throw new Error('invalid_record');
    return value as GiftRecoveryRecord;
  };
  const cacheFailure = () => { cacheWritable = false; set({ storageError: true }); };
  const readCache = (): GiftRecoveryRecord[] => {
    if (!deps.storage || !cacheWritable) { if (!deps.storage && !state.storageError) cacheFailure(); return []; }
    try {
      const text = deps.storage.getItem(key); if (text === null) return [];
      const value: unknown = JSON.parse(text);
      const records = object(value) && value.version === 2 && Array.isArray(value.records)
        ? value.records.map(parseRecord) : [parseRecord(value)];
      if (new Set(records.map(record => record.requestId)).size !== records.length) throw new Error('duplicate_request_id');
      return records;
    } catch { cacheFailure(); return []; }
  };
  const merge = (before: GiftRecoveryRecord[], incoming: GiftRecoveryRecord[]) => {
    const records = new Map(before.map(row => [row.requestId, row]));
    for (const row of incoming) {
      if (resolvedIds.has(row.requestId)) continue;
      const prior = records.get(row.requestId);
      if (prior && !sameGiftExecutionIntent(prior.intent, row.intent)) throw new Error('request_identity_conflict');
      // A late list response must not erase a known pre-forward rejection.
      records.set(row.requestId, prior?.phase === 'NOT_SENT' ? prior : row);
    }
    return [...records.values()].filter(row => !resolvedIds.has(row.requestId));
  };
  const read = () => {
    try { return merge(state.records, readCache()); }
    catch { cacheFailure(); return state.records; }
  };
  const write = (records: GiftRecoveryRecord[]) => {
    if (!deps.storage || !cacheWritable) return;
    try {
      if (!records.length) {
        deps.storage.removeItem(key);
        if (deps.storage.getItem(key) !== null) throw new Error('delete_failed');
      } else {
        const serialized = JSON.stringify({ version: 2, records });
        deps.storage.setItem(key, serialized);
        if (deps.storage.getItem(key) !== serialized) throw new Error('storage_write_unconfirmed');
      }
    } catch { cacheFailure(); }
  };
  const exclusive = async <T>(work: () => Promise<T>): Promise<T> => {
    if (!deps.exclusive) return work();
    let entered = false;
    try { return await deps.exclusive(key, () => { entered = true; return work(); }); }
    catch (error) { if (entered) throw error; return work(); }
  };
  const latest = (records: GiftRecoveryRecord[]) => records.reduce<GiftRecoveryRecord | null>((selected, row) =>
    !selected || Date.parse(row.createdAt) >= Date.parse(selected.createdAt) ? row : selected, null);
  const matches = (left: GiftRecoveryRecord | undefined | null, right: GiftRecoveryRecord) => !!left && JSON.stringify(left) === JSON.stringify(right);
  const publishRecords = (records: GiftRecoveryRecord[]) => {
    const record = records.find(row => row.requestId === state.record?.requestId) ?? latest(records);
    const same = JSON.stringify(record) === JSON.stringify(state.record);
    set({ hydrated: true, records, record, ...(same ? {} : { review: null, missing: false, message: record ? UNKNOWN : null }) });
  };
  const refresh = () => publishRecords(read());
  const loadHistory = async (more = false, includeResolved = false) => {
    if (state.historyLoading || (more && !state.nextCursor) || !deps.actor.dlmId) return;
    const cursor = more ? state.nextCursor : null;
    set({ historyLoading: true, historyError: null });
    try {
      const response = await deps.fetch(`/api/profile/gift-executions/recovery?kind=${deps.kind}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { cache: 'no-store' });
      const data: unknown = await response.json();
      if (!response.ok || !object(data) || data.ok !== true || !Array.isArray(data.records) || data.records.length > 100 ||
        !(data.nextCursor === null || shortText(data.nextCursor, 2000))) throw new Error('invalid_history');
      const incoming = data.records.map(parseRecord);
      if (new Set(incoming.map(row => row.requestId)).size !== incoming.length) throw new Error('duplicate_history');
      await exclusive(async () => {
        const records = read();
        if (includeResolved) for (const row of incoming) resolvedIds.delete(row.requestId);
        const updated = merge(records, incoming);
        write(updated); publishRecords(updated);
        set({ historyLoaded: true, nextCursor: data.nextCursor as string | null });
        deps.notify?.();
      });
    } catch { set({ historyError: HISTORY_ERROR }); }
    finally { set({ historyLoading: false }); }
  };
  const query = async (prepareNext = false) => {
    if (state.busy) return;
    let original: GiftRecoveryRecord;
    try {
      const record = read().find(row => row.requestId === state.record?.requestId);
      if (!record) { refresh(); return; }
      original = record; set({ record, busy: true, review: null, missing: false });
    } catch { set({ busy: false, message: UNKNOWN }); return; }
    try {
      const response = await deps.fetch(`/api/profile/gift-executions?requestId=${encodeURIComponent(original.requestId)}`, { cache: 'no-store' });
      const data: unknown = await response.json();
      let current: GiftRecoveryRecord | undefined;
      try { current = read().find(row => row.requestId === original.requestId); } catch { set({ busy: false, message: UNKNOWN }); return; }
      if (!matches(current, original) || state.record?.requestId !== original.requestId) { refresh(); return; }
      if (!response.ok || !object(data) || data.ok !== true || !object(data.review)) {
        set({ missing: response.status === 404, message: response.status === 401 ? '请登录后查询赠礼进度。' : UNKNOWN }); return;
      }
      if (!validReview(data.review)) { set({ message: UNKNOWN }); return; }
      const review = data.review;
      if (review.requestId !== original.requestId || !object(review.intent) || !sameGiftExecutionIntent(original.intent, review.intent)) {
        set({ message: '这笔赠礼的信息需要核实，请保留编号并联系客服；新赠礼不会解决原笔的核实问题。' }); return;
      }
      if (!['COMPLETED', 'ABANDONED'].includes(review.status) || review.verified !== true) { set({ review, message: UNKNOWN }); return; }
      if (review.status === 'COMPLETED') {
        try {
          await exclusive(async () => {
            const records = read();
            if (!matches(records.find(row => row.requestId === original.requestId), original)) { refresh(); return; }
            const remaining = records.filter(row => row.requestId !== original.requestId);
            resolvedIds.add(original.requestId); write(remaining);
            set({ records: remaining, record: latest(remaining), review: null, missing: false,
              completed: { record: original, review, prepareNext }, message: remaining.length ? UNKNOWN : null });
            deps.notify?.();
          });
        } catch { set({ message: UNKNOWN }); }
        return;
      }
      set({ review, message: giftReviewPublicMessage(review) });
    } catch { set({ message: UNKNOWN }); }
    finally { set({ busy: false }); }
  };
  return {
    key, getSnapshot: () => state, getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, refresh, query,
    ensureHistory() { if (!state.historyLoaded && !state.historyLoading) void loadHistory(); },
    refreshHistory: () => loadHistory(false, true),
    loadMoreHistory: () => loadHistory(true),
    select(requestId: string) {
      if (state.busy) return;
      try {
        const records = read(); const record = records.find(row => row.requestId === requestId);
        if (record) set({ records, record, review: null, missing: false, message: UNKNOWN });
        else refresh();
      } catch { set({ message: UNKNOWN }); }
    },
    startNew() {
      if (!state.hydrated || state.busy) return false;
      // Starting a separate gift never deletes or abandons an unresolved request.
      set({ draftVersion: state.draftVersion + 1 });
      return true;
    },
    async submit(input: { scope: TargetConfirmationScope; confirmation: TargetConfirmation; intent: GiftExecutionIntent; path: string; body: Record<string, unknown> }) {
      if (!state.hydrated || state.busy) return;
      set({ busy: true, message: null });
      let record: GiftRecoveryRecord | null = null;
      try {
        await exclusive(async () => {
          const records = read();
          if (submittedConfirmations.has(input.confirmation)) {
            set({ message: '这次对象确认已经提交，请重新核对对象后再开始新一笔赠礼。' }); return;
          }
          const expiresAt = Date.parse(input.confirmation.expiresAt);
          if (!Number.isFinite(expiresAt) || expiresAt <= (deps.now ?? Date.now)()) { set({ message: '目标确认已过期，请重新查询并确认。' }); return; }
          const delegated = deps.kind === 'DELEGATED_GIFT';
          const matchesPayload = input.path === (delegated ? '/api/admin/wechat-bosses/delegated-gift' : '/api/lottery/use') &&
            (delegated ? input.body.dlmId === input.scope.payerDlmId && input.body.peiwanId === input.scope.target.trim() &&
              input.body.giftName === input.scope.giftName && input.body.quantity === input.scope.quantity :
              input.body.mode === 'gift' && input.body.target === input.scope.target.trim() && input.body.prizeName === input.scope.prizeName &&
              input.body.couponId === input.scope.couponId && input.body.lotteryId === input.scope.lotteryId);
          if (!matchesPayload || !sameGiftExecutionIntent(input.intent, giftIntentForConfirmation(deps.actor, input.scope, input.confirmation, input.intent.giftName))) {
            set({ message: '本次提交与已确认对象不一致，请重新查询。' }); return;
          }
          if (input.intent.kind !== deps.kind || (deps.kind === 'VOUCHER_GIFT' &&
            (input.intent.payerDlmId !== deps.actor.dlmId || input.intent.payerDiscordId !== deps.actor.discordId)) ||
            (deps.kind === 'DELEGATED_GIFT' && input.intent.operatorDiscordId !== deps.actor.discordId)) throw new Error('actor_mismatch');
          const requestId = deps.newId().toLowerCase();
          if (!isGiftRequestId(requestId) || records.some(row => row.requestId === requestId)) throw new Error('invalid_request_id');
          const next: GiftRecoveryRecord = { version: 1, actor: { ...deps.actor }, requestId, kind: deps.kind,
            createdAt: new Date((deps.now ?? Date.now)()).toISOString(), phase: 'UNCONFIRMED', intent: { ...input.intent },
            target: { displayName: input.confirmation.target.displayName, dlmId: input.confirmation.target.dlmId,
              discordUserId: input.confirmation.target.discordUserId!, peiwanId: input.confirmation.target.peiwanId ?? null },
            payerDisplayName: input.confirmation.payer?.displayName ?? deps.actor.dlmId,
            scope: { purpose: input.scope.purpose, target: input.scope.target, prizeName: input.scope.prizeName, couponId: input.scope.couponId,
              lotteryId: input.scope.lotteryId, payerDlmId: input.scope.payerDlmId, giftName: input.scope.giftName, quantity: input.scope.quantity },
          };
          const updated = [...records, next];
          write(updated); // Best-effort cache; the server registration below is authoritative.
          submittedConfirmations.add(input.confirmation);
          record = next;
          set({ records: updated, record: next, review: null, completed: null, missing: false });
          deps.notify?.();
        });
      } catch { set({ message: UNKNOWN }); }
      if (!record) { set({ busy: false }); return; }
      const submitted: GiftRecoveryRecord = record;
      let succeeded = false;
      let registeredNow = false;
      try {
        const registration = await deps.fetch('/api/profile/gift-executions/prepare', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId: submitted.requestId, kind: deps.kind, confirmationToken: input.confirmation.confirmationToken, scope: submitted.scope }) });
        const data: unknown = await registration.json().catch(() => null);
        if (!registration.ok || !object(data) || data.ok !== true || typeof data.created !== 'boolean') {
          set({ message: REGISTRATION_UNKNOWN }); return;
        }
        const registered = parseRecord(data.record);
        if (registered.requestId !== submitted.requestId || registered.phase !== 'UNCONFIRMED' || !sameGiftExecutionIntent(registered.intent, submitted.intent)) {
          set({ message: '服务器登记信息与本次确认不一致，本页未发送赠礼指令，请保留编号并联系客服。' }); return;
        }
        await exclusive(async () => {
          const updated = merge(read(), [registered]);
          write(updated); publishRecords(updated); deps.notify?.();
        });
        if (!data.created) {
          set({ message: '此编号已有登记，本页不会再次提交赠礼。请查询原请求结果。' }); return;
        }
        registeredNow = true;
      } catch { set({ message: REGISTRATION_UNKNOWN }); return; }
      finally { if (!registeredNow) set({ busy: false }); }
      // Only a matching first-registration receipt can reach the financial POST.
      // No pending request from hydration, history or a failed prepare is replayed.
      try {
        const response = await deps.fetch(input.path, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...input.body, requestId: submitted.requestId, confirmationToken: input.confirmation.confirmationToken }) });
        const data: unknown = await response.json().catch(() => null);
        if (!response.ok && object(data) && data.not_forwarded === true && data.requestId === submitted.requestId) {
          try {
            await exclusive(async () => {
              const records = read();
              const current = records.find(row => row.requestId === submitted.requestId);
              if (!current || !sameGiftExecutionIntent(current.intent, submitted.intent)) { refresh(); return; }
              const next = { ...current, phase: 'NOT_SENT' as const };
              const updated = records.map(row => row.requestId === submitted.requestId ? next : row);
              write(updated);
              set({ records: updated, record: next, review: null, missing: false, message: '本次赠礼尚未提交，请核对信息后重新确认。' });
              deps.notify?.();
            });
          } catch { set({ message: UNKNOWN }); }
          return;
        }
        succeeded = response.ok && object(data) && data.ok === true;
        set({ message: succeeded ? '正在确认赠礼结果，请勿重复提交。' : UNKNOWN });
      } catch { set({ message: UNKNOWN }); }
      finally { set({ busy: false }); }
      if (succeeded && state.record?.requestId === submitted.requestId) await query(true);
    },
    async abandon() {
      if (state.busy || !state.record || (state.record.inherited && state.missing) || (state.review?.status !== 'PENDING' && !state.missing)) return;
      const original = state.record;
      set({ busy: true, review: null, message: '正在取消选中的赠礼，请等待核实结果。' });
      try {
        const current = read().find(row => row.requestId === original.requestId);
        if (!matches(current, original)) { refresh(); return; }
        await deps.fetch('/api/profile/gift-executions/abandon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: original.requestId, intent: original.intent }) });
      } catch { set({ message: UNKNOWN }); }
      finally { set({ busy: false }); }
      await query(); // Never trust the cancellation response as proof of its outcome.
    },
    async clearConfirmed() {
      if (state.busy) return false;
      const original = state.record;
      const permitted = original?.phase === 'NOT_SENT' || (state.review?.verified === true && ['COMPLETED', 'ABANDONED'].includes(state.review.status));
      if (!original || !permitted) return false;
      let cleared = false;
      try {
        await exclusive(async () => {
          const records = read();
          if (!matches(records.find(row => row.requestId === original.requestId), original)) { refresh(); return; }
          const remaining = records.filter(row => row.requestId !== original.requestId);
          resolvedIds.add(original.requestId); write(remaining);
          set({ records: remaining, record: latest(remaining), review: null, missing: false, message: remaining.length ? UNKNOWN : null, draftVersion: state.draftVersion + 1 });
          deps.notify?.(); cleared = true;
        });
      } catch { set({ message: UNKNOWN }); }
      return cleared;
    },
  };
}
