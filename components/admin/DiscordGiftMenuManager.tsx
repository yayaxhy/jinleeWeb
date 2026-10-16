'use client';

import { useEffect, useState } from 'react';
import {
  DISCORD_GIFT_MENU_LIMIT,
  giftMenuUnavailableReason,
  type DiscordGiftMenuState,
} from '@/lib/discord-gift-menu';

const ENDPOINT = '/api/admin/gifts/discord-menu';
const secondaryButton = 'rounded-lg border border-white/20 px-3 py-2 text-sm text-white/80 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-35';

export function DiscordGiftMenuManager() {
  const [data, setData] = useState<DiscordGiftMenuState | null>(null);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(ENDPOINT, { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '读取失败，请重试');
        if (controller.signal.aborted) return;
        setData(result);
        setSelectedNames(result.giftNames);
      } catch (error) {
        if (!controller.signal.aborted) setFeedback({ error: true, text: error instanceof Error ? error.message : '读取失败，请重试' });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [reloadToken]);

  const byName = new Map(data?.gifts.map((gift) => [gift.name, gift]));
  const dirty = !!data && JSON.stringify(selectedNames) !== JSON.stringify(data.giftNames);
  const selected = selectedNames.map((name) => ({ name, gift: byName.get(name) }));
  const invalidSelection = selected.some(({ gift }) => !gift || giftMenuUnavailableReason(gift));
  const busy = loading || saving;
  const available = (data?.gifts ?? []).filter((gift) =>
    !selectedNames.includes(gift.name) && gift.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );

  function changeSelection(names: string[]) {
    setSelectedNames(names);
    setFeedback(null);
  }

  function move(index: number, offset: number) {
    const next = [...selectedNames];
    const destination = index + offset;
    if (destination < 0 || destination >= next.length) return;
    [next[index], next[destination]] = [next[destination], next[index]];
    changeSelection(next);
  }

  async function save() {
    if (!data || busy || !dirty || invalidSelection) return;
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch(ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ giftNames: selectedNames, expectedGiftNames: data.giftNames }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '保存失败，请重试');
      setData(result);
      setSelectedNames(result.giftNames);
      setFeedback({ error: false, text: '已保存，新生成的名片将使用此列表。' });
    } catch (error) {
      setFeedback({ error: true, text: error instanceof Error ? error.message : '保存失败，请重试' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6" aria-busy={busy}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">打赏下拉列表</h2>
          <p className="max-w-2xl text-sm leading-6 text-white/65">
            管理 Discord 名片中的实名、匿名打赏选项。最多 {DISCORD_GIFT_MENU_LIMIT} 个，价格与礼物管理同步。
            保存后对新生成的名片生效，已发送的名片保持原样。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={secondaryButton} disabled={busy} onClick={() => {
            setLoading(true);
            setFeedback(null);
            setReloadToken((value) => value + 1);
          }}>{dirty ? '放弃修改并重新加载' : '刷新列表'}</button>
          <button type="button" onClick={save} disabled={busy || !dirty || invalidSelection}
            className="rounded-lg bg-[#5c43a3] px-5 py-2 text-sm font-medium text-white hover:bg-[#7054bd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-40">
            {saving ? '保存中…' : '保存列表'}
          </button>
        </div>
      </div>

      {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`rounded-xl border p-3 text-sm ${feedback.error ? 'border-rose-400/30 bg-rose-400/10 text-rose-200' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'}`}>{feedback.text}</p>}
      {loading && <p role="status" className="text-sm text-white/65">正在读取礼物列表…</p>}

      {data && <>
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4">
            <h3 className="font-medium">可添加的礼物</h3>
            <label className="mt-3 block">
              <span className="sr-only">搜索礼物名称</span>
              <input type="search" placeholder="搜索礼物名称" value={search} onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/45 focus-visible:outline-violet-400" />
            </label>
            <ul className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto">
              {available.map((gift) => {
                const reason = giftMenuUnavailableReason(gift);
                return <li key={gift.name} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm">{gift.name}</p>
                    <p className={`mt-1 text-xs ${reason ? 'text-amber-200' : 'text-white/60'}`}>{reason ?? `¥${Number(gift.price).toFixed(2)}`}</p>
                  </div>
                  <button type="button" className={`${secondaryButton} shrink-0`} aria-label={`添加${gift.name}`}
                    disabled={busy || !!reason || selectedNames.length >= DISCORD_GIFT_MENU_LIMIT}
                    onClick={() => changeSelection([...selectedNames, gift.name])}>添加</button>
                </li>;
              })}
            </ul>
            {!available.length && <p className="py-6 text-sm text-white/60">{search ? '没有找到匹配的礼物。' : '所有礼物都已加入列表。'}</p>}
          </section>

          <section className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">展示顺序</h3>
              <span className="text-sm text-white/65">{selectedNames.length} / {DISCORD_GIFT_MENU_LIMIT}{dirty ? ' · 未保存' : ''}</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-white/60">从上到下即下拉选项顺序。移除只影响此列表，不会下架礼物。</p>
            <ol className="mt-3 space-y-2">
              {selected.map(({ name, gift }, index) => {
                const reason = gift ? giftMenuUnavailableReason(gift) : '礼物已不存在';
                return <li key={name} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/5 p-3">
                  <span className="w-6 text-sm text-white/45">{index + 1}</span>
                  <div className="min-w-0 flex-1 basis-28">
                    <p className="break-words text-sm">{name}</p>
                    <p className={`mt-1 text-xs ${reason ? 'text-amber-200' : 'text-white/60'}`}>{reason ? `${reason}，不会显示` : `¥${Number(gift!.price).toFixed(2)}`}</p>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" className={secondaryButton} aria-label={`上移${name}`} disabled={busy || index === 0} onClick={() => move(index, -1)}>↑</button>
                    <button type="button" className={secondaryButton} aria-label={`下移${name}`} disabled={busy || index === selected.length - 1} onClick={() => move(index, 1)}>↓</button>
                    <button type="button" className={secondaryButton} aria-label={`移除${name}`} disabled={busy} onClick={() => changeSelection(selectedNames.filter((item) => item !== name))}>移除</button>
                  </div>
                </li>;
              })}
            </ol>
            {!selected.length && <p className="py-8 text-sm leading-6 text-white/60">列表为空。保存后，新名片将不显示打赏下拉框。</p>}
            {invalidSelection && <p className="mt-4 text-sm text-amber-200">请先移除不可用的礼物，再保存列表。</p>}
          </section>
        </div>

        <section className="rounded-2xl border border-white/10 p-4">
          <h3 className="font-medium">下拉选项预览</h3>
          <p className="mt-1 text-xs text-white/60">仅预览，不会发送礼物。未保存的修改也会显示在这里。</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {['实名打赏', '匿名打赏'].map((label) => <label key={label} className="space-y-2">
              <span className="sr-only">{label}预览</span>
              <select key={selectedNames.join('|')} aria-label={`${label}预览`} defaultValue="" disabled={!selected.some(({ gift }) => gift && !giftMenuUnavailableReason(gift))}
                className="w-full rounded-xl border border-white/15 bg-[#23232a] px-3 py-3 text-sm text-white disabled:opacity-40">
                <option value="" disabled>{label}</option>
                {selected.filter(({ gift }) => gift && !giftMenuUnavailableReason(gift)).map(({ name, gift }) =>
                  <option key={name} value={name}>{name}：¥{Number(gift!.price).toFixed(2)}</option>,
                )}
              </select>
            </label>)}
          </div>
        </section>
      </>}
    </div>
  );
}
