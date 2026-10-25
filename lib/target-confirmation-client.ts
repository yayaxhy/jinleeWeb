/** Browser-only workflow logic with injectable transport/clock for offline tests.
 * The server owns signing and identity validation; this never resolves IDs. */
export type TargetConfirmationScope = {
  purpose: 'gift' | 'voucher' | 'delegated-gift'; target: string;
  prizeName?: string; couponId?: string; lotteryId?: string;
  payerDlmId?: string; giftName?: string; quantity?: number;
};
export type ConfirmedTarget = { dlmId: string; discordUserId: string | null; peiwanId?: number | null; displayName: string };
export type TargetConfirmation = {
  confirmationToken: string; expiresAt: string; target: ConfirmedTarget; payer?: ConfirmedTarget;
  selectedVoucher?: { source: string; voucherId: string; prizeName: string };
};
export type ConfirmationState = {
  phase: 'idle' | 'loading' | 'ready' | 'submitting' | 'unknown' | 'success' | 'error';
  scopeKey: string; confirmation: TargetConfirmation | null; message: string | null;
};
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const safeMessage = (value: unknown, fallback: string) => typeof value === 'string' && value.length <= 500 ? value : fallback;
export const targetScopeKey = (scope: TargetConfirmationScope) => JSON.stringify([
  scope.purpose, scope.target.trim(), scope.prizeName ?? '', scope.couponId ?? '', scope.lotteryId ?? '',
  scope.payerDlmId ?? '', scope.giftName ?? '', scope.quantity ?? null,
]);
function validScope(scope: TargetConfirmationScope) {
  if (!scope.target.trim()) return false;
  if (scope.purpose === 'delegated-gift') return Boolean(scope.payerDlmId && scope.giftName && Number.isFinite(scope.quantity) && scope.quantity! > 0);
  return Boolean(scope.prizeName && !(scope.couponId && scope.lotteryId));
}
function identity(value: unknown): value is ConfirmedTarget {
  return object(value) && typeof value.dlmId === 'string' && Boolean(value.dlmId) &&
    (value.discordUserId === null || typeof value.discordUserId === 'string') && typeof value.displayName === 'string' &&
    (value.peiwanId == null || (typeof value.peiwanId === 'number' && Number.isSafeInteger(value.peiwanId)));
}
export function parseTargetConfirmation(value: unknown, now: number): TargetConfirmation | null {
  if (!object(value) || typeof value.confirmationToken !== 'string' || !value.confirmationToken || value.confirmationToken.length > 16384 ||
      typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= now ||
      !identity(value.target) || (value.payer !== undefined && !identity(value.payer))) return null;
  if (value.selectedVoucher !== undefined && (!object(value.selectedVoucher) ||
      !['coupon', 'pointshop', 'lottery'].includes(String(value.selectedVoucher.source)) ||
      typeof value.selectedVoucher.voucherId !== 'string' || !value.selectedVoucher.voucherId ||
      typeof value.selectedVoucher.prizeName !== 'string')) return null;
  return value as TargetConfirmation;
}

/** Check the actual consumer payload, not only the currently rendered form scope. */
function submissionMatches(scope: TargetConfirmationScope, path: string, body: Record<string, unknown>) {
  if (scope.purpose === 'delegated-gift') return path === '/api/admin/wechat-bosses/delegated-gift' &&
    body.dlmId === scope.payerDlmId && body.peiwanId === scope.target.trim() &&
    body.giftName === scope.giftName && body.quantity === scope.quantity;
  return path === (scope.purpose === 'gift' ? '/api/lottery/use' : '/api/voucher/use') &&
    (scope.purpose !== 'gift' || body.mode === 'gift') && body.target === scope.target.trim() &&
    body.prizeName === scope.prizeName && body.couponId === scope.couponId && body.lotteryId === scope.lotteryId;
}

export function createTargetConfirmationController(deps: { fetch: typeof fetch; now?: () => number }) {
  const now = deps.now ?? Date.now;
  let generation = 0;
  let state: ConfirmationState = { phase: 'idle', scopeKey: '', confirmation: null, message: null };
  const listeners = new Set<() => void>();
  const set = (next: ConfirmationState) => { state = next; listeners.forEach(listener => listener()); };
  const invalidate = () => {
    if (state.phase === 'submitting' || state.phase === 'unknown') return;
    generation += 1;
    set({ phase: 'idle', scopeKey: '', confirmation: null, message: null });
  };
  const ready = (scope: TargetConfirmationScope) => state.phase === 'ready' && state.scopeKey === targetScopeKey(scope) &&
    Boolean(state.confirmation && Date.parse(state.confirmation.expiresAt) > now());
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    invalidate,
    ready,
    expire: () => {
      if (state.phase === 'ready' && state.confirmation && Date.parse(state.confirmation.expiresAt) <= now()) {
        generation += 1;
        set({ ...state, phase: 'error', confirmation: null, message: '目标确认已过期，请重新查询并确认。' });
      }
    },
    async lookup(scope: TargetConfirmationScope) {
      if (state.phase === 'submitting' || state.phase === 'unknown') return null;
      const request = ++generation;
      const scopeKey = targetScopeKey(scope);
      if (!validScope(scope)) {
        set({ phase: 'error', scopeKey, confirmation: null, message: '请填写目标及完整的礼物或券信息。' }); return null;
      }
      set({ phase: 'loading', scopeKey, confirmation: null, message: null });
      try {
        const response = await deps.fetch('/api/profile/target-confirmation', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...scope, target: scope.target.trim() }),
        });
        const data: unknown = await response.json();
        if (generation !== request) return null;
        const confirmation = response.ok ? parseTargetConfirmation(data, now()) : null;
        if (!confirmation || (scope.purpose === 'delegated-gift' && !confirmation.payer)) {
          set({ phase: 'error', scopeKey, confirmation: null, message: object(data) ? safeMessage(data.error, '无法确认对象，请重新查询。') : '无法确认对象，请重新查询。' });
          return null;
        }
        set({ phase: 'ready', scopeKey, confirmation, message: null }); return confirmation;
      } catch {
        if (generation === request) set({ phase: 'error', scopeKey, confirmation: null, message: '查询未完成，请检查网络后重新查询。' });
        return null;
      }
    },
    async submit(scope: TargetConfirmationScope, path: string, body: Record<string, unknown>) {
      if (!ready(scope) || !submissionMatches(scope, path, body)) return { status: 'blocked' as const };
      const confirmation = state.confirmation!;
      generation += 1;
      set({ ...state, phase: 'submitting', message: null });
      const unknown = () => {
        const requestId = typeof body.requestId === 'string' ? ` 请求编号：${body.requestId}。` : '';
        set({ ...state, phase: 'unknown', message: `提交结果未确认，请先核对券状态、余额、礼物或操作记录，勿重复提交。${requestId}` });
        return { status: 'unknown' as const };
      };
      try {
        const response = await deps.fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, confirmationToken: confirmation.confirmationToken }) });
        const data: unknown = await response.json().catch(() => null);
        if (response.ok && object(data) && data.ok === true) {
          set({ ...state, phase: 'success', confirmation: null, message: null });
          return { status: 'success' as const, data };
        }
        if ([400, 401, 403, 404, 409, 422].includes(response.status) && object(data) && typeof data.error === 'string') {
          const message = response.status === 409 && data.code === 'TARGET_CONFIRMATION_REQUIRED'
            ? '目标确认已失效或账号绑定已变化，请重新查询并确认对象。'
            : safeMessage(data.error, '本次请求未通过，请核对后重新确认。');
          set({ ...state, phase: 'error', confirmation: null, message });
          return { status: 'rejected' as const };
        }
        return unknown();
      } catch { return unknown(); }
    },
  };
}
