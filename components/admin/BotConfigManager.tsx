'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { BotConfigState, BotConfigVersion, BotSettings } from '@/lib/bot-config';
import { RUNTIME_PRESENTATION_LIMITS, renderRuntimePresentation, WELCOME_FIXED_COUPON_TERMS, type RuntimePresentation } from '@/lib/runtime-presentation';
import { ORDER_REQUEST_COPY_LIMITS, renderOrderRequestCopy, type OrderRequestCopy } from '@/lib/order-request-copy';
import { canSaveAndPublish, copyValidationError, editableSettings, editorAfterState, editorCopy, editorPresentation, presentationValidationError, editorIsDirty, editorSettings, toEditor, type Editor } from './bot-config-editor';

type Operation = 'refresh' | 'saveAndPublish' | 'rollback' | 'history';

const fields: Array<{ key: keyof Editor; label: string; hint: string }> = [
  { key: 'broadcast', label: '派单广播频道', hint: '填写 1–10 个频道 ID，用英文逗号或换行分隔。第一个作为综合派单主频道，顺序会影响客服代派与知识助手创建的派单。' },
  { key: 'anonymous', label: '匿名点单频道', hint: '填写 1 个频道 ID。' },
  { key: 'publicAccept', label: '接单公告频道', hint: '接单成功后发送公告的频道，最多 10 个；用英文逗号或换行分隔，可留空。' },
];

const copyFields: Array<{ key: keyof OrderRequestCopy; label: string }> = [
  { key: 'requestHint', label: '派单广播提示' },
  { key: 'selectedHint', label: '老板已选陪玩提示' },
  { key: 'endedHint', label: '老板结束派单提示' },
  { key: 'closedHint', label: '派单超时关闭提示' },
  { key: 'dispatchTitle', label: '派单卡片标题' },
  { key: 'dispatchDescription', label: '派单卡片说明' },
];

const presentationFields: Array<{ key: keyof RuntimePresentation; label: string; hint: string; rows?: number }> = [
  { key: 'dispatchImageUrl', label: '派单图片 URL', hint: 'HTTPS 地址，最多 512 字；保存时规范化。禁止凭据、片段和空白。图片仅在点击加载预览后请求。' },
  { key: 'accentColor', label: '卡片主题色', hint: '使用 #RRGGBB，例如 #F5A623；保存时转换为大写。' },
  { key: 'welcomeGreeting', label: '欢迎问候', hint: '单行，1–100 字。' },
  { key: 'welcomeIntro', label: '欢迎介绍', hint: '1–300 字，支持换行。新手券条款与客服信息由 Bot 固定添加。', rows: 3 },
  { key: 'completionNote', label: '结单附言', hint: '单行，最多 160 字；留空则不添加附言。订单号、金额和结算结果始终由 Bot 生成。' },
];

const inputClass = 'mt-2 w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-300 disabled:opacity-50';
const buttonClass = 'rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45';

function timestamp(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '暂无';
}

class ConfigRequestError extends Error {
  constructor(message: string, readonly status: number, readonly refreshRequired = false) {
    super(message);
  }
}

async function requestState(path: string, init?: RequestInit): Promise<BotConfigState> {
  const response = await fetch(path, {
    ...init,
    cache: 'no-store',
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true) {
    const messages: Record<string, string> = {
      forbidden: '当前账号没有 Bot 配置管理权限。',
      invalid_origin: '请求来源验证失败，请从本站管理后台重新打开页面。',
      config_conflict: '服务器配置已被其他操作更新。你的输入已保留，请先刷新状态，核对最新配置后再保存并发布。',
      config_rejected: '配置未通过校验，请核对文案长度和变量、频道 ID、所属服务器及 Bot 的频道权限。',
      version_not_found: '该历史版本已无法读取，请刷新历史后重新选择。',
      bot_unavailable: '暂时无法连接 Bot，请稍后刷新。你的输入已保留。',
      payload_too_large: '提交内容过长，请缩短文案、原因或频道列表。',
    };
    const safeMessage = typeof payload?.message === 'string' && payload.message.length <= 500 ? payload.message : null;
    const detail = response.status === 409 ? `${messages.config_conflict}${safeMessage ? ` ${safeMessage}` : ''}` : safeMessage ?? messages[payload?.error] ?? '请求未完成，请核对输入并刷新后重试。';
    const writeUnconfirmed = init?.method === 'POST' && (response.status >= 500 || response.ok);
    const outcome = payload?.publicationStatus === 'not_attempted'
      ? '本次没有继续发布，服务器可能留有未发布修改。请先刷新状态核对。'
      : payload?.publicationStatus === 'rejected'
        ? '本次发布未通过，修改没有通过本次请求生效。请先刷新状态核对。'
        : payload?.publicationStatus === 'unconfirmed' || writeUnconfirmed
          ? '无法确认本次是否已发布，请先刷新核对已发布版本与 Bot 已加载版本。'
          : '';
    throw new ConfigRequestError(`${outcome}${detail}`, response.status, payload?.refreshRequired === true || writeUnconfirmed);
  }
  return payload as BotConfigState;
}

function SettingsComparison({ current, proposed }: { current: BotSettings; proposed: BotSettings | null }) {
  const before = toEditor(current);
  const after = proposed ? toEditor(proposed) : null;
  return (
    <div className="space-y-3">
      {[...fields, ...copyFields, ...presentationFields].map(({ key, label }) => {
        const changed = after !== null && before[key] !== after[key];
        return (
          <div key={key} className={`rounded-xl border p-3 ${changed ? 'border-amber-200/30 bg-amber-100/5' : 'border-white/10 bg-black/15'}`}>
            <p className="text-sm font-medium">{label}{changed ? <span className="ml-2 text-xs text-amber-200">有变更</span> : null}</p>
            <dl className="mt-2 grid gap-3 text-xs sm:grid-cols-2">
              <div><dt className="text-white/45">Bot 已加载</dt><dd className="mt-1 whitespace-pre-wrap break-all text-white/75">{before[key] || '无'}</dd></div>
              <div><dt className="text-white/45">目标配置</dt><dd className="mt-1 whitespace-pre-wrap break-all text-white/90">{after ? after[key] || '无' : '输入未通过校验'}</dd></div>
            </dl>
          </div>
        );
      })}
    </div>
  );
}

function CopyPreview({ editor }: { editor: Editor }) {
  const copy = editorCopy(editor);
  const invalid = copyValidationError(editor);
  const invalidPresentation = presentationValidationError(editor);
  const presentation = renderRuntimePresentation(editorPresentation(editor));
  const [loadedImage, setLoadedImage] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !invalidPresentation && loadedImage === presentation.dispatchImageUrl && !imageFailed;
  return <div className="space-y-3 border-t border-white/10 pt-5">
    <h4 className="text-sm font-semibold">派单与消息预览</h4>
    <p className="text-xs leading-6 text-white/50">展示公开与匿名派单的文案。订单内容、活动、抢单按钮及订单标识由 Bot 添加；Discord 表情和 Markdown 以原文预览。{invalid ? ' 当前文案无效，以下使用安全默认值。' : ''}</p>
    <div className="space-y-2"><button type="button" className={buttonClass} disabled={Boolean(invalidPresentation)} onClick={() => { setLoadedImage(presentation.dispatchImageUrl); setImageFailed(false); }}>加载图片预览（将请求图片地址）</button><p className="break-all text-xs text-white/45">{presentation.dispatchImageUrl}</p>{imageFailed ? <p className="text-xs text-amber-100">图片暂时无法加载；发布前请确认地址可访问。</p> : null}{invalidPresentation ? <p className="text-xs text-amber-100">展示配置无效，以下使用默认颜色和文案；图片预览已暂停。</p> : null}</div>
    <div className="grid gap-3 sm:grid-cols-2">{[false, true].map((anonymous) => {
      const rendered = renderOrderRequestCopy(copy, { anonymous, callerDisplayName: '预览老板' });
      return <div key={String(anonymous)} className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-4">
        <p className="text-xs text-white/45">{anonymous ? '匿名派单' : '公开派单'}</p>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm text-white/70">{rendered.requestHint}</p>
        <div className="mt-3 rounded border-l-4 bg-white/5 p-3" style={{ borderLeftColor: presentation.accentColor }}><p className="break-words font-semibold">{rendered.dispatchTitle}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-white/75">{rendered.dispatchDescription}</p>{showImage ? (
          // Administrator explicitly opts into loading the validated external HTTPS URL.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={loadedImage!} alt="派单图片预览" className="mt-3 max-h-48 w-full rounded object-contain" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
        ) : <p className="mt-3 rounded border border-dashed border-white/15 p-4 text-center text-xs text-white/40">图片预览未加载</p>}</div>
      </div>;
    })}</div>
    <div className="grid gap-3 sm:grid-cols-2"><section aria-label="欢迎消息预览" className="min-w-0 space-y-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm"><h5 className="font-semibold">欢迎消息</h5><p className="whitespace-pre-wrap break-words">{presentation.welcomeGreeting}</p><p className="whitespace-pre-wrap break-words text-white/75">{presentation.welcomeIntro}</p><div className="rounded-lg border border-white/10 p-3"><p className="mb-2 text-xs text-white/45">固定新手券条款 · 不可编辑</p><p className="whitespace-pre-wrap break-words text-xs leading-6 text-white/65">{WELCOME_FIXED_COUPON_TERMS}</p></div><p className="text-xs text-white/45">客服联系方式和入职链接由 Bot 添加。</p></section><section aria-label="结单消息预览" className="min-w-0 space-y-3 rounded-xl border-l-4 bg-black/20 p-4 text-sm" style={{ borderLeftColor: presentation.accentColor }}><h5 className="font-semibold">订单结算完成（示例）</h5><p className="text-xs leading-6 text-white/50">订单号、时长、金额及结算结果由 Bot 按实际订单填写。</p>{presentation.completionNote ? <p className="whitespace-pre-wrap break-words text-white/80">{presentation.completionNote}</p> : <p className="text-xs text-white/45">未添加结单附言</p>}</section></div>
    <dl className="space-y-2 text-xs">{copyFields.slice(1, 4).map(({ key, label }) => <div key={key} className="rounded-lg bg-black/15 p-3"><dt className="text-white/45">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-white/80">{renderOrderRequestCopy(copy)[key]}</dd></div>)}</dl>
  </div>;
}

export function BotConfigManager() {
  const [state, setState] = useState<BotConfigState | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [history, setHistory] = useState<BotConfigVersion[]>([]);
  const [nextBeforeVersion, setNextBeforeVersion] = useState<number | null>(null);
  const [busy, setBusy] = useState<Operation | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [publishReason, setPublishReason] = useState('');
  const [rollbackTarget, setRollbackTarget] = useState<BotConfigVersion | null>(null);
  const [rollbackReason, setRollbackReason] = useState('');
  const [rollbackConfirmed, setRollbackConfirmed] = useState(false);
  const requestVersion = useRef(0);

  const acceptState = useCallback((data: BotConfigState, replaceEditor: boolean) => {
    setState(data);
    setEditor((current) => editorAfterState(current, data, replaceEditor));
    setHistory(data.history ?? []);
    setNextBeforeVersion(data.nextBeforeVersion ?? null);
    setRollbackConfirmed(false);
    setConflict(false);
  }, []);

  const refresh = useCallback(async (initial = false, signal?: AbortSignal) => {
    const version = ++requestVersion.current;
    setBusy('refresh');
    try {
      const data = await requestState('/api/admin/bot-config', { signal });
      if (signal?.aborted || version !== requestVersion.current) return;
      acceptState(data, false);
      setFailed(false);
      setMessage(initial ? null : '状态和历史已刷新，表单输入已保留。请核对最新配置；需要替换输入时，点击下方“载入服务器配置”。');
    } catch (error) {
      if (signal?.aborted || version !== requestVersion.current) return;
      setFailed(true);
      setMessage(error instanceof Error ? error.message : '加载配置失败，请稍后重试。');
    } finally {
      if (!signal?.aborted && version === requestVersion.current) setBusy(null);
    }
  }, [acceptState]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(true, controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const settings = editor ? editorSettings(editor) : null;
  const dirty = Boolean(editor && state && editorIsDirty(editor, state));
  const writable = Boolean(state?.enabled && Number.isInteger(state.revision) && !busy && !conflict);
  const canPublish = writable && Boolean(state && editor && canSaveAndPublish(state, editor, publishReason));

  const mutate = async (action: 'saveAndPublish' | 'rollback') => {
    if (!writable || !state) return;
    if (action === 'saveAndPublish' && !canPublish) return;
    if (action === 'rollback' && (!rollbackTarget || !rollbackConfirmed || rollbackReason.trim().length > 300)) return;
    setBusy(action);
    try {
      const details = action === 'saveAndPublish'
        ? { settings, reason: publishReason.trim() }
        : { reason: rollbackReason.trim(), targetVersion: rollbackTarget!.version };
      const data = await requestState('/api/admin/bot-config', {
        method: 'POST',
        body: JSON.stringify({ action, expectedRevision: state.revision, ...details }),
      });
      acceptState(data, true);
      setFailed(false);
      const loaded = data.runtime.source === 'published' && data.runtime.appliedVersion === data.activeVersion;
      setMessage(`${action === 'saveAndPublish' ? '保存并发布已完成。' : '回滚已发布为新版本。'}当前已发布 v${data.activeVersion}，${loaded ? 'Bot 已加载该版本。' : 'Bot 尚未确认加载该版本，请稍后刷新核对。'}`);
      if (action === 'saveAndPublish') setPublishReason('');
      if (action === 'rollback') {
        setRollbackTarget(null);
        setRollbackReason('');
      }
    } catch (error) {
      setFailed(true);
      if (!(error instanceof ConfigRequestError) || error.status === 409 || error.refreshRequired || error.status >= 500) setConflict(true);
      setMessage(error instanceof ConfigRequestError ? error.message : '无法确认本次操作是否完成。输入已保留，请先刷新核对已发布版本与 Bot 已加载版本，再决定是否重新提交。');
    } finally {
      setBusy(null);
    }
  };

  const loadMore = async () => {
    if (busy || nextBeforeVersion === null) return;
    setBusy('history');
    try {
      const data = await requestState(`/api/admin/bot-config?beforeVersion=${nextBeforeVersion}`);
      setHistory((current) => {
        const versions = new Set(current.map((version) => version.version));
        return [...current, ...(data.history ?? []).filter((version) => !versions.has(version.version))];
      });
      setNextBeforeVersion(data.nextBeforeVersion ?? null);
      if (!conflict) {
        setFailed(false);
        setMessage(null);
      }
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : '历史版本加载失败。');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 text-white" aria-busy={busy !== null}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-white/55 hover:text-white">← 返回管理后台</Link>
          <h2 className="mt-3 text-2xl font-semibold">Bot 频道、文案与展示</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">编辑并核对变更后，点击一次“保存并发布”。原因可以留空。发布后可在这里确认 Bot 是否已加载新版本。</p>
        </div>
        <button type="button" className={buttonClass} disabled={busy !== null} onClick={() => void refresh()}>{busy === 'refresh' ? '刷新中…' : '刷新状态（保留输入）'}</button>
      </header>

      {message ? <p role={failed ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm leading-6 ${failed ? 'border-amber-200/30 bg-amber-100/5 text-amber-100' : 'border-white/15 bg-white/5 text-white/80'}`}>{message}</p> : null}
      {!state ? <p className="rounded-2xl border border-white/10 p-6 text-sm text-white/60">{busy ? '正在读取 Bot 配置…' : '配置暂不可用，请点击刷新重试。'}</p> : <>
        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold">发布与加载状态</h3><span className={`rounded-full px-3 py-1 text-xs ${state.enabled ? 'bg-emerald-300/10 text-emerald-200' : 'bg-amber-200/10 text-amber-100'}`}>{state.enabled ? '动态配置已启用' : '动态配置未启用'}</span></div>
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div><dt className="text-white/45">已发布版本</dt><dd className="mt-1 font-medium">{state.activeVersion ? `v${state.activeVersion}` : '尚未发布'}</dd></div>
            <div><dt className="text-white/45">Bot 已加载版本</dt><dd className="mt-1 font-medium">{state.runtime.source === 'published' && state.runtime.appliedVersion !== null ? `v${state.runtime.appliedVersion}` : '环境变量配置'}</dd></div>
            <div><dt className="text-white/45">配置修订号</dt><dd className="mt-1 font-medium">{state.revision ?? '暂无'}</dd></div>
          </dl>
          <p className="break-all text-xs leading-6 text-white/50">服务器：{state.guildId} · 最近检查：{timestamp(state.poll.lastCheckedAt)} · 最近加载：{timestamp(state.runtime.appliedAt)}</p>
          {!state.enabled ? <p className="text-sm text-amber-100">Bot 尚未启用动态配置，当前仅展示运行配置；保存并发布、回滚暂不可用。</p> : null}
          {state.enabled && state.activeVersion && state.activeVersion !== state.runtime.appliedVersion ? <p className="text-sm text-amber-100">已发布版本尚未被 Bot 加载，请稍后刷新确认。</p> : null}
          {state.poll.lastError ? <p role="alert" className="text-sm text-amber-100">最近一次配置读取失败，请检查 Bot 状态后刷新。下方“Bot 已加载”展示 Bot 回报的运行配置。</p> : null}
        </section>

        <section className="space-y-5 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="text-lg font-semibold">编辑配置</h3><p className="mt-1 text-xs leading-6 text-white/50">{state.draft ? `服务器有未发布修改，保存于：${timestamp(state.draftUpdatedAt)} · ${state.draftUpdatedBy ?? '未知管理员'}` : `表单初始值来自${state.active ? '最近已发布' : 'Bot 已加载'}配置。`}</p></div>
            <span className={`text-xs ${dirty ? 'text-amber-200' : 'text-white/50'}`}>{dirty ? '有待发布编辑' : state.draft ? '有服务器未发布修改' : '与当前配置一致'}</span>
          </div>
          {editor ? fields.map(({ key, label, hint }) => <label key={key} className="block text-sm font-medium">{label}<textarea rows={key === 'anonymous' ? 1 : 2} className={`${inputClass} font-mono`} value={editor[key]} disabled={!state.enabled || busy !== null} spellCheck={false} onChange={(event) => setEditor((current) => current ? { ...current, [key]: event.target.value } : current)} /><span className="mt-1 block text-xs font-normal text-white/50">{hint}</span></label>) : null}
          {editor ? <fieldset className="space-y-4 border-t border-white/10 pt-5"><legend className="pt-5 text-sm font-semibold">日常派单文案</legend><p className="text-xs leading-6 text-white/50">仅卡片说明允许使用 {'{caller}'}：公开派单显示老板昵称，匿名派单固定显示“匿名老板”。禁止用户、角色、频道和全体提及。订单号、金额、订单内容及按钮动作不可通过这里修改。</p>{copyFields.map(({ key, label }) => <label key={key} className="block text-sm font-medium">{label}<textarea rows={key === 'dispatchDescription' ? 4 : 2} maxLength={ORDER_REQUEST_COPY_LIMITS[key]} className={inputClass} value={editor[key]} disabled={!state.enabled || busy !== null} onChange={(event) => setEditor((current) => current ? { ...current, [key]: event.target.value } : current)} /><span className="mt-1 block text-xs font-normal text-white/50">{editor[key].length} / {ORDER_REQUEST_COPY_LIMITS[key]} 字{key === 'dispatchDescription' ? ' · 可用变量：{caller}' : ' · 纯文案，不支持变量'}</span></label>)}</fieldset> : null}
          {editor ? <fieldset className="space-y-4 border-t border-white/10 pt-5"><legend className="pt-5 text-sm font-semibold">图片、主题与消息</legend><p className="text-xs leading-6 text-white/50">以下文案不支持变量或用户、角色、频道、全体提及。新手券张数、折扣、返还上限及订单金额不开放编辑。</p>{presentationFields.map(({ key, label, hint, rows }) => <label key={key} className="block text-sm font-medium">{label}{rows ? <textarea rows={rows} maxLength={RUNTIME_PRESENTATION_LIMITS[key]} className={inputClass} value={editor[key]} disabled={!state.enabled || busy !== null} onChange={(event) => setEditor((current) => current ? { ...current, [key]: event.target.value } : current)} /> : <input type="text" maxLength={RUNTIME_PRESENTATION_LIMITS[key]} className={`${inputClass} ${key === 'accentColor' || key === 'dispatchImageUrl' ? 'font-mono' : ''}`} value={editor[key]} disabled={!state.enabled || busy !== null} onChange={(event) => setEditor((current) => current ? { ...current, [key]: event.target.value } : current)} />}<span className="mt-1 block text-xs font-normal text-white/50">{hint} · {editor[key].length} / {RUNTIME_PRESENTATION_LIMITS[key]}</span></label>)}</fieldset> : null}
          {editor && !settings ? <p role="alert" className="text-sm leading-6 text-amber-100">{copyValidationError(editor) ?? presentationValidationError(editor) ?? '请核对频道：ID 须为 17–20 位数字；派单广播需 1–10 个，匿名频道需 1 个，接单公告最多 10 个；同一组内不能重复。'}</p> : null}
          {editor ? <CopyPreview editor={editor} /> : null}
          <div className="flex flex-wrap gap-3">
            <button type="button" className={buttonClass} disabled={busy !== null} onClick={() => { setEditor(toEditor(editableSettings(state))); setMessage(state.draft ? '已载入服务器草稿，本地编辑已丢弃。' : `暂无服务器草稿，已载入${state.active ? '最近已发布' : 'Bot 当前'}配置，本地编辑已丢弃。`); setFailed(false); }}>载入服务器配置（丢弃本地编辑）</button>
          </div>
          <div className="border-t border-white/10 pt-5"><h4 className="mb-3 text-sm font-semibold">当前表单与 Bot 已加载配置对比</h4><SettingsComparison current={state.effective} proposed={settings} /></div>
          <div className="space-y-3 border-t border-white/10 pt-5">
            <label className="block text-sm font-medium">发布原因（选填，最多 300 字）<textarea rows={2} maxLength={300} className={inputClass} value={publishReason} disabled={!state.enabled || busy !== null} onChange={(event) => setPublishReason(event.target.value)} placeholder="例如：将派单广播迁移到新频道" /></label>
            <p className="text-xs leading-6 text-white/50">一次提交当前表单并发布。未填写原因时，版本记录使用默认说明；发布仍会校验频道归属和权限。</p>
            <button type="button" className="rounded-xl bg-violet-200 px-4 py-2.5 text-sm font-semibold text-violet-950 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-45" disabled={!canPublish} onClick={() => void mutate('saveAndPublish')}>{busy === 'saveAndPublish' ? '保存并发布中…' : '保存并发布'}</button>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <div><h3 className="text-lg font-semibold">发布历史</h3><p className="mt-1 text-xs leading-6 text-white/50">选择历史版本可查看目标配置。回滚会发布一个新版本，并清空服务器草稿。</p></div>
          {history.length ? <ol className="space-y-3">{history.map((version) => <li key={version.version} className="rounded-xl border border-white/10 bg-black/15 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">v{version.version}{version.version === state.activeVersion ? ' · 当前已发布' : ''}{version.rollbackOf !== null ? ` · 回滚自 v${version.rollbackOf}` : ''}</p><p className="mt-1 break-all text-xs text-white/50">{timestamp(version.createdAt)} · {version.createdBy}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-white/75">{version.reason}</p></div><button type="button" className={buttonClass} disabled={busy !== null || !state.enabled} onClick={() => { setRollbackTarget(version); setRollbackConfirmed(false); }}>{rollbackTarget?.version === version.version ? '已选择' : '预览回滚'}</button></div></li>)}</ol> : <p className="text-sm text-white/50">暂无发布历史。</p>}
          {nextBeforeVersion !== null ? <button type="button" className={buttonClass} disabled={busy !== null} onClick={() => void loadMore()}>{busy === 'history' ? '加载中…' : '加载更早版本'}</button> : history.length ? <p className="text-xs text-white/45">已显示全部已加载历史。</p> : null}
          {rollbackTarget ? <div className="space-y-4 rounded-xl border border-amber-200/25 bg-amber-100/5 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-semibold">回滚目标：v{rollbackTarget.version}</h4><button type="button" className="text-xs text-white/60 underline" disabled={busy !== null} onClick={() => { setRollbackTarget(null); setRollbackConfirmed(false); }}>取消回滚预览</button></div><SettingsComparison current={state.effective} proposed={rollbackTarget.settings} /><label className="block text-sm font-medium">回滚原因（选填，最多 300 字）<textarea rows={2} maxLength={300} className={inputClass} value={rollbackReason} disabled={busy !== null || !state.enabled} onChange={(event) => { setRollbackReason(event.target.value); setRollbackConfirmed(false); }} /></label><label className="flex items-start gap-3 text-sm leading-6 text-amber-100"><input type="checkbox" className="mt-1" checked={rollbackConfirmed} disabled={busy !== null || !state.enabled} onChange={(event) => setRollbackConfirmed(event.target.checked)} /><span>我已核对目标配置。确认回滚将发布新版本、清空服务器草稿，并替换当前表单中的本地编辑。</span></label><button type="button" className={buttonClass} disabled={!writable || !rollbackConfirmed || rollbackReason.trim().length > 300} onClick={() => void mutate('rollback')}>{busy === 'rollback' ? '回滚中…' : `确认回滚到 v${rollbackTarget.version}`}</button></div> : null}
        </section>
      </>}
    </div>
  );
}
