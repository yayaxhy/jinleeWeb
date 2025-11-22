'use client';

import { FormEvent, useState } from 'react';
import {
  PEIWAN_GAME_TAG_FIELDS,
  PEIWAN_LEVEL_OPTIONS,
  PEIWAN_QUOTATION_FIELDS,
  PEIWAN_SEX_OPTIONS,
  PEIWAN_STATUS_OPTIONS,
  PEIWAN_TYPE_OPTIONS,
  QUOTATION_CODES,
} from '@/constants/peiwan';

type PeiwanFormState = {
  peiwanId: string;
  discordUserId: string;
  defaultQuotationCode: (typeof QUOTATION_CODES)[number];
  commissionRate: string;
  MP_url: string;
  status: (typeof PEIWAN_STATUS_OPTIONS)[number];
  type: (typeof PEIWAN_TYPE_OPTIONS)[number];
  level: (typeof PEIWAN_LEVEL_OPTIONS)[number];
  sex: (typeof PEIWAN_SEX_OPTIONS)[number];
  techTag: boolean;
  exclusive: boolean;
  quotations: Record<(typeof PEIWAN_QUOTATION_FIELDS)[number], string>;
  gameTags: Record<(typeof PEIWAN_GAME_TAG_FIELDS)[number], boolean>;
};

const createDefaultState = (): PeiwanFormState => ({
  peiwanId: '',
  discordUserId: '',
  defaultQuotationCode: QUOTATION_CODES[0],
  commissionRate: '0.75',
  MP_url: '',
  status: PEIWAN_STATUS_OPTIONS[0],
  type: PEIWAN_TYPE_OPTIONS[0],
  level: PEIWAN_LEVEL_OPTIONS[0],
  sex: PEIWAN_SEX_OPTIONS[0],
  techTag: false,
  exclusive: false,
  quotations: Object.fromEntries(PEIWAN_QUOTATION_FIELDS.map((field) => [field, ''])) as PeiwanFormState['quotations'],
  gameTags: Object.fromEntries(PEIWAN_GAME_TAG_FIELDS.map((tag) => [tag, false])) as PeiwanFormState['gameTags'],
});

type PeiwanFormProps = {
  mode: 'create' | 'edit';
  initialValues?: Partial<PeiwanFormState>;
};

const mergeInitialState = (initialValues?: Partial<PeiwanFormState>) => {
  const base = createDefaultState();
  if (!initialValues) return base;
  return {
    ...base,
    ...initialValues,
    quotations: {
      ...base.quotations,
      ...(initialValues.quotations ?? {}),
    },
    gameTags: {
      ...base.gameTags,
      ...(initialValues.gameTags ?? {}),
    },
  } satisfies PeiwanFormState;
};

const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div>
    <h3 className="text-lg font-semibold text-[#5c43a3]">{title}</h3>
    {subtitle ? <p className="text-sm text-gray-500">{subtitle}</p> : null}
  </div>
);

export function PeiwanForm({ mode, initialValues }: PeiwanFormProps) {
  const [formState, setFormState] = useState<PeiwanFormState>(() => mergeInitialState(initialValues));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);
    const trimmedPeiwanId = formState.peiwanId.trim();
    if (mode === 'create' && trimmedPeiwanId) {
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

    const requiredQuotationField = `quotation_${formState.defaultQuotationCode}` as (typeof PEIWAN_QUOTATION_FIELDS)[number];
    if (formState.quotations[requiredQuotationField] === '') {
      setStatusMessage({ type: 'error', text: `${formState.defaultQuotationCode} 档位不能为空` });
      return;
    }

    setIsSubmitting(true);
    try {
      const quotationsPayload: Record<string, number> = {};
      for (const field of PEIWAN_QUOTATION_FIELDS) {
        const value = formState.quotations[field];
        if (value !== '') {
          const numeric = Number(value);
          if (Number.isNaN(numeric)) {
            setStatusMessage({ type: 'error', text: `${field} 请输入数字` });
            setIsSubmitting(false);
            return;
          }
          quotationsPayload[field] = numeric;
        }
      }

      const payload = {
        peiwanId: mode === 'create' && trimmedPeiwanId ? Number(trimmedPeiwanId) : undefined,
        discordUserId: formState.discordUserId.trim(),
        defaultQuotationCode: formState.defaultQuotationCode,
        commissionRate,
        MP_url: formState.MP_url.trim() || undefined,
        status: formState.status,
        type: formState.type,
        level: formState.level,
        sex: formState.sex,
        techTag: formState.techTag,
        exclusive: formState.exclusive,
        ...quotationsPayload,
        gameTags: formState.gameTags,
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
        setStatusMessage({ type: 'success', text: mode === 'create' ? '新增成功' : '修改已保存' });
        if (mode === 'create') {
          setFormState(createDefaultState());
        }
      }
    } catch (error) {
      setStatusMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid gap-6 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm text-gray-500">陪玩 ID（可选，留空自动生成）</span>
          <input
            type="number"
            min="1"
            step="1"
            value={formState.peiwanId}
            onChange={(event) => setFormState((prev) => ({ ...prev, peiwanId: event.target.value }))}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3] disabled:opacity-60"
            placeholder="正整数，例如 1001"
            disabled={mode === 'edit'}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm text-gray-500">Discord ID</span>
          <input
            type="text"
            value={formState.discordUserId}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, discordUserId: event.target.value }))
            }
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
            placeholder="例如：1234567890"
            disabled={mode === 'edit'}
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
              setFormState((prev) => ({ ...prev, defaultQuotationCode: event.target.value as PeiwanFormState['defaultQuotationCode'] }))
            }
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
          >
            {QUOTATION_CODES.map((code) => (
              <option key={code} value={code} className="bg-[#0f0f0f] text-white">
                {code}
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
          <span className="text-sm text-gray-500">状态</span>
          <select
            value={formState.status}
            onChange={(event) => setFormState((prev) => ({ ...prev, status: event.target.value as PeiwanFormState['status'] }))}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
          >
            {PEIWAN_STATUS_OPTIONS.map((option) => (
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

        <label className="space-y-2">
          <span className="text-sm text-gray-500">陪玩类型</span>
          <select
            value={formState.type}
            onChange={(event) => setFormState((prev) => ({ ...prev, type: event.target.value as PeiwanFormState['type'] }))}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
          >
            {PEIWAN_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option} className="bg-[#0f0f0f] text-white">
                {option}
              </option>
            ))}
          </select>
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
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <input
            type="checkbox"
            checked={formState.techTag}
            onChange={(event) => setFormState((prev) => ({ ...prev, techTag: event.target.checked }))}
            className="h-5 w-5 rounded border-white/20 bg-transparent"
          />
          <span className="text-sm">技术标签</span>
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
        <SectionTitle title="报价配置" subtitle="可选，未填写则保持默认" />
        <div className="grid gap-4 md:grid-cols-2">
          {PEIWAN_QUOTATION_FIELDS.map((field) => (
            <label key={field} className="space-y-2">
              <span className="text-sm text-gray-500 uppercase tracking-[0.2em]">{field.replace('quotation_', '')}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formState.quotations[field]}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    quotations: { ...prev.quotations, [field]: event.target.value },
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
                placeholder="留空则不修改"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <SectionTitle title="游戏标签" subtitle="选择陪玩擅长的项目" />
        <div className="flex flex-wrap gap-3">
          {PEIWAN_GAME_TAG_FIELDS.map((tag) => (
            <label
              key={tag}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${
                formState.gameTags[tag]
                  ? 'border-[#5c43a3] bg-[#5c43a3]/10 text-[#f6edff]'
                  : 'border-white/10 text-gray-400'
              }`}
            >
              <input
                type="checkbox"
                checked={formState.gameTags[tag]}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    gameTags: { ...prev.gameTags, [tag]: event.target.checked },
                  }))
                }
                className="h-4 w-4 rounded border-white/20 bg-transparent"
              />
              {tag}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-full bg-[#5c43a3] px-8 py-3 text-sm font-semibold tracking-[0.2em] text-white hover:bg-[#4a3388] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? '提交中…' : mode === 'create' ? '添加陪玩' : '保存修改'}
        </button>
        {statusMessage ? (
          <p
            className={`text-sm ${
              statusMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {statusMessage.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}
