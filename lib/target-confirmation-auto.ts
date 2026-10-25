import { targetScopeKey, type createTargetConfirmationController, type TargetConfirmationScope } from './target-confirmation-client';

type Controller = ReturnType<typeof createTargetConfirmationController>;
type AutoLookupState = { scopeKey: string; debouncing: boolean };
type Timer = ReturnType<typeof setTimeout>;

/** Only schedule complete form values. The server still validates and resolves every identity. */
export function canAutoLookupTarget(scope: TargetConfirmationScope) {
  if (!/^\d{1,20}$/.test(scope.target.trim())) return false;
  if (scope.purpose === 'delegated-gift') return Boolean(scope.payerDlmId?.trim() && scope.giftName?.trim() &&
    Number.isFinite(scope.quantity) && scope.quantity! > 0 && scope.quantity! <= Number.MAX_SAFE_INTEGER);
  return Boolean(scope.prizeName?.trim() && !(scope.couponId && scope.lotteryId) &&
    (scope.purpose !== 'gift' || scope.couponId || scope.lotteryId));
}

/** Debounces read-only confirmation requests; never submits a gift or retries a failed request. */
export function createTargetConfirmationAutoLookup(controller: Controller, deps: {
  setTimeout?: (callback: () => void, milliseconds: number) => Timer;
  clearTimeout?: (timer: Timer) => void;
} = {}) {
  const schedule = deps.setTimeout ?? setTimeout;
  const unschedule = deps.clearTimeout ?? clearTimeout;
  const listeners = new Set<() => void>();
  let state: AutoLookupState = { scopeKey: '', debouncing: false };
  let current: { scope: TargetConfirmationScope; key: string; enabled: boolean } | null = null;
  let timer: Timer | null = null;
  let generation = 0;
  let refreshedExpiry = false;
  const set = (scopeKey: string, debouncing: boolean) => {
    if (state.scopeKey === scopeKey && state.debouncing === debouncing) return;
    state = { scopeKey, debouncing };
    listeners.forEach(listener => listener());
  };
  const cancel = () => {
    generation += 1;
    if (timer !== null) unschedule(timer);
    timer = null;
    set(current?.key ?? '', false);
  };
  const queue = () => {
    if (!current?.enabled || !canAutoLookupTarget(current.scope)) return;
    const expected = generation;
    const { key, scope } = current;
    set(key, true);
    timer = schedule(() => {
      if (expected !== generation || !current?.enabled || current.key !== key) return;
      timer = null;
      set(key, false);
      void controller.lookup(scope);
    }, 350);
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update(scope: TargetConfirmationScope, enabled: boolean) {
      const key = targetScopeKey(scope);
      // React callers can pass a fresh scope object on every render without restarting lookup.
      if (current?.key === key && current.enabled === enabled) {
        if (enabled && timer === null && controller.getSnapshot().phase === 'idle') queue();
        return;
      }
      cancel();
      controller.invalidate();
      current = { scope: { ...scope }, key, enabled };
      refreshedExpiry = false;
      set(key, false);
      queue();
    },
    lookup(scope: TargetConfirmationScope) {
      cancel();
      refreshedExpiry = false;
      return controller.lookup(scope);
    },
    expire() {
      const before = controller.getSnapshot();
      controller.expire();
      // Refresh an expired card once. A failed refresh stays visible for explicit retry,
      // and even an unexpectedly short-lived token cannot create an automatic retry loop.
      if (before.phase !== 'ready' || !current?.enabled || refreshedExpiry || controller.getSnapshot().scopeKey !== current.key ||
          controller.getSnapshot().phase !== 'error') return;
      refreshedExpiry = true;
      cancel();
      queue();
    },
    dispose() {
      cancel();
      current = null;
      refreshedExpiry = false;
      controller.invalidate();
      set('', false);
    },
  };
}
