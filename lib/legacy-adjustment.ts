/** Manual dispositions are independent facts, never a reconstruction of an old audit. */
export type AdjustmentWallet = { dlmId: string; incomeDelta: string; rechargeDelta: string; totalSpentDelta: string; loyaltyPointsDelta: string; earnDelta: string; rewardIncomeDelta: string };
export type AdjustmentHeart = { fromDlmId: string; toDlmId: string; delta: number };
export type AdjustmentVoucher = { model: 'coupon' | 'lotteryDraw' | 'pointShopGrant'; id: string; ownerDlmId: string; proof: string };
export type AdjustmentQuota = { ownerDlmId: string; kind: 'flow' | 'spend'; amount: string; expiresAt: string; proof: string };
export type AdjustmentCommand = {
  requestId: string; source: { kind: 'GIFT' | 'ORDER'; id: string };
  proof: string; references: string[]; wallets: AdjustmentWallet[]; hearts: AdjustmentHeart[];
  vouchers: AdjustmentVoucher[]; quotas: AdjustmentQuota[];
  reporting: { grossDelta: string | null; payoutDelta: string | null; referralDelta: string | null; discountDelta: string | null; explanation: string };
};
export class AdjustmentError extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); this.name = 'AdjustmentError'; }
}
const invalid = (message: string): never => { throw new AdjustmentError('invalid_adjustment', message, 400); };
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : invalid('请求格式不正确');
const str = (v: unknown, label: string, min = 1, max = 200): string => {
  if (typeof v !== 'string' || v.trim().length < min || v.trim().length > max) return invalid(`${label}不能为空或过长`);
  return v.trim();
};
export const adjustmentAmount = (v: unknown): string => {
  if (typeof v !== 'string' || !/^-?(?:0|[1-9]\d{0,10})(?:\.\d{1,4})?$/.test(v.trim())) return invalid('金额须明确填写普通数字（最多4位小数）；不调整填0');
  const n = v.trim().replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return /^-?0$/.test(n) ? '0' : n;
};
const list = (v: unknown, max: number): unknown[] => Array.isArray(v) && v.length <= max ? v : invalid('调整列表缺失或条目过多');
function unique(values: string[]) { if (new Set(values).size !== values.length) invalid('同一对象不能重复填写，请合并为一行'); }
export function parseAdjustmentCommand(value: unknown): AdjustmentCommand {
  const v = object(value), source = object(v.source), reporting = object(v.reporting);
  const requestId = str(v.requestId, '请求编号');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) invalid('请求编号无效');
  if (source.kind !== 'GIFT' && source.kind !== 'ORDER') invalid('只能处理已存在的赠礼或已结束订单');
  const wallets = list(v.wallets, 8).map(raw => { const r = object(raw); return {
    dlmId: str(r.dlmId, '账户编号'), incomeDelta: adjustmentAmount(r.incomeDelta), rechargeDelta: adjustmentAmount(r.rechargeDelta),
    totalSpentDelta: adjustmentAmount(r.totalSpentDelta), loyaltyPointsDelta: adjustmentAmount(r.loyaltyPointsDelta), earnDelta: adjustmentAmount(r.earnDelta), rewardIncomeDelta: adjustmentAmount(r.rewardIncomeDelta),
  }; });
  const hearts = list(v.hearts, 8).map(raw => { const r = object(raw);
    if (!Number.isSafeInteger(r.delta) || Math.abs(Number(r.delta)) > 100000000) invalid('心动调整须填写有符号整数');
    return { fromDlmId: str(r.fromDlmId, '心动来源'), toDlmId: str(r.toDlmId, '心动对象'), delta: Number(r.delta) };
  });
  const vouchers = list(v.vouchers, 20).map(raw => { const r = object(raw);
    if (!['coupon', 'lotteryDraw', 'pointShopGrant'].includes(String(r.model))) invalid('券来源无效');
    return { model: r.model as AdjustmentVoucher['model'], id: str(r.id, '券编号'), ownerDlmId: str(r.ownerDlmId, '券所属账户'), proof: str(r.proof, '原单与本次用券的核实依据', 1, 1000) };
  });
  const quotas = list(v.quotas, 20).map(raw => { const r = object(raw); const amount = adjustmentAmount(r.amount);
    if (!['flow', 'spend'].includes(String(r.kind)) || Number(amount) <= 0) invalid('退回额度须为正数并指定类型');
    const expiresAt = str(r.expiresAt, '原到期时间');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(expiresAt) || !Number.isFinite(Date.parse(expiresAt))) invalid('原到期时间无效');
    return { ownerDlmId: str(r.ownerDlmId, '额度所属账户'), kind: r.kind as 'flow' | 'spend', amount, expiresAt: new Date(expiresAt).toISOString(), proof: str(r.proof, '原消费额度和原期限的凭据', 1, 1000) };
  });
  unique(wallets.map(r => r.dlmId)); unique(hearts.map(r => `${r.fromDlmId}:${r.toDlmId}`)); unique(vouchers.map(r => `${r.model}:${r.id}`));
  if (!wallets.length && !hearts.length && !vouchers.length && !quotas.length) invalid('请填写至少一项实际调整');
  return { requestId, source: { kind: source.kind as 'GIFT' | 'ORDER', id: str(source.id, '原单编号') },
    proof: str(v.proof, '人工核实结论', 1, 2000), references: list(v.references, 10).map(r => str(r, '凭据编号或地址', 1, 500)), wallets, hearts, vouchers, quotas,
    reporting: { grossDelta: reporting.grossDelta === null ? null : adjustmentAmount(reporting.grossDelta), payoutDelta: reporting.payoutDelta === null ? null : adjustmentAmount(reporting.payoutDelta),
      referralDelta: reporting.referralDelta === null ? null : adjustmentAmount(reporting.referralDelta), discountDelta: reporting.discountDelta === null ? null : adjustmentAmount(reporting.discountDelta), explanation: str(reporting.explanation, '财务分类说明', 1, 1000) },
  };
}

export const ADJUSTMENT_NOTICE = '仅调整平台余额和权益，不表示已原路退款或实际打款。请核实所有对象、金额、原期限和凭据；提交后本原单不再允许自动撤销或再次人工处置。原审计保持不变。';
