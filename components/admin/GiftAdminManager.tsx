'use client';

import { useMemo, useState } from 'react';

type GiftItem = {
  name: string;
  price: string;
  urlLink: string;
  rate: string;
  active: boolean;
  category: string;
  imageUrl: string | null;
};

type ApiGift = {
  name: string;
  price: string;
  urlLink: string;
  rate: string;
  active: boolean;
  category: string;
  imageUrl: string | null;
};

type ApiResponse = {
  ok?: boolean;
  gift?: ApiGift;
  error?: string;
};

type Props = {
  initialGifts: GiftItem[];
  endpoint: string;
};

const normalizeCategory = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : '默认';
};

const sortByName = (items: GiftItem[]) =>
  [...items].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));

export function GiftAdminManager({ initialGifts, endpoint }: Props) {
  const [gifts, setGifts] = useState<GiftItem[]>(() => sortByName(initialGifts));
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [inputKeys, setInputKeys] = useState<Record<string, number>>({});
  const [renameInputs, setRenameInputs] = useState<Record<string, string>>({});
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [createForm, setCreateForm] = useState({
    name: '',
    price: '',
    urlLink: '',
    rate: '1',
    category: '默认',
    active: true,
    file: null as File | null,
  });
  const [createMessage, setCreateMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [createInputKey, setCreateInputKey] = useState(0);

  const giftMap = useMemo(() => new Map(gifts.map((gift) => [gift.name, gift])), [gifts]);
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    gifts.forEach((gift) => {
      set.add(normalizeCategory(gift.category));
    });
    return ['全部', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))];
  }, [gifts]);
  const groupedGifts = useMemo(() => {
    const map = new Map<string, GiftItem[]>();
    gifts.forEach((gift) => {
      const category = normalizeCategory(gift.category);
      if (selectedCategory !== '全部' && category !== selectedCategory) return;
      const group = map.get(category) ?? [];
      group.push(gift);
      map.set(category, group);
    });
    return Array.from(map.entries())
      .map(([category, items]) => ({
        category,
        items: sortByName(items),
      }))
      .sort((a, b) => a.category.localeCompare(b.category, 'zh-Hans-CN'));
  }, [gifts, selectedCategory]);

  const handleGiftFieldChange = (giftName: string, field: keyof GiftItem, value: string | boolean) => {
    setGifts((prev) =>
      prev.map((gift) => (gift.name === giftName ? { ...gift, [field]: value } : gift))
    );
  };

  const handleFileChange = (giftName: string, file: File | null) => {
    setFiles((prev) => ({ ...prev, [giftName]: file }));
    setMessages((prev) => ({ ...prev, [giftName]: '' }));
  };

  const handleUpdate = async (giftName: string) => {
    const current = giftMap.get(giftName);
    if (!current) return;

    setSaving((prev) => ({ ...prev, [giftName]: true }));
    setMessages((prev) => ({ ...prev, [giftName]: '' }));

    try {
      const formData = new FormData();
      formData.append('giftName', giftName);
      formData.append('price', current.price.trim());
      formData.append('urlLink', current.urlLink.trim());
      formData.append('rate', current.rate.trim());
      formData.append('category', normalizeCategory(current.category));
      formData.append('active', current.active ? 'true' : 'false');
      const renameValue = (renameInputs[giftName] ?? '').trim();
      if (renameValue && renameValue !== giftName) {
        formData.append('newGiftName', renameValue);
      }

      const file = files[giftName];
      if (file) {
        formData.append('file', file);
      }

      const response = await fetch(endpoint, { method: 'PATCH', body: formData });
      const data = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok || !data.gift) {
        throw new Error(data.error ?? '更新失败');
      }

      const nextName = data.gift.name;
      setGifts((prev) =>
        sortByName(prev.map((gift) => (gift.name === giftName ? data.gift! : gift)))
      );
      setFiles((prev) => {
        const { [giftName]: _removed, ...rest } = prev;
        return { ...rest, [nextName]: null };
      });
      setInputKeys((prev) => {
        const next = { ...prev, [nextName]: (prev[giftName] ?? 0) + 1 };
        delete next[giftName];
        return next;
      });
      setMessages((prev) => {
        const next = { ...prev, [nextName]: '已更新' };
        delete next[giftName];
        return next;
      });
      setRenameInputs((prev) => {
        const next = { ...prev };
        delete next[giftName];
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '更新失败';
      setMessages((prev) => ({ ...prev, [giftName]: message }));
    } finally {
      setSaving((prev) => ({ ...prev, [giftName]: false }));
    }
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      setCreateMessage('请填写礼物名称');
      return;
    }
    if (!createForm.price.trim()) {
      setCreateMessage('请填写礼物价格');
      return;
    }

    setCreating(true);
    setCreateMessage('');

    try {
      const formData = new FormData();
      formData.append('giftName', createForm.name.trim());
      formData.append('price', createForm.price.trim());
      formData.append('urlLink', createForm.urlLink.trim());
      formData.append('rate', createForm.rate.trim());
      formData.append('category', normalizeCategory(createForm.category));
      formData.append('active', createForm.active ? 'true' : 'false');
      if (createForm.file) {
        formData.append('file', createForm.file);
      }

      const response = await fetch(endpoint, { method: 'POST', body: formData });
      const data = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok || !data.gift) {
        throw new Error(data.error ?? '创建失败');
      }

      setGifts((prev) => sortByName([...prev, data.gift!]));
      setCreateForm({
        name: '',
        price: '',
        urlLink: '',
        rate: '1',
        category: '默认',
        active: true,
        file: null,
      });
      setCreateInputKey((prev) => prev + 1);
      setCreateMessage('创建成功');
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建失败';
      setCreateMessage(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-[0.3em] text-white/60">新增礼物</p>
          <p className="text-xs text-white/50">创建礼物后会自动加入礼物墙配置。</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs text-white/70">礼物名称</span>
            <input
              type="text"
              value={createForm.name}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
              placeholder="例如：123"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs text-white/70">礼物价格</span>
            <input
              type="text"
              value={createForm.price}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, price: event.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
              placeholder="例如：10"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs text-white/70">url_link（可选）</span>
            <input
              type="text"
              value={createForm.urlLink}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, urlLink: event.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
              placeholder="https://..."
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs text-white/70">rate（可选）</span>
            <input
              type="text"
              value={createForm.rate}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, rate: event.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
              placeholder="默认 1"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs text-white/70">分类</span>
            <input
              type="text"
              value={createForm.category}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, category: event.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
              placeholder="例如：节日"
            />
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
            <input
              type="checkbox"
              checked={createForm.active}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, active: event.target.checked }))}
              className="h-4 w-4"
            />
            上架可打赏
          </label>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            key={createInputKey}
            type="file"
            accept="image/png,image/jpeg"
            className="flex-1 cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white file:mr-4 file:rounded-md file:border-0 file:bg-[#5c43a3] file:px-3 file:py-1 file:text-white hover:border-white/20"
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, file: event.target.files?.[0] ?? null }))
            }
            disabled={creating}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="inline-flex items-center justify-center rounded-full bg-[#5c43a3] px-6 py-2 text-xs uppercase tracking-[0.3em] text-white hover:bg-[#4a3388] disabled:opacity-60"
          >
            {creating ? '创建中…' : '创建礼物'}
          </button>
        </div>
        {createMessage ? (
          <p className={`text-xs ${createMessage === '创建成功' ? 'text-emerald-300' : 'text-rose-300'}`}>
            {createMessage}
          </p>
        ) : null}
      </div>

      {gifts.length === 0 ? (
        <p className="text-sm text-white/60">暂无礼物配置。</p>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">按分类筛选</p>
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white"
            >
              {categoryOptions.map((category) => (
                <option key={category} value={category} className="text-black">
                  {category}
                </option>
              ))}
            </select>
          </div>

          {groupedGifts.length === 0 ? (
            <p className="text-sm text-white/60">当前分类暂无礼物。</p>
          ) : (
            groupedGifts.map((group) => (
              <div key={group.category} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-white">{group.category}</h3>
                  <span className="text-xs uppercase tracking-[0.3em] text-white/40">
                    {group.items.length} 件
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {group.items.map((gift) => {
                    const status = messages[gift.name];
                    const isSaving = saving[gift.name];
                    const inputKey = inputKeys[gift.name] ?? 0;
                    const current = giftMap.get(gift.name);

                    return (
                      <div key={gift.name} className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
                        <div className="flex items-start gap-4">
                          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                            {current?.imageUrl ? (
                              <img
                                src={current.imageUrl}
                                alt={gift.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-xs text-white/40">
                                暂无图片
                              </div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm uppercase tracking-[0.3em] text-white/50">礼物</p>
                            <p className="text-lg font-semibold text-white">{gift.name}</p>
                            <p className="text-xs text-white/50 break-all">{current?.imageUrl ?? '未设置'}</p>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="space-y-2 md:col-span-2">
                            <span className="text-xs text-white/70">更改名称（留空不改）</span>
                            <input
                              type="text"
                              value={renameInputs[gift.name] ?? ''}
                              onChange={(event) =>
                                setRenameInputs((prev) => ({ ...prev, [gift.name]: event.target.value }))
                              }
                              placeholder={gift.name}
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs text-white/70">价格</span>
                            <input
                              type="text"
                              value={current?.price ?? ''}
                              onChange={(event) =>
                                handleGiftFieldChange(gift.name, 'price', event.target.value)
                              }
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs text-white/70">url_link</span>
                            <input
                              type="text"
                              value={current?.urlLink ?? ''}
                              onChange={(event) =>
                                handleGiftFieldChange(gift.name, 'urlLink', event.target.value)
                              }
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs text-white/70">rate</span>
                            <input
                              type="text"
                              value={current?.rate ?? ''}
                              onChange={(event) =>
                                handleGiftFieldChange(gift.name, 'rate', event.target.value)
                              }
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs text-white/70">分类</span>
                            <input
                              type="text"
                              value={current?.category ?? ''}
                              onChange={(event) =>
                                handleGiftFieldChange(gift.name, 'category', event.target.value)
                              }
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
                            />
                          </label>
                          <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
                            <input
                              type="checkbox"
                              checked={current?.active ?? true}
                              onChange={(event) =>
                                handleGiftFieldChange(gift.name, 'active', event.target.checked)
                              }
                              className="h-4 w-4"
                            />
                            {current?.active ? '上架中' : '已下架'}
                          </label>
                        </div>

                        <div className="space-y-2">
                          <input
                            key={inputKey}
                            type="file"
                            accept="image/png,image/jpeg"
                            className="w-full cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white file:mr-4 file:rounded-md file:border-0 file:bg-[#5c43a3] file:px-3 file:py-1 file:text-white hover:border-white/20"
                            onChange={(event) => handleFileChange(gift.name, event.target.files?.[0] ?? null)}
                            disabled={isSaving}
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdate(gift.name)}
                            disabled={isSaving}
                            className="inline-flex w-full items-center justify-center rounded-full bg-white/15 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white hover:bg-white/25 disabled:opacity-60"
                          >
                            {isSaving ? '保存中…' : '保存修改'}
                          </button>
                          {status ? (
                            <p className={`text-xs ${status === '已更新' ? 'text-emerald-300' : 'text-rose-300'}`}>
                              {status}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
