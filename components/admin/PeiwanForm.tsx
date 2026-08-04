"use client";

import { FormEvent, useRef, useState } from 'react';
import {
  PEIWAN_LEVEL_OPTIONS,
  PEIWAN_QUOTATION_FIELDS,
  PEIWAN_SEX_OPTIONS,
  PEIWAN_TYPE_OPTIONS,
  QUOTATION_CODE_LABEL,
  QUOTATION_CODES,
  QUOTATION_CODE_TO_FIELD,
  type PeiwanGameCodeValue,
  type PeiwanGameTierValue,
} from '@/constants/peiwan';
import { formatPeiwanGameProfile, sortPeiwanGameProfiles, type PeiwanGameProfileView } from '@/lib/peiwan/gameProfiles';

type PeiwanFormState = {
  peiwanId: string;
  discordUserId: string;
  defaultQuotationCode: (typeof QUOTATION_CODES)[number];
  commissionRate: string;
  MP_url: string;
  totalEarn: string;
  type: (typeof PEIWAN_TYPE_OPTIONS)[number];
  level: (typeof PEIWAN_LEVEL_OPTIONS)[number];
  sex: (typeof PEIWAN_SEX_OPTIONS)[number];
  exclusive: boolean;
  quotations: Record<(typeof PEIWAN_QUOTATION_FIELDS)[number], string>;
  quotationsClear: Record<(typeof PEIWAN_QUOTATION_FIELDS)[number], boolean>;
  gameProfiles: Array<{
    gameCode: PeiwanGameCodeValue;
    tier: PeiwanGameTierValue;
    sourceRoleId?: string | null;
  }>;
};

const createDefaultState = (): PeiwanFormState => ({
  peiwanId: '',
  discordUserId: '',
  defaultQuotationCode: QUOTATION_CODES[0],
  commissionRate: '0.75',
  MP_url: '',
  totalEarn: '0',
  type: PEIWAN_TYPE_OPTIONS[0],
  level: PEIWAN_LEVEL_OPTIONS[0],
  sex: PEIWAN_SEX_OPTIONS[0],
  exclusive: false,
  quotations: Object.fromEntries(PEIWAN_QUOTATION_FIELDS.map((field) => [field, ''])) as PeiwanFormState['quotations'],
  quotationsClear: Object.fromEntries(PEIWAN_QUOTATION_FIELDS.map((field) => [field, false])) as PeiwanFormState['quotationsClear'],
  gameProfiles: [],
});

const QUOTATION_LABEL_MAP = Object.fromEntries(
  Object.entries(QUOTATION_CODE_TO_FIELD).map(([code, field]) => [
    field,
    QUOTATION_CODE_LABEL[code as keyof typeof QUOTATION_CODE_LABEL],
  ]),
) as Record<(typeof PEIWAN_QUOTATION_FIELDS)[number], string>;

type PeiwanFormProps = {
  mode: 'create' | 'edit';
  initialValues?: Partial<PeiwanFormState>;
  readOnly?: boolean;
  allowRoleSync?: boolean;
};

const mergeInitialState = (initialValues?: Partial<PeiwanFormState>) => {
  const base = createDefaultState();
  return {
    ...base,
    ...initialValues,
    quotations: {
      ...base.quotations,
      ...(initialValues?.quotations ?? {}),
    },
    quotationsClear: {
      ...base.quotationsClear,
      ...(initialValues?.quotationsClear ?? {}),
    },
    gameProfiles: sortPeiwanGameProfiles(initialValues?.gameProfiles ?? []),
  } satisfies PeiwanFormState;
};

const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div>
    <h3 className="text-lg font-semibold tracking-[0.2em]">{title}</h3>
    {subtitle ? <p className="text-xs uppercase tracking-[0.3em] text-gray-400 mt-1">{subtitle}</p> : null}
  </div>
);

export function PeiwanForm({ mode, initialValues, readOnly = false, allowRoleSync = true }: PeiwanFormProps) {
  const [formState, setFormState] = useState<PeiwanFormState>(() => mergeInitialState(initialValues));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const initialPeiwanIdRef = useRef<string>(initialValues?.peiwanId ?? '');
  const [persistedTarget, setPersistedTarget] = useState<{
    peiwanId: string;
    discordUserId: string;
  } | null>(
    initialValues?.discordUserId
      ? {
          peiwanId: initialValues.peiwanId ?? '',
          discordUserId: initialValues.discordUserId,
        }
      : null,
  );

  const isReadOnly = readOnly;
  const syncReady = !isReadOnly && allowRoleSync && !!persistedTarget?.discordUserId;
  const getQuotationCodeLabel = (code: PeiwanFormState['defaultQuotationCode']) => QUOTATION_CODE_LABEL[code] ?? code;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isReadOnly) {
      setStatusMessage({ type: 'error', text: '当前账号为只读权限，无法保存陪玩信息。' });
      return;
    }
    setStatusMessage(null);
    const trimmedPeiwanId = formState.peiwanId.trim();
    if (mode === 'edit' && !trimmedPeiwanId) {
      setStatusMessage({ type: 'error', text: '陪玩ID 不能为空' });
      return;
    }
    if (trimmedPeiwanId) {
      const numeric = Number(trimmedPeiwanId);
      if (!Number.isInteger(numeric) || numeric <= 0) {
        setStatusMessage({ type: 'error', text: '陪玩ID 必须为正整数' });
        return;
      }
    }
    if (!formState.discordUserId.trim()) {
      setStatusMessage({ type: 'error', text: 'Discord ID 不能为空' });
      return;
    }

    const commissionRate = Number(formState.commissionRate);
    if (Number.isNaN(commissionRate)) {
      setStatusMessage({ type: 'error', text: '抽成比例必须为数字' });
      return;
    }

    const requiredQuotationField =
      QUOTATION_CODE_TO_FIELD[formState.defaultQuotationCode] as (typeof PEIWAN_QUOTATION_FIELDS)[number];
    if (formState.quotationsClear[requiredQuotationField]) {
      setStatusMessage({
        type: 'error',
        text: `${getQuotationCodeLabel(formState.defaultQuotationCode)} 报价不可清空，请先更换默认报价档位`,
      });
      return;
    }
    if (formState.quotations[requiredQuotationField] === '') {
      setStatusMessage({ type: 'error', text: `${getQuotationCodeLabel(formState.defaultQuotationCode)} 报价不能为空` });
      return;
    }

    const totalEarnInput = formState.totalEarn.trim();
    const totalEarn = totalEarnInput === '' ? undefined : Number(totalEarnInput);
    if (totalEarn !== undefined && (Number.isNaN(totalEarn) || totalEarn < 0)) {
      setStatusMessage({ type: 'error', text: '累计流水必须为非负数字' });
      return;
    }

    const isIdChanged =
      mode === 'edit' &&
      trimmedPeiwanId &&
      initialPeiwanIdRef.current &&
      trimmedPeiwanId !== initialPeiwanIdRef.current;

    if (isIdChanged) {
      const confirmed = window.confirm(
        `当前陪玩 ID 为 ${initialPeiwanIdRef.current}，确认修改为 ${trimmedPeiwanId} 吗？此操作会影响后续按 ID 检索。`,
      );
      if (!confirmed) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const quotationsPayload: Record<string, number | null> = {};
      for (const field of PEIWAN_QUOTATION_FIELDS) {
        if (formState.quotationsClear[field]) {
          quotationsPayload[field] = null;
          continue;
        }
        const raw = formState.quotations[field].trim();
        if (raw !== '') {
          const numeric = Number(raw);
          if (Number.isNaN(numeric)) {
            const label = QUOTATION_LABEL_MAP[field] ?? field;
            setStatusMessage({ type: 'error', text: `${label} 请输入数字` });
            setIsSubmitting(false);
            return;
          }
          quotationsPayload[field] = numeric;
        }
      }

      const payload = {
        peiwanId: trimmedPeiwanId ? Number(trimmedPeiwanId) : undefined,
        discordUserId: formState.discordUserId.trim(),
        defaultQuotationCode: formState.defaultQuotationCode,
        commissionRate,
        MP_url: formState.MP_url.trim() || undefined,
        ...(totalEarn !== undefined ? { totalEarn } : {}),
        level: formState.level,
        sex: formState.sex,
        exclusive: formState.exclusive,
        ...quotationsPayload,
      };

      const url = mode === 'create' ? '/api/admin/peiwan' : `/api/admin/peiwan/${encodeURIComponent(formState.discordUserId)}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const text = typeof result?.error === 'string' ? result.error : '保存失败，请稍后再试';
        setStatusMessage({ type: 'error', text });
      } else {
        const nextId =
          typeof result?.peiwanId === 'number'
            ? String(result.peiwanId)
            : trimmedPeiwanId || formState.peiwanId;
        setFormState((prev) => ({
          ...prev,
          peiwanId: nextId,
          type:
            typeof result?.type === 'string' && PEIWAN_TYPE_OPTIONS.includes(result.type as (typeof PEIWAN_TYPE_OPTIONS)[number])
              ? (result.type as (typeof PEIWAN_TYPE_OPTIONS)[number])
              : prev.type,
        }));
        setPersistedTarget({
          peiwanId: nextId,
          discordUserId: formState.discordUserId.trim(),
        });
        initialPeiwanIdRef.current = nextId;
        setStatusMessage({
          type: 'success',
          text: mode === 'create'
            ? allowRoleSync
              ? '新增成功，可继续同步 Discord tag。'
              : '新增成功。'
            : '修改已保存',
        });
      }
    } catch (error) {
      setStatusMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncRoles = async () => {
    if (!persistedTarget?.discordUserId) {
      setStatusMessage({ type: 'error', text: '请先保存陪玩资料，再同步 Discord tag。' });
      return;
    }
    if (!allowRoleSync) {
      setStatusMessage({ type: 'error', text: '当前账号无权同步 Discord tag。' });
      return;
    }
    setStatusMessage(null);
    setIsSyncing(true);
    try {
      const response = await fetch(
        `/api/admin/peiwan/${encodeURIComponent(persistedTarget.discordUserId)}/sync-roles`,
        { method: 'POST' },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const text = typeof result?.error === 'string' ? result.error : '同步失败，请稍后再试';
        setStatusMessage({ type: 'error', text });
        return;
      }

      const nextType =
        typeof result?.type === 'string' && PEIWAN_TYPE_OPTIONS.includes(result.type as (typeof PEIWAN_TYPE_OPTIONS)[number])
          ? (result.type as (typeof PEIWAN_TYPE_OPTIONS)[number])
          : formState.type;
      const nextProfiles = Array.isArray(result?.profiles)
        ? sortPeiwanGameProfiles(
            result.profiles.filter(
              (item: unknown): item is PeiwanGameProfileView => {
                if (!item || typeof item !== 'object') return false;
                const candidate = item as Record<string, unknown>;
                return typeof candidate.gameCode === 'string' && typeof candidate.tier === 'string';
              },
            ),
          )
        : [];
      setFormState((prev) => ({
        ...prev,
        type: nextType,
        gameProfiles: nextProfiles,
      }));
      setStatusMessage({
        type: 'success',
        text:
          result?.changed === false
            ? 'Discord tag 已检查，无需更新。'
            : '已从 Discord 拉取 tag 并更新数据库。',
      });
    } catch (error) {
      setStatusMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {isReadOnly ? (
        <p className="text-sm text-rose-300">当前账号为只读权限，无法保存或修改陪玩信息。</p>
      ) : null}
      <fieldset disabled={isReadOnly} className="space-y-8">
        <div className="grid gap-6 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-gray-500">陪玩 ID（必填，不可重复）</span>
            <input
              type="number"
              min="1"
              step="1"
              value={formState.peiwanId}
              onChange={(event) => setFormState((prev) => ({ ...prev, peiwanId: event.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3] disabled:opacity-60"
              placeholder="正整数，例如 51001"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-gray-500">Discord ID</span>
            <input
              type="text"
              value={formState.discordUserId}
              onChange={(event) => setFormState((prev) => ({ ...prev, discordUserId: event.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
              placeholder="例如：1234567890"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-gray-500">MP URL</span>
            <input
              type="url"
              value={formState.MP_url}
              onChange={(event) => setFormState((prev) => ({ ...prev, MP_url: event.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
              placeholder="https://..."
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-gray-500">默认报价档位</span>
            <select
              value={formState.defaultQuotationCode}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  defaultQuotationCode: event.target.value as PeiwanFormState['defaultQuotationCode'],
                }))
              }
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
            >
              {QUOTATION_CODES.map((code) => (
                <option key={code} value={code} className="bg-[#0f0f0f] text-white">
                  {QUOTATION_CODE_LABEL[code]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm text-gray-500">抽成比例 (0-1)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={formState.commissionRate}
              onChange={(event) => setFormState((prev) => ({ ...prev, commissionRate: event.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-gray-500">累计流水</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formState.totalEarn}
              onChange={(event) => setFormState((prev) => ({ ...prev, totalEarn: event.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-gray-500">陪玩类型（由 Discord tag 同步）</span>
            <div className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white">
              {formState.type}
            </div>
          </label>
          <label className="space-y-2">
            <span className="text-sm text-gray-500">等级</span>
            <select
              value={formState.level}
              onChange={(event) => setFormState((prev) => ({ ...prev, level: event.target.value as PeiwanFormState['level'] }))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
            >
              {PEIWAN_LEVEL_OPTIONS.map((option) => (
                <option key={option} value={option} className="bg-[#0f0f0f] text-white">
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm text-gray-500">性别</span>
            <select
              value={formState.sex}
              onChange={(event) => setFormState((prev) => ({ ...prev, sex: event.target.value as PeiwanFormState['sex'] }))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
            >
              {PEIWAN_SEX_OPTIONS.map((option) => (
                <option key={option} value={option} className="bg-[#0f0f0f] text-white">
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <input
              type="checkbox"
              checked={formState.exclusive}
              onChange={(event) => setFormState((prev) => ({ ...prev, exclusive: event.target.checked }))}
              className="h-5 w-5 rounded border-white/20 bg-transparent"
            />
            <span className="text-sm">独家陪玩</span>
          </label>
        </div>

        <div className="space-y-4">
          <SectionTitle
            title="游戏档位配置"
            subtitle={allowRoleSync ? '只读，点击按钮从 Discord tag 同步' : '只读，仅原陪玩管理员可同步 Discord tag'}
          />
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-white/80">当前类型：{formState.type}</p>
                <p className="text-xs text-gray-400">
                  {syncReady
                    ? '同步会以 Discord tag 为准，直接覆盖当前游戏档位。'
                    : allowRoleSync
                      ? '请先保存陪玩资料，再同步 Discord tag。'
                      : '当前账号只能新增或修改陪玩基础资料。'}
                </p>
              </div>
              {allowRoleSync ? (
                <button
                  type="button"
                  onClick={handleSyncRoles}
                  disabled={!syncReady || isSyncing}
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm tracking-[0.2em] text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSyncing ? '同步中…' : '同步 Discord tag'}
                </button>
              ) : null}
            </div>
            {formState.gameProfiles.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {formState.gameProfiles.map((profile) => (
                  <div
                    key={`${profile.gameCode}-${profile.tier}-${profile.sourceRoleId ?? 'tagless'}`}
                    className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3"
                  >
                    <p className="text-sm text-white">{formatPeiwanGameProfile(profile)}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      tag ID：{profile.sourceRoleId ?? '未记录'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">当前没有同步到任何 Discord tag。</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <SectionTitle title="报价配置" subtitle="可选，未填写则保持默认" />
          <div className="grid gap-4 md:grid-cols-2">
            {PEIWAN_QUOTATION_FIELDS.map((field) => (
              <label key={field} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-500 tracking-[0.2em]">
                    {QUOTATION_LABEL_MAP[field] ?? field.replace('quotation_', '')}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFormState((prev) => {
                        const nextCleared = !prev.quotationsClear[field];
                        return {
                          ...prev,
                          quotationsClear: { ...prev.quotationsClear, [field]: nextCleared },
                          quotations: { ...prev.quotations, [field]: nextCleared ? '' : prev.quotations[field] },
                        };
                      })
                    }
                    className="rounded-full border border-white/10 px-3 py-1 text-xs text-gray-300 hover:border-white/20 hover:text-white"
                  >
                    {formState.quotationsClear[field] ? '撤销清空' : '清空'}
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState.quotations[field]}
                  disabled={formState.quotationsClear[field]}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      quotations: { ...prev.quotations, [field]: event.target.value },
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3] disabled:opacity-60"
                  placeholder={formState.quotationsClear[field] ? '保存后将清空' : '留空则不修改'}
                />
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <div className="flex flex-col gap-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-full bg-[#5c43a3] px-8 py-3 text-sm font-semibold tracking-[0.2em] text-white hover:bg-[#4a3388] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? '提交中…' : mode === 'create' ? '添加陪玩' : '保存修改'}
        </button>
        {statusMessage ? (
          <p className={`text-sm ${statusMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {statusMessage.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}
