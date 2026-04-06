export const WITHDRAW_METHOD_OPTIONS = ['微信', '支付宝', 'Paypal'] as const;
export type WithdrawMethodOption = (typeof WITHDRAW_METHOD_OPTIONS)[number];

export const WECHAT_WITHDRAW_HOST = 'cdn.discordapp.com';

export type ParsedWithdrawAccount = {
  method: string;
  detail: string;
};

export const normalizeWithdrawMethod = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

export const normalizeWithdrawDetail = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

export const isWithdrawMethodOption = (value: string): value is WithdrawMethodOption =>
  (WITHDRAW_METHOD_OPTIONS as readonly string[]).includes(value);

export const isWeChatWithdrawMethod = (value: string) => {
  const normalized = normalizeWithdrawMethod(value).toLowerCase();
  return normalized === '微信' || normalized === 'wechat';
};

export const shouldValidateWithdrawImageLink = (method: string, detail: string) => {
  const normalizedDetail = normalizeWithdrawDetail(detail);
  if (!normalizedDetail) return false;
  if (isWeChatWithdrawMethod(method)) return true;
  return parseHttpUrl(normalizedDetail) !== null;
};

export const parseStoredWithdrawAccount = (value?: string | null): ParsedWithdrawAccount | null => {
  if (!value) return null;
  const [method, ...rest] = value.split(':');
  const detail = rest.join(':').trim();
  if (!method || !detail) return null;
  return { method, detail };
};

export const buildStoredWithdrawAccount = (method: string, detail: string) =>
  `${normalizeWithdrawMethod(method)}:${normalizeWithdrawDetail(detail)}`;

export const parseHttpUrl = (value: string): URL | null => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const isDiscordCdnHost = (url: URL) => url.hostname.toLowerCase() === WECHAT_WITHDRAW_HOST;

export const getWithdrawErrorMessage = (error?: string | null) => {
  switch (error) {
    case 'unauthorized':
      return '请先登录 Discord 账号';
    case 'invalid_json':
      return '请求格式不正确，请稍后重试';
    case 'slot_invalid':
      return '提现方式槽位无效，请刷新后重试';
    case 'method_invalid':
      return '请选择有效的提现方式';
    case 'detail_required':
      return '请输入提现账号信息';
    case 'wechat_detail_invalid_url':
      return '收款码图片链接必须填写完整的 http/https 链接';
    case 'wechat_detail_invalid_host':
      return `使用图片链接时，必须使用 ${WECHAT_WITHDRAW_HOST} 链接`;
    case 'wechat_detail_unreachable':
      return '收款码图片链接无法访问，请检查后重试';
    case 'wechat_detail_not_image':
      return '收款码图片链接不是图片，请重新上传后保存';
    case 'invalid_amount':
      return '提现金额无效';
    case 'withdraw_cooldown':
      return '提现冷却中，请稍后再试';
    case 'member_not_found':
      return '未找到账号信息，请联系客服处理';
    case 'insufficient_balance':
      return '可提现余额不足';
    case 'method_not_saved':
      return '请选择已保存的提现方式';
    case 'internal_error':
      return '服务器繁忙，请稍后再试';
    default:
      return error || '操作失败，请稍后重试';
  }
};
