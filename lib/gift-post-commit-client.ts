import type { GiftPostCommitTaskView, GiftPostCommitView } from './gift-post-commit';

type State = { view: GiftPostCommitView | null; loading: boolean; retrying: string | null; blocked: boolean; message: string | null };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const string = (value: unknown): value is string => typeof value === 'string' && value.length <= 500;
const statuses = ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'UNKNOWN', 'REQUIRES_REVIEW', 'SKIPPED'];
function parseView(value: unknown, requestId: string): GiftPostCommitView | null {
  if (!object(value) || value.ok !== true || value.requestId !== requestId || !['RECORDED', 'NOT_RECORDED'].includes(String(value.coverage)) ||
    !string(value.message) || !Array.isArray(value.tasks)) return null;
  const ids = new Set<string>();
  for (const item of value.tasks) {
    if (!object(item) || !string(item.id) || !item.id || ids.has(item.id) || !string(item.kind) || !string(item.taskKey) ||
      !statuses.includes(String(item.status)) || typeof item.attempts !== 'number' || !Number.isSafeInteger(item.attempts) || item.attempts < 0 ||
      typeof item.canRetry !== 'boolean' || !string(item.updatedAt) || !Number.isFinite(Date.parse(item.updatedAt)) ||
      ['claimedAt', 'completedAt'].some(key => item[key] !== null && (!string(item[key]) || !Number.isFinite(Date.parse(item[key])))) ||
      (item.errorCode !== null && !string(item.errorCode)) || !Array.isArray(item.retries) || item.retries.some(row => !object(row) || !string(row.actorDiscordId) || !string(row.createdAt))) return null;
    if (item.canRetry && (item.status !== 'FAILED' || item.attempts < 1 || item.attempts >= 3 || !['GIFT_WALL', 'DISCORD_MESSAGE'].includes(item.kind))) return null;
    ids.add(item.id);
  }
  if ((value.coverage === 'NOT_RECORDED') !== (value.tasks.length === 0)) return null;
  return { requestId, coverage: value.coverage as GiftPostCommitView['coverage'], message: value.message, tasks: value.tasks as GiftPostCommitTaskView[] };
}
const unknown = '后续任务状态尚未核实，请只读刷新；原赠礼资金凭证不受此提示影响，查询不会重新执行赠礼。';
/** This controller never calls a gift endpoint. Every retry has one explicit click,
 * one POST, and a separate GET; uncertain reads block further actions. */
export function createGiftPostCommitController(requestId: string, fetcher: typeof fetch) {
  const initial: State = { view: null, loading: false, retrying: null, blocked: true, message: null };
  let state = initial, generation = 0;
  const listeners = new Set<() => void>();
  const set = (next: Partial<State>) => { state = { ...state, ...next }; listeners.forEach(listener => listener()); };
  const load = async (preserveMessage = false) => {
    const current = ++generation;
    set({ loading: true, blocked: true, ...(preserveMessage ? {} : { message: null }) });
    try {
      const response = await fetcher(`/api/admin/gift-post-commit?requestId=${encodeURIComponent(requestId)}`, { cache: 'no-store' });
      const body: unknown = await response.json();
      if (current !== generation) return;
      const view = response.ok ? parseView(body, requestId) : null;
      if (!view) { set({ message: object(body) && string(body.message) ? body.message : unknown, blocked: true }); return; }
      set({ view, blocked: false });
    } catch { if (current === generation) set({ message: unknown, blocked: true }); }
    finally { if (current === generation) set({ loading: false }); }
  };
  return { getSnapshot: () => state, getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async refresh() { if (!state.retrying) await load(); },
    async retry(taskId: string) {
      const task = state.view?.tasks.find(row => row.id === taskId);
      if (!task?.canRetry || state.loading || state.retrying || state.blocked) return;
      set({ retrying: taskId, blocked: true, message: '正在请求重试该后续任务；不会重新赠礼或退款。' });
      try {
        const response = await fetcher('/api/admin/gift-post-commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, taskId }) });
        const data: unknown = await response.json().catch(() => null);
        if (!response.ok || !object(data) || data.ok !== true || data.requestId !== requestId || data.taskId !== taskId) {
          set({ message: object(data) && string(data.message) ? data.message : '重试受理结果未知，正在只读刷新；不会自动再次提交。' });
        } else set({ message: '重试请求已受理，正在只读核实；不代表任务已完成。' });
      } catch { set({ message: '重试受理结果未知，正在只读刷新；不会自动再次提交。' }); }
      finally { await load(true); set({ retrying: null }); }
    },
  };
}
